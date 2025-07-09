// Real MCP server integration for Airbnb search
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface SearchRequest {
  query: string
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  infants?: number
  pets?: number
  minPrice?: number
  maxPrice?: number
  page?: number
}

interface AirbnbSearchResult {
  id: string
  url: string
  demandStayListing: {
    id: string
    description: {
      name: {
        localizedStringWithTranslationPreference: string
      }
    }
    location: {
      coordinate: {
        latitude: number
        longitude: number
      }
    }
  }
  badges: string
  structuredContent: {
    primaryLine: string
    secondaryLine: string
  }
  avgRatingA11yLabel: string
  structuredDisplayPrice: {
    primaryLine: {
      accessibilityLabel: string
    }
    explanationData: {
      priceDetails: string
    }
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, location, adults = 1, children = 0, infants = 0, checkin, checkout, minPrice, maxPrice, page = 1 }: SearchRequest = req.body

    // Location should already be extracted by NER in the frontend
    // No pattern-based extraction in the API
    
    // Use only the location parameter (should be extracted by NER in frontend)
    const finalLocation = location || ''
    
    const searchParams = {
      location: finalLocation,
      adults,
      children: children + infants,
      page,
      ignoreRobotsText: true,
      ...(checkin ? { checkin } : {}),
      ...(checkout ? { checkout } : {}),
      ...(minPrice ? { minPrice } : {}),
      ...(maxPrice ? { maxPrice } : {})
    }

    // Require location parameter (should be provided by NER extraction)
    if (!finalLocation) {
      console.log('No location found for query:', query)
      return res.status(400).json({ error: 'Location is required for search' })
    }

    console.log('Calling MCP server with params:', searchParams)

    // Call the external MCP server
    const mcpResult = await callExternalMCPServer(searchParams)
    
    console.log('MCP Result received:', JSON.stringify(mcpResult, null, 2))
    console.log('MCP searchResults count:', mcpResult.searchResults?.length)
    
    if (!mcpResult) {
      throw new Error('No response from MCP server')
    }
    
    if (!mcpResult.searchResults) {
      console.log('MCP result structure:', Object.keys(mcpResult))
      throw new Error(`MCP server returned data but no searchResults. Got: ${JSON.stringify(Object.keys(mcpResult))}`)
    }

    // Transform MCP results to our format
    const listings = await transformMCPResults(mcpResult.searchResults)

    return res.status(200).json({
      listings,
      searchUrl: mcpResult.searchUrl,
      totalResults: listings.length,
      page: page,
      hasMore: listings.length >= 18, // Assume more pages if we got a full page
      source: 'Real Airbnb MCP Server'
    })

  } catch (error) {
    console.error('MCP search error:', error)
    
    return res.status(500).json({
      error: 'Failed to search Airbnb listings via MCP',
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Check MCP server configuration and network connectivity',
      debugging: {
        mcpServerUrl: process.env.MCP_SERVER_URL,
        requestBody: req.body,
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }
    })
  }
}

async function callExternalMCPServer(params: Record<string, unknown>) {
  console.log('Calling external MCP server with params:', params)
  
  // Use environment variable or default to your enhanced MCP server
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://airbnb-mcp-production.up.railway.app'
  
  try {
    const response = await fetch(`${mcpServerUrl}/airbnb-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`External MCP server error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    return result
    
  } catch (error) {
    console.error('External MCP server call failed:', error)
    throw error
  }
}

async function transformMCPResults(searchResults: AirbnbSearchResult[]) {
  return Promise.all(searchResults.map(async (listing) => {
    // Improved price extraction
    const priceLabel = listing.structuredDisplayPrice?.primaryLine?.accessibilityLabel || ''
    const priceDetails = listing.structuredDisplayPrice?.explanationData?.priceDetails || ''
    
    // Extract total and nightly rates more accurately
    let totalPrice = 100
    let nightlyRate = 100
    
    const totalMatch = priceLabel.match(/\$(\d+(?:,\d+)*)\s+for\s+(\d+)\s+night/)
    if (totalMatch) {
      totalPrice = parseInt(totalMatch[1].replace(/,/g, ''))
      const nights = parseInt(totalMatch[2])
      nightlyRate = Math.round(totalPrice / nights)
    } else {
      const priceDetailsMatch = priceDetails.match(/\$(\d+(?:,\d+)*(?:\.\d+)?)\s+x\s+(\d+)\s+night/)
      if (priceDetailsMatch) {
        nightlyRate = Math.round(parseFloat(priceDetailsMatch[1].replace(/,/g, '')))
        const nights = parseInt(priceDetailsMatch[2])
        totalPrice = nightlyRate * nights
      }
    }

    // Extract rating and reviews more accurately
    const ratingMatch = listing.avgRatingA11yLabel?.match(/([\d.]+)\s+out\s+of\s+5/)
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.0

    const reviewMatch = listing.avgRatingA11yLabel?.match(/(\d+(?:,\d+)*)\s+review/)
    const reviewsCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : 0

    // Enhanced badge detection
    const badges = listing.badges?.toLowerCase() || ''
    const isSuperhost = badges.includes('superhost')
    const isGuestFavorite = badges.includes('guest favorite')

    // Extract amenities from property name and structured content
    const name = listing.demandStayListing?.description?.name?.localizedStringWithTranslationPreference || 'Property'
    const primaryLine = listing.structuredContent?.primaryLine || ''
    const amenities = extractAmenitiesFromText(name + ' ' + primaryLine)

    // Better city extraction using a simpler approach first
    const lat = listing.demandStayListing?.location?.coordinate?.latitude
    const lng = listing.demandStayListing?.location?.coordinate?.longitude
    let city = 'Unknown'
    
    // For Austin specifically, use coordinates to determine neighborhoods
    if (lat && lng && lat > 30.1 && lat < 30.4 && lng > -97.9 && lng < -97.6) {
      city = getCityFromAustinCoordinates(lat, lng)
    } else if (lat && lng) {
      city = await getCityFromCoordinates(lat, lng) || 'Unknown'
    }

    // Generate Airbnb image URL
    const images = [`https://a0.muscache.com/im/pictures/miso/${listing.id}/original.jpg`]

    return {
      id: listing.id,
      name,
      url: listing.url,
      images,
      price: {
        total: totalPrice,
        rate: nightlyRate,
        currency: 'USD'
      },
      rating,
      reviewsCount,
      location: {
        city,
        country: 'US'
      },
      host: {
        name: isGuestFavorite ? 'Guest Favorite Host' : (isSuperhost ? 'Superhost' : 'Host'),
        isSuperhost
      },
      amenities,
      roomType: primaryLine || 'Property'
    }
  }))
}

async function getCityFromCoordinates(lat?: number, lng?: number): Promise<string | undefined> {
  if (!lat || !lng) return undefined

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ChatBnb/1.0 (https://chatbnb.vercel.app)'
        }
      }
    )

    if (response.ok) {
      const data = await response.json()
      const address = data.address
      
      const city = address?.city || 
                   address?.town || 
                   address?.village || 
                   address?.municipality ||
                   address?.county
      
      return city
    }
  } catch (error) {
    console.log('Reverse geocoding failed:', error)
  }

  return undefined
}

