interface SearchParams {
  query?: string
  location?: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  infants?: number
  pets?: number
  minPrice?: number
  maxPrice?: number
}

interface AirbnbListing {
  id: string
  name: string
  url: string
  images: string[]
  price: {
    total: number
    rate: number
    currency: string
  }
  rating: number
  reviewsCount: number
  location: {
    city: string
    country: string
  }
  host: {
    name: string
    isSuperhost: boolean
  }
  amenities: string[]
  roomType: string
}


export async function searchAirbnbListings(naturalLanguageQuery: string): Promise<AirbnbListing[]> {
  try {
    // Instead of parsing locally, pass the full natural language query to MCP
    // The OpenBNB MCP server is designed to handle natural language queries directly
    const mcpResponse = await callAirbnbMCPServer({ query: naturalLanguageQuery })
    
    return mcpResponse.map(transformMCPListing)
  } catch (error) {
    console.error('Search failed:', error)
    throw error
  }
}

async function callAirbnbMCPServer(params: SearchParams): Promise<any[]> {
  const response = await fetch('/api/mcp-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: '', // We'll pass the original query if needed
      ...params
    })
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    
    // Handle 501 (MCP server not configured) specifically
    if (response.status === 501) {
      throw new Error('MCP server setup required - see README for instructions')
    }
    
    throw new Error(errorData.error || `Search failed: ${response.statusText}`)
  }

  const data = await response.json()
  return data.listings || []
}

function transformMCPListing(mcpListing: any): AirbnbListing {
  return {
    id: mcpListing.id,
    name: mcpListing.name,
    url: mcpListing.url,
    images: mcpListing.images || ['https://via.placeholder.com/400x300'],
    price: mcpListing.price,
    rating: mcpListing.rating,
    reviewsCount: mcpListing.reviewsCount,
    location: mcpListing.location,
    host: mcpListing.host,
    amenities: mcpListing.amenities || [],
    roomType: mcpListing.roomType
  }
}

export type { AirbnbListing, SearchParams }