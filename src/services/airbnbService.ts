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
      
      // If API fails in development, fall back to mock data for testing
      if (window.location.hostname === 'localhost') {
        console.log('API failed, using mock data for development:', naturalLanguageQuery)
        return getMockListings(naturalLanguageQuery, page)
      }
      
      throw new Error(errorData.error || `Search failed: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('API Response received:', JSON.stringify(data, null, 2))
    
    // The API already returns properly formatted listings
    return data.listings || []
  } catch (error) {
    console.error('Search failed:', error)
    
    // If we're in development and the error is network-related, use mock data
    if (window.location.hostname === 'localhost' && error instanceof TypeError) {
      console.log('Network error in development, using mock data:', naturalLanguageQuery)
      return getMockListings(naturalLanguageQuery, page)
    }
    
    throw error
  }
}

function getMockListings(query: string, page: number): AirbnbListing[] {
  const baseListings = [
    {
      id: '1',
      name: 'Luxury Beachfront Villa in Malibu',
      url: 'https://airbnb.com/rooms/1',
      images: ['https://picsum.photos/600/400?random=1'],
      price: { total: 1500, rate: 300, currency: 'USD' },
      rating: 4.9,
      reviewsCount: 127,
      location: { city: 'Malibu', country: 'US' },
      host: { name: 'Sarah', isSuperhost: true },
      amenities: ['Pool', 'Hot tub', 'Beach access'],
      roomType: 'Entire home/apt'
    },
    {
      id: '2',
      name: 'Cozy Cabin Near Yellowstone',
      url: 'https://airbnb.com/rooms/2',
      images: ['https://picsum.photos/600/400?random=2'],
      price: { total: 750, rate: 150, currency: 'USD' },
      rating: 4.8,
      reviewsCount: 89,
      location: { city: 'West Yellowstone', country: 'US' },
      host: { name: 'Mike', isSuperhost: true },
      amenities: ['Pet friendly', 'Fireplace', 'Hiking nearby'],
      roomType: 'Entire home/apt'
    },
    {
      id: '3',
      name: 'Modern Downtown Loft',
      url: 'https://airbnb.com/rooms/3',
      images: ['https://picsum.photos/600/400?random=3'],
      price: { total: 1000, rate: 200, currency: 'USD' },
      rating: 4.7,
      reviewsCount: 156,
      location: { city: 'Chicago', country: 'US' },
      host: { name: 'Jennifer', isSuperhost: false },
      amenities: ['Parking', 'City view', 'WiFi'],
      roomType: 'Entire home/apt'
    }
  ]

  // Simple filtering based on query
  const filtered = baseListings.filter(listing => {
    const searchTerms = query.toLowerCase()
    const matchesName = listing.name.toLowerCase().includes(searchTerms)
    const matchesLocation = listing.location.city.toLowerCase().includes(searchTerms)
    return matchesName || matchesLocation || searchTerms.includes(listing.location.city.toLowerCase())
  })

  return filtered.length > 0 ? filtered : baseListings
}

export type { AirbnbListing, SearchParams }