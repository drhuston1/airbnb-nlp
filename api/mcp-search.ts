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
    const { query, location, adults = 1, children = 0, infants = 0, pets = 0, checkin, checkout, minPrice, maxPrice, page = 1 }: SearchRequest = req.body

    const searchParams = {
      location: query || location,
      adults,
      children: children + infants,
      page,
      ignoreRobotsText: true,
      ...(checkin && { checkin }),
      ...(checkout && { checkout }),
      ...(minPrice && { minPrice }),
      ...(maxPrice && { maxPrice })
    }

    if (!query && !location) {
      return res.status(400).json({ error: 'Query or location is required' })
    }

    console.log('Calling MCP server with params:', searchParams)

    // Call the MCP server
    const mcpResult = await callMCPAirbnbSearch(searchParams)
    
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
    const listings = await transformMCPResults(mcpResult.searchResults, query || location)

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

async function callMCPAirbnbSearch(params: any) {
  console.log('Calling Railway MCP server with params:', params)
  
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://airbnb-nlp-production.up.railway.app'
  
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
      throw new Error(`MCP server error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    return result
    
  } catch (error) {
    console.error('Railway MCP server call failed:', error)
    throw error
  }
}

async function transformMCPResults(searchResults: AirbnbSearchResult[], searchQuery: string) {
  return Promise.all(searchResults.map(async (listing, index) => {
    // Extract price from the accessibility label
    const priceMatch = listing.structuredDisplayPrice?.primaryLine?.accessibilityLabel?.match(/\$(\d+(?:,\d+)*)/g)
    const priceNumbers = priceMatch ? priceMatch.map(p => parseInt(p.replace(/[$,]/g, ''))) : [100]
    const totalPrice = priceNumbers[0] || 100
    const nightlyRate = priceNumbers.length > 1 ? Math.round(totalPrice / 5) : totalPrice // Assume 5 nights if total given

    // Extract rating
    const ratingMatch = listing.avgRatingA11yLabel?.match(/([\d.]+)\s+out\s+of\s+5/)
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.0

    // Extract review count
    const reviewMatch = listing.avgRatingA11yLabel?.match(/(\d+)\s+review/)
    const reviewsCount = reviewMatch ? parseInt(reviewMatch[1]) : 0

    // Determine if superhost
    const isSuperhost = listing.badges?.toLowerCase().includes('superhost') || false
    const isGuestFavorite = listing.badges?.toLowerCase().includes('guest favorite') || false

    // Extract city from coordinates
    const lat = listing.demandStayListing?.location?.coordinate?.latitude
    const lng = listing.demandStayListing?.location?.coordinate?.longitude
    const city = await getCityFromCoordinates(lat, lng)

    return {
      id: listing.id,
      name: listing.demandStayListing?.description?.name?.localizedStringWithTranslationPreference || 'Property',
      url: listing.url,
      images: [],
      price: {
        total: totalPrice,
        rate: nightlyRate,
        currency: 'USD'
      },
      rating,
      reviewsCount,
      location: {
        city: city || 'Unknown',
        country: 'US'
      },
      host: {
        name: 'Host',
        isSuperhost
      },
      amenities: [],
      roomType: listing.structuredContent?.primaryLine || 'Property'
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