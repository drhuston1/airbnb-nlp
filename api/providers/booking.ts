// Booking.com adapter using SerpAPI (optional) or returns empty when not configured

export interface ProviderParams {
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  priceMin?: number
  priceMax?: number
  page?: number
}

export async function searchBooking(params: ProviderParams) {
  const serpKey = process.env.SERPAPI_KEY
  if (!serpKey) {
    return []
  }

  const qs = new URLSearchParams({
    engine: 'google_hotels',
    q: params.location,
    hl: 'en',
    gl: 'us',
    check_in_date: params.checkin || '',
    check_out_date: params.checkout || '',
    currency: 'USD',
    api_key: serpKey,
  })

  const url = `https://serpapi.com/search.json?${qs.toString()}`
  const resp = await fetch(url)
  if (!resp.ok) return []
  const data = await resp.json()

  const hotels = data?.properties || []
  return hotels.slice(0, 20).map((h: any) => ({
    id: h.hotel_id || h.place_id || h.title,
    name: h.name || h.title || 'Hotel',
    url: h.booking_link || h.link || h.maps_module?.link || '#',
    images: h.images?.map((i: any) => i.thumbnail) || [],
    price: {
      total: h.rate_per_night?.lowest || h.price?.lowest || 0,
      rate: h.rate_per_night?.lowest || h.price?.lowest || 0,
      currency: h.rate_per_night?.currency || 'USD',
    },
    rating: h.overall_rating || h.rating || 0,
    reviewsCount: h.reviews || 0,
    location: {
      city: h.address?.city || params.location,
      country: h.address?.country || '',
    },
    host: {
      name: 'Booking.com',
      isSuperhost: false,
    },
    amenities: [],
    roomType: 'Hotel',
    propertyType: 'Hotel',
    platform: 'booking',
    trustScore: h.overall_rating ? Math.round((h.overall_rating / 5) * 100) : 0,
  }))
}
