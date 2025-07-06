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
  console.log('MCP Result received:', JSON.stringify(data, null, 2))
  return data.searchResults || data.listings || []
}

function transformMCPListing(mcpListing: any): AirbnbListing {
  console.log('Transforming MCP listing:', mcpListing)
  
  // Extract the actual property name from the nested structure
  const propertyName = mcpListing.demandStayListing?.description?.name?.localizedStringWithTranslationPreference 
    || mcpListing.name 
    || 'Property listing'

  // Extract rating from the avgRatingA11yLabel (e.g., "4.97 out of 5 average rating, 164 reviews")
  let rating = 0
  let reviewsCount = 0
  if (mcpListing.avgRatingA11yLabel) {
    if (mcpListing.avgRatingA11yLabel === 'New place to stay') {
      rating = 0 // New listings have no rating yet
      reviewsCount = 0
    } else {
      const ratingMatch = mcpListing.avgRatingA11yLabel.match(/(\d+\.?\d*) out of 5/)
      const reviewMatch = mcpListing.avgRatingA11yLabel.match(/(\d+) reviews?/)
      if (ratingMatch) rating = parseFloat(ratingMatch[1])
      if (reviewMatch) reviewsCount = parseInt(reviewMatch[1])
    }
  }

  // Extract price from structuredDisplayPrice - handle various formats
  let priceRate = 0
  if (mcpListing.structuredDisplayPrice?.explanationData?.priceDetails) {
    // Match patterns like "$184.71 x 5 nights" or "$198.89 x 7 nights"
    const priceMatch = mcpListing.structuredDisplayPrice.explanationData.priceDetails.match(/\$(\d+\.?\d*)\s*x\s*\d+\s*nights?/)
    if (priceMatch) {
      priceRate = parseFloat(priceMatch[1])
    }
  }
  
  // Fallback: try to extract from accessibilityLabel if priceDetails didn't work
  if (priceRate === 0 && mcpListing.structuredDisplayPrice?.primaryLine?.accessibilityLabel) {
    // Match patterns like "$924 for 5 nights" and calculate nightly rate
    const totalMatch = mcpListing.structuredDisplayPrice.primaryLine.accessibilityLabel.match(/\$(\d+(?:,\d{3})*)\s*for\s*(\d+)\s*nights?/)
    if (totalMatch) {
      const totalPrice = parseFloat(totalMatch[1].replace(',', ''))
      const nights = parseInt(totalMatch[2])
      if (nights > 0) {
        priceRate = totalPrice / nights
      }
    }
  }

  // Extract location - use coordinates to determine city (basic implementation)
  let city = 'Unknown City'
  if (mcpListing.demandStayListing?.location?.coordinate) {
    const lat = mcpListing.demandStayListing.location.coordinate.latitude
    const lng = mcpListing.demandStayListing.location.coordinate.longitude
    
    // Basic city detection based on coordinates (for San Antonio area)
    if (lat >= 29.4 && lat <= 29.7 && lng >= -98.7 && lng <= -98.3) {
      city = 'San Antonio'
    } else {
      city = 'Texas'
    }
  }
  
  const location = {
    city: city,
    country: 'US'
  }

  // Extract superhost status from badges
  const isSuperhost = mcpListing.badges?.includes('Superhost') || false

  // Determine room type based on property name and other clues
  let roomType = 'Entire home/apt' // Default
  const nameLower = propertyName.toLowerCase()
  if (nameLower.includes('private room') || nameLower.includes('bedroom') || nameLower.includes('queen bed')) {
    roomType = 'Private room'
  } else if (nameLower.includes('studio')) {
    roomType = 'Entire home/apt'
  }

  return {
    id: mcpListing.id,
    name: propertyName,
    url: mcpListing.url,
    images: mcpListing.images || ['https://via.placeholder.com/400x300'],
    price: {
      total: priceRate * 5, // Assume 5 nights for total
      rate: Math.round(priceRate), // Round to nearest dollar
      currency: 'USD'
    },
    rating: rating,
    reviewsCount: reviewsCount,
    location: location,
    host: {
      name: 'Host',
      isSuperhost: isSuperhost
    },
    amenities: mcpListing.amenities || [],
    roomType: roomType
  }
}

export type { AirbnbListing, SearchParams }