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

    // If we have a natural language query, use that directly
    // Otherwise fall back to the parsed parameters
    const searchParams = query ? 
      { query, page, ignoreRobotsText: true } :
      {
        location,
        adults,
        children,
        infants,
        pets,
        page,
        ...(checkin && { checkin }),
        ...(checkout && { checkout }),
        ...(minPrice && { minPrice }),
        ...(maxPrice && { maxPrice }),
        ignoreRobotsText: true
      }

    if (!query && !location) {
      return res.status(400).json({ error: 'Query or location is required' })
    }

    console.log('Calling MCP server with params:', searchParams)

    // Call the MCP server
    const mcpResult = await callMCPAirbnbSearch(searchParams)
    
    console.log('MCP Result received:', JSON.stringify(mcpResult, null, 2))
    
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
      name: listing.demandStayListing?.description?.name?.localizedStringWithTranslationPreference,
      url: listing.url,
      images: listing.images,
      price: {
        total: totalPrice,
        rate: nightlyRate,
        currency: 'USD'
      },
      rating,
      reviewsCount,
      location: {
        city: city,
        country: 'US'
      },
      host: {
        name: listing.host?.name,
        isSuperhost
      },
      amenities: listing.amenities,
      roomType: listing.roomType
    }
  }))
}

async function getCityFromCoordinates(lat?: number, lng?: number): Promise<string> {
  if (!lat || !lng) return undefined

  try {
    // Try OpenStreetMap Nominatim reverse geocoding (free, no API key required)
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
      
      // Extract city from various possible fields
      const city = address?.city || 
                   address?.town || 
                   address?.village || 
                   address?.municipality ||
                   address?.county
      
      if (city) {
        return city
      }
    }
  } catch (error) {
    console.log('Reverse geocoding failed, using fallback:', error)
  }

  // Fallback to extensive coordinate lookup
  return getCityFromCoordinatesFallback(lat, lng)
}

function getCityFromCoordinatesFallback(lat: number, lng: number): string {
  // Comprehensive US cities with coordinate ranges
  const cityBounds = [
    // Major Texas Cities
    { name: 'Austin', latMin: 30.1, latMax: 30.5, lngMin: -97.9, lngMax: -97.6 },
    { name: 'San Antonio', latMin: 29.3, latMax: 29.6, lngMin: -98.7, lngMax: -98.3 },
    { name: 'Houston', latMin: 29.6, latMax: 30.0, lngMin: -95.8, lngMax: -95.0 },
    { name: 'Dallas', latMin: 32.6, latMax: 33.0, lngMin: -96.9, lngMax: -96.6 },
    { name: 'Fort Worth', latMin: 32.6, latMax: 32.8, lngMin: -97.5, lngMax: -97.2 },
    
    // California Cities
    { name: 'Los Angeles', latMin: 33.9, latMax: 34.3, lngMin: -118.7, lngMax: -118.1 },
    { name: 'Malibu', latMin: 34.0, latMax: 34.1, lngMin: -118.9, lngMax: -118.6 },
    { name: 'San Diego', latMin: 32.6, latMax: 32.8, lngMin: -117.3, lngMax: -117.1 },
    { name: 'San Francisco', latMin: 37.7, latMax: 37.8, lngMin: -122.5, lngMax: -122.4 },
    { name: 'Oakland', latMin: 37.7, latMax: 37.8, lngMin: -122.3, lngMax: -122.2 },
    { name: 'Sacramento', latMin: 38.5, latMax: 38.6, lngMin: -121.6, lngMax: -121.4 },
    { name: 'Fresno', latMin: 36.7, latMax: 36.8, lngMin: -119.8, lngMax: -119.7 },
    
    // Major East Coast
    { name: 'New York', latMin: 40.6, latMax: 40.9, lngMin: -74.1, lngMax: -73.9 },
    { name: 'Boston', latMin: 42.3, latMax: 42.4, lngMin: -71.1, lngMax: -71.0 },
    { name: 'Philadelphia', latMin: 39.9, latMax: 40.0, lngMin: -75.2, lngMax: -75.1 },
    { name: 'Washington DC', latMin: 38.8, latMax: 38.9, lngMin: -77.1, lngMax: -77.0 },
    { name: 'Miami', latMin: 25.7, latMax: 25.8, lngMin: -80.3, lngMax: -80.1 },
    { name: 'Orlando', latMin: 28.4, latMax: 28.6, lngMin: -81.4, lngMax: -81.2 },
    { name: 'Tampa', latMin: 27.9, latMax: 28.0, lngMin: -82.5, lngMax: -82.4 },
    
    // Midwest
    { name: 'Chicago', latMin: 41.6, latMax: 42.1, lngMin: -87.9, lngMax: -87.5 },
    { name: 'Detroit', latMin: 42.3, latMax: 42.4, lngMin: -83.1, lngMax: -83.0 },
    { name: 'Milwaukee', latMin: 43.0, latMax: 43.1, lngMin: -87.9, lngMax: -87.8 },
    { name: 'Minneapolis', latMin: 44.9, latMax: 45.0, lngMin: -93.3, lngMax: -93.2 },
    { name: 'St. Louis', latMin: 38.6, latMax: 38.7, lngMin: -90.3, lngMax: -90.2 },
    { name: 'Kansas City', latMin: 39.0, latMax: 39.1, lngMin: -94.6, lngMax: -94.5 },
    
    // Mountain West
    { name: 'Denver', latMin: 39.6, latMax: 39.8, lngMin: -105.1, lngMax: -104.8 },
    { name: 'Las Vegas', latMin: 36.0, latMax: 36.3, lngMin: -115.3, lngMax: -115.0 },
    { name: 'Phoenix', latMin: 33.4, latMax: 33.5, lngMin: -112.1, lngMax: -112.0 },
    { name: 'Salt Lake City', latMin: 40.7, latMax: 40.8, lngMin: -111.9, lngMax: -111.8 },
    { name: 'Albuquerque', latMin: 35.0, latMax: 35.1, lngMin: -106.7, lngMax: -106.6 },
    
    // Pacific Northwest
    { name: 'Seattle', latMin: 47.5, latMax: 47.7, lngMin: -122.4, lngMax: -122.2 },
    { name: 'Portland', latMin: 45.4, latMax: 45.6, lngMin: -122.8, lngMax: -122.5 },
    
    // South
    { name: 'Atlanta', latMin: 33.7, latMax: 33.8, lngMin: -84.4, lngMax: -84.3 },
    { name: 'Nashville', latMin: 36.1, latMax: 36.2, lngMin: -86.8, lngMax: -86.7 },
    { name: 'New Orleans', latMin: 29.9, latMax: 30.0, lngMin: -90.1, lngMax: -90.0 },
    { name: 'Charlotte', latMin: 35.2, latMax: 35.3, lngMin: -80.9, lngMax: -80.8 },
    
    // Tourist destinations
    { name: 'Asheville', latMin: 35.5, latMax: 35.6, lngMin: -82.6, lngMax: -82.5 },
    { name: 'Savannah', latMin: 32.0, latMax: 32.1, lngMin: -81.1, lngMax: -81.0 },
    { name: 'Key West', latMin: 24.5, latMax: 24.6, lngMin: -81.8, lngMax: -81.7 },
    { name: 'Park City', latMin: 40.6, latMax: 40.7, lngMin: -111.5, lngMax: -111.4 },
  ]

  for (const city of cityBounds) {
    if (lat >= city.latMin && lat <= city.latMax && lng >= city.lngMin && lng <= city.lngMax) {
      return city.name
    }
  }

  return undefined
}