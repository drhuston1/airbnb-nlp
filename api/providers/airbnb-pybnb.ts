import type { ProviderParams } from './airbnb'

export async function searchAirbnbPybnb(params: ProviderParams) {
  const base = process.env.PYBNB_URL
  if (!base) {
    throw new Error('PYBNB_URL not configured')
  }

  const url = `${base.replace(/\/$/, '')}/search`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`pybnb service ${resp.status}: ${resp.statusText}${text ? ` - ${text.slice(0,160)}` : ''}`)
  }
  const data = await resp.json()
  const items = Array.isArray(data.results) ? data.results : Array.isArray(data.properties) ? data.properties : []
  return items.map((p: any) => ({
    id: p.id || p.listing_id || p.code,
    name: p.name || p.title,
    url: p.url || (p.id ? `https://www.airbnb.com/rooms/${p.id}` : '#'),
    images: p.images || p.photos || [],
    price: p.price || { total: p.rate || 0, rate: p.rate || 0, currency: p.currency || 'USD' },
    rating: p.rating || p.avg_rating || 0,
    reviewsCount: p.reviewsCount || p.reviews_count || 0,
    location: p.location || { city: p.city || 'Unknown', country: p.country || '' },
    host: p.host || { name: 'Host', isSuperhost: !!p.is_superhost },
    amenities: p.amenities || [],
    roomType: p.roomType || p.room_type || 'Property',
    propertyType: p.propertyType || p.space_type,
    platform: 'airbnb',
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    beds: p.beds,
    maxGuests: p.maxGuests || p.person_capacity,
    trustScore: p.trustScore || 0,
  }))
}

