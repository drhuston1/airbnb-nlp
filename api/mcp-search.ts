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

const handler = async (
  req: VercelRequest,
  res: VercelResponse
) => {
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
    
    if (!mcpResult || !mcpResult.searchResults) {
      throw new Error('No search results returned from MCP server')
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
        searchParams,
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }
    })
  }
}

async function callMCPAirbnbSearch(params: any) {
  // Since we're in a Vercel function, we need to call the MCP server via HTTP
  
  console.log('MCP_SERVER_URL:', process.env.MCP_SERVER_URL)
  console.log('Search params:', params)
  
  // Option 1: Call a deployed MCP server endpoint
  if (process.env.MCP_SERVER_URL) {
    const serverUrl = process.env.MCP_SERVER_URL.startsWith('http') 
      ? process.env.MCP_SERVER_URL 
      : `https://${process.env.MCP_SERVER_URL}`
    
    const fullUrl = `${serverUrl}/airbnb-search`
    console.log('Calling MCP server at:', fullUrl)
    
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Function/1.0'
        },
        body: JSON.stringify(params),
        timeout: 30000 // 30 second timeout
      })
      
      console.log('MCP server response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('MCP server error response:', errorText)
        throw new Error(`MCP server responded with ${response.status}: ${response.statusText}. Response: ${errorText}`)
      }
      
      const data = await response.json()
      console.log('MCP server response data keys:', Object.keys(data))
      return data
      
    } catch (fetchError) {
      console.error('Fetch error:', fetchError)
      throw new Error(`Failed to connect to MCP server: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`)
    }
  }

  // Option 2: Use the MCP server directly if running in a compatible environment
  // This would work if you deploy this to a server that has MCP access
  
  // Option 3: For development/testing, simulate the MCP call
  // You would replace this with actual MCP integration
  throw new Error(`
    MCP Server Configuration Required:
    
    To enable real Airbnb search via MCP server, you need to:
    
    1. Deploy an MCP server to a cloud service (Railway, Fly.io, Render, etc.)
    2. Set up an HTTP endpoint that calls the mcp__openbnb-airbnb__airbnb_search function
    3. Add environment variables to your Vercel deployment:
       - MCP_SERVER_URL=https://your-mcp-server.railway.app
       - MCP_SERVER_TOKEN=your-auth-token (optional)
    
    Example MCP server endpoint implementation:
    
    app.post('/airbnb-search', async (req, res) => {
      const result = await mcpClient.callTool({
        name: 'mcp__openbnb-airbnb__airbnb_search',
        arguments: req.body
      })
      res.json(result)
    })
    
    Search parameters received: ${JSON.stringify(params, null, 2)}
  `)
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
        country: location.split(',')[1]?.trim() || 'Unknown'
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

export default handler