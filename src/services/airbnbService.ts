interface SearchParams {
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

function parseNaturalLanguageQuery(query: string): SearchParams {
  const params: SearchParams = {
    location: ''
  }

  // Extract location patterns
  const locationPatterns = [
    /(?:in|at|near)\s+([^,\n]+?)(?:\s+(?:for|with|from|to|under|over|max|min|\d))/i,
    /(?:in|at|near)\s+([^,\n]+)$/i,
    /^([^,\n]+?)(?:\s+(?:for|with|from|to|under|over|max|min))/i
  ]

  for (const pattern of locationPatterns) {
    const match = query.match(pattern)
    if (match) {
      params.location = match[1].trim()
      break
    }
  }

  // If no pattern matched, try to extract location before price keywords
  if (!params.location) {
    const beforePrice = query.match(/^([^,\n]+?)(?:\s+(?:under|over|max|min|for)\s)/i)
    if (beforePrice) {
      params.location = beforePrice[1].trim()
    } else {
      // Fallback: use everything before the first price/number
      const beforeNumber = query.match(/^([^,\n]+?)(?:\s+\$?\d)/i)
      if (beforeNumber) {
        params.location = beforeNumber[1].trim()
      } else {
        // Last resort: use the whole query
        params.location = query.trim()
      }
    }
  }

  // Extract guest count
  const guestMatch = query.match(/(\d+)\s*(?:guest|people|person|adult)/i)
  if (guestMatch) {
    params.adults = parseInt(guestMatch[1])
  }

  const childrenMatch = query.match(/(\d+)\s*(?:child|children|kid)/i)
  if (childrenMatch) {
    params.children = parseInt(childrenMatch[1])
  }

  // Extract price range
  const priceMatch = query.match(/(?:under|below|less than|max|maximum)\s*\$?(\d+)/i)
  if (priceMatch) {
    params.maxPrice = parseInt(priceMatch[1])
  }

  const minPriceMatch = query.match(/(?:over|above|more than|min|minimum)\s*\$?(\d+)/i)
  if (minPriceMatch) {
    params.minPrice = parseInt(minPriceMatch[1])
  }

  // Extract dates (basic patterns)
  const checkinMatch = query.match(/(?:check[- ]?in|from|starting)\s+([a-zA-Z]+\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{4})?)/i)
  if (checkinMatch) {
    // Would need proper date parsing here
    params.checkin = checkinMatch[1]
  }

  return params
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