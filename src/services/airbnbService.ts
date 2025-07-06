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
  page?: number
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

export async function searchAirbnbListings(naturalLanguageQuery: string, page: number = 1): Promise<AirbnbListing[]> {
  try {
    // Call our API endpoint which handles MCP transformation
    const response = await fetch('/api/mcp-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: naturalLanguageQuery,
        page
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `Search failed: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('API Response received:', JSON.stringify(data, null, 2))
    
    // The API already returns properly formatted listings
    return data.listings || []
  } catch (error) {
    console.error('Search failed:', error)
    throw error
  }
}

export type { AirbnbListing, SearchParams }