// Removed pattern-based parameter extraction - using only NER from frontend

function parseNaturalDate(dateStr: string): string | undefined {
  // Basic date parsing - convert "September 9" to "2024-09-09"
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12'
  }
  
  const match = dateStr.match(/([a-zA-Z]+)\s+(\d+)/i)
  if (match) {
    const month = months[match[1].toLowerCase()]
    if (month) {
      const day = match[2].padStart(2, '0')
      const year = new Date().getFullYear()
      return `${year}-${month}-${day}`
    }
  }
  return undefined
}

function getFirstMondayInSeptember(year: number): Date {
  const sept1 = new Date(year, 8, 1) // September 1st
  const dayOfWeek = sept1.getDay()
  const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  return new Date(year, 8, 1 + daysToMonday)
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function extractAmenitiesFromText(text: string): string[] {
  const amenities: string[] = []
  const lowerText = text.toLowerCase()
  
  // Common amenities to extract
  const amenityPatterns = [
    { pattern: /pool/i, amenity: 'Pool' },
    { pattern: /hot\s*tub/i, amenity: 'Hot Tub' },
    { pattern: /kitchen/i, amenity: 'Kitchen' },
    { pattern: /parking/i, amenity: 'Parking' },
    { pattern: /wifi|internet/i, amenity: 'WiFi' },
    { pattern: /gym|fitness/i, amenity: 'Gym' },
    { pattern: /laundry/i, amenity: 'Laundry' },
    { pattern: /air\s*conditioning|a\/c/i, amenity: 'Air Conditioning' },
    { pattern: /heating/i, amenity: 'Heating' },
    { pattern: /balcony/i, amenity: 'Balcony' },
    { pattern: /terrace/i, amenity: 'Terrace' },
    { pattern: /garden/i, amenity: 'Garden' },
    { pattern: /fireplace/i, amenity: 'Fireplace' },
    { pattern: /washer|dryer/i, amenity: 'Washer & Dryer' },
    { pattern: /pet\s*friendly/i, amenity: 'Pet Friendly' },
    { pattern: /wheelchair|accessible/i, amenity: 'Wheelchair Accessible' },
    { pattern: /workspace|office/i, amenity: 'Workspace' },
    { pattern: /tv|television/i, amenity: 'TV' },
    { pattern: /streaming|netflix/i, amenity: 'Streaming Services' },
    { pattern: /waterfall/i, amenity: 'Waterfall' },
    { pattern: /sauna/i, amenity: 'Sauna' },
    { pattern: /massage/i, amenity: 'Massage Chair' },
    { pattern: /bike/i, amenity: 'Bikes' },
    { pattern: /trail/i, amenity: 'Trail Access' }
  ]
  
  for (const { pattern, amenity } of amenityPatterns) {
    if (pattern.test(text)) {
      amenities.push(amenity)
    }
  }
  
  return [...new Set(amenities)] // Remove duplicates
}

function getCityFromAustinCoordinates(lat: number, lng: number): string {
  // Austin neighborhood mapping based on coordinates
  if (lat > 30.32) return 'North Austin'
  if (lat < 30.23) return 'South Austin'
  if (lng < -97.76) return 'West Austin'
  if (lng > -97.72) return 'East Austin'
  if (lat > 30.28 && lat < 30.32) return 'Central Austin'
  if (lat > 30.25 && lat < 30.28) {
    if (lng > -97.75) return 'Downtown Austin'
    return 'Austin'
  }
  return 'Austin'
}