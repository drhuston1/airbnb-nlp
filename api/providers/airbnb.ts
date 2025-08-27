import { callAirbnbHttpAPI } from '../airbnb-api'

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

export async function searchAirbnb(params: ProviderParams) {
  const result = await callAirbnbHttpAPI(params)
  return (result.properties || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    url: p.url,
    images: p.images || [],
    price: p.price,
    rating: p.rating || 0,
    reviewsCount: p.reviewsCount || 0,
    location: p.location,
    host: p.host,
    amenities: p.amenities || [],
    roomType: p.roomType || 'Property',
    propertyType: p.propertyType,
    platform: 'airbnb',
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    beds: p.beds,
    maxGuests: p.maxGuests,
    trustScore: p.trustScore || 0,
  }))
}

