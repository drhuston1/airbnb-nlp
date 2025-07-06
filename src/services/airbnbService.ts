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
    // Instead of parsing locally, pass the full natural language query to MCP
    // The OpenBNB MCP server is designed to handle natural language queries directly
    const mcpResponse = await callAirbnbMCPServer({ query: naturalLanguageQuery, page })
    
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
  // Extract the actual property name from the nested structure
  const propertyName = mcpListing.demandStayListing?.description?.name?.localizedStringWithTranslationPreference 
    || mcpListing.name 
    || 'Property listing'

  // Extract rating from the avgRatingA11yLabel (e.g., "4.97 out of 5 average rating, 164 reviews")
  let rating = 0
  let reviewsCount = 0
  if (mcpListing.avgRatingA11yLabel) {
    const ratingMatch = mcpListing.avgRatingA11yLabel.match(/(\d+\.?\d*) out of 5/)
    const reviewMatch = mcpListing.avgRatingA11yLabel.match(/(\d+) reviews?/)
    if (ratingMatch) rating = parseFloat(ratingMatch[1])
    if (reviewMatch) reviewsCount = parseInt(reviewMatch[1])
  }

  // Extract price from structuredDisplayPrice
  let priceRate = 0
  if (mcpListing.structuredDisplayPrice?.explanationData?.priceDetails) {
    const priceMatch = mcpListing.structuredDisplayPrice.explanationData.priceDetails.match(/\$(\d+\.?\d*)/)
    if (priceMatch) priceRate = parseFloat(priceMatch[1])
  }

  // Extract location from coordinates (we'll need to reverse geocode or use a default)
  const location = {
    city: mcpListing.location?.city || 'Unknown City',
    country: mcpListing.location?.country || 'US'
  }

  return {
    id: mcpListing.id,
    name: propertyName,
    url: mcpListing.url,
    images: mcpListing.images || ['https://via.placeholder.com/400x300'],
    price: {
      total: priceRate * 5, // Assume 5 nights for total
      rate: priceRate,
      currency: 'USD'
    },
    rating: rating,
    reviewsCount: reviewsCount,
    location: location,
    host: {
      name: mcpListing.host?.name || 'Host',
      isSuperhost: mcpListing.badges?.includes('Superhost') || false
    },
    amenities: mcpListing.amenities || [],
    roomType: mcpListing.roomType || 'Entire home/apt'
  }
}

export type { AirbnbListing, SearchParams }