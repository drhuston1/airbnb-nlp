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
    const { location, adults = 1, children = 0, infants = 0, pets = 0, checkin, checkout, minPrice, maxPrice }: SearchRequest = req.body

    if (!location) {
      return res.status(400).json({ error: 'Location is required' })
    }

    // Build search parameters for MCP
    const searchParams = {
      location,
      adults,
      children,
      infants,
      pets,
      ...(checkin && { checkin }),
      ...(checkout && { checkout }),
      ...(minPrice && { minPrice }),
      ...(maxPrice && { maxPrice }),
      ignoreRobotsText: true // Required for Airbnb scraping
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
    const listings = transformMCPResults(mcpResult.searchResults, location)

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
        searchParams: searchParams,
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

function transformMCPResults(searchResults: AirbnbSearchResult[], location: string) {
  return searchResults.map((listing, index) => {
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

    return {
      id: listing.id,
      name: listing.demandStayListing?.description?.name?.localizedStringWithTranslationPreference || `Property in ${location}`,
      url: listing.url,
      images: [
        `https://picsum.photos/600/400?random=${Date.now() + index}` // Placeholder since images aren't in the MCP response
      ],
      price: {
        total: totalPrice,
        rate: nightlyRate,
        currency: 'USD'
      },
      rating,
      reviewsCount,
      location: {
        city: location.split(',')[0]?.trim() || location,
        country: location.split(',')[1]?.trim() || ''
      },
      host: {
        name: 'Host', // MCP response doesn't include host name
        isSuperhost
      },
      amenities: [], // Would need to call airbnb_listing_details for full amenities
      roomType: listing.structuredContent?.primaryLine || 'Property',
      badges: listing.badges,
      isGuestFavorite,
      coordinates: {
        latitude: listing.demandStayListing?.location?.coordinate?.latitude,
        longitude: listing.demandStayListing?.location?.coordinate?.longitude
      }
    }
  })
}