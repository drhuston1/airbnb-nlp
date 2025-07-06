// Booking.com API integration for vacation rentals and accommodations
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface BookingSearchRequest {
  query: string
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  page?: number
}

interface BookingProperty {
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
  platform: 'booking.com'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, location, checkin, checkout, adults = 2, children = 0, page = 1 }: BookingSearchRequest = req.body

    console.log('Booking.com search request:', { query, location, checkin, checkout, adults, children, page })

    // Check for required parameters
    if (!location) {
      return res.status(400).json({ error: 'Location is required for Booking.com search' })
    }

    // Real Booking.com API implementation
    const bookingResults = await searchBookingProperties({
      location,
      adults,
      children,
      checkin,
      checkout,
      page
    })

    const response = {
      listings: bookingResults,
      hasMore: page < 3, // Adjust based on API response
      totalResults: bookingResults.length,
      page,
      source: 'booking.com',
      searchUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(location)}`
    }

    console.log(`Booking.com API response: ${bookingResults.length} properties`)
    
    return res.status(200).json(response)

  } catch (error) {
    console.error('Booking.com search error:', error)
    return res.status(500).json({ 
      error: 'Failed to search Booking.com properties',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Mock data removed - using real API only

// Real Booking.com Demand API integration
async function searchBookingProperties(params: BookingSearchRequest): Promise<BookingProperty[]> {
  const BOOKING_API_KEY = process.env.BOOKING_API_KEY
  const BOOKING_ENDPOINT = process.env.BOOKING_API_ENDPOINT || 'https://accommodations.booking.com/v1/accommodations/accommodations'
  
  if (!BOOKING_API_KEY) {
    throw new Error('BOOKING_API_KEY environment variable is required')
  }
  
  // Format dates for Booking.com Demand API
  const checkinDate = params.checkin || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const checkoutDate = params.checkout || new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  
  const requestBody = {
    queryParams: {
      location: params.location,
      checkin: checkinDate,
      checkout: checkoutDate,
      adults: params.adults || 2,
      children: params.children || 0,
      limit: 20,
      offset: params.page ? (params.page - 1) * 20 : 0,
      currency: 'USD',
      language: 'en'
    }
  }
  
  console.log('Calling Booking.com Demand API:', BOOKING_ENDPOINT, 'with body:', requestBody)
  
  const response = await fetch(BOOKING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BOOKING_API_KEY}`,
      'User-Agent': 'ChatBnb/1.0'
    },
    body: JSON.stringify(requestBody)
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Booking.com Demand API error: ${response.status} - ${response.statusText} - ${errorText}`)
  }
  
  const data = await response.json()
  return transformBookingResponse(data.accommodations || data.results || [])
}

// Transform Booking.com Demand API response to our unified format
function transformBookingResponse(bookingResults: any[]): BookingProperty[] {
  return bookingResults.map((property: any) => ({
    id: property.accommodationId || property.id || 'unknown',
    name: property.name || property.accommodationName || 'Property',
    url: property.bookingUrl || property.url || `https://www.booking.com/hotel/us/${property.accommodationId}.html`,
    images: property.images?.map((img: any) => img.url || img.large || img.medium) || [],
    price: {
      total: property.priceDetails?.totalPrice || property.price?.total || 200,
      rate: property.priceDetails?.nightlyRate || property.price?.rate || 100,
      currency: property.priceDetails?.currency || property.currency || 'USD'
    },
    rating: property.rating?.average || property.reviewScore || 8.0,
    reviewsCount: property.rating?.reviewCount || property.reviewCount || 50,
    location: {
      city: property.location?.city || property.city || 'Unknown',
      country: property.location?.country || property.country || 'US'
    },
    host: {
      name: property.accommodationType || 'Property Manager',
      isSuperhost: property.isPreferredPartner || false
    },
    amenities: extractAmenitiesFromBooking(property.amenities || property.facilities || []),
    roomType: property.accommodationType || property.roomType || 'Property',
    platform: 'booking.com' as const
  }))
}

// Extract amenities from Booking.com facilities
function extractAmenitiesFromBooking(facilities: any[]): string[] {
  const amenityMap: Record<string, string> = {
    'Swimming pool': 'Pool',
    'Hot tub': 'Hot Tub', 
    'Kitchen': 'Kitchen',
    'Parking': 'Parking',
    'WiFi': 'WiFi',
    'Fitness': 'Gym',
    'Laundry': 'Laundry',
    'Air conditioning': 'Air Conditioning'
  }
  
  return facilities
    .map((facility: any) => amenityMap[facility.name] || facility.name)
    .filter(Boolean)
    .slice(0, 5) // Limit to 5 amenities
}