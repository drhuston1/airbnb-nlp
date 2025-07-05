// Demo search using real location data and generated realistic listings
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface SearchRequest {
  query: string
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { location, adults = 1, children = 0, checkin, checkout, minPrice = 50, maxPrice = 500 }: SearchRequest = req.body

    if (!location) {
      return res.status(400).json({ error: 'Location is required' })
    }

    // Get real location data from a geocoding API
    const locationData = await getLocationData(location)
    
    // Generate realistic listings based on location
    const listings = await generateRealisticListings(locationData, { adults, children, minPrice, maxPrice })

    return res.status(200).json({
      listings,
      searchUrl: `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes`,
      totalResults: listings.length,
      locationData,
      note: 'Demo data - realistic listings generated based on location and search parameters'
    })

  } catch (error) {
    console.error('Demo search error:', error)
    return res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function getLocationData(location: string) {
  try {
    // Use OpenStreetMap Nominatim API (free, no API key required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Airbnb-NLP-Demo/1.0'
        }
      }
    )
    
    const data = await response.json()
    
    if (data && data.length > 0) {
      const place = data[0]
      return {
        city: place.address?.city || place.address?.town || place.address?.village || location,
        country: place.address?.country || 'Unknown',
        state: place.address?.state || place.address?.province || '',
        latitude: parseFloat(place.lat),
        longitude: parseFloat(place.lon),
        displayName: place.display_name
      }
    }
    
    // Fallback if geocoding fails
    return {
      city: location.split(',')[0]?.trim() || location,
      country: location.split(',')[1]?.trim() || 'Unknown',
      state: '',
      latitude: 0,
      longitude: 0,
      displayName: location
    }
  } catch (error) {
    console.error('Geocoding error:', error)
    return {
      city: location,
      country: 'Unknown',
      state: '',
      latitude: 0,
      longitude: 0,
      displayName: location
    }
  }
}

async function generateRealisticListings(locationData: any, searchParams: any): Promise<AirbnbListing[]> {
  const { adults, children, minPrice, maxPrice } = searchParams
  const { city, country } = locationData
  
  // Property types and their typical characteristics
  const propertyTypes = [
    { type: 'Entire apartment', avgPrice: 120, nameTemplates: ['Modern', 'Cozy', 'Stylish', 'Bright'] },
    { type: 'Entire house', avgPrice: 200, nameTemplates: ['Beautiful', 'Charming', 'Spacious', 'Family'] },
    { type: 'Private room', avgPrice: 60, nameTemplates: ['Comfortable', 'Clean', 'Quiet', 'Central'] },
    { type: 'Shared room', avgPrice: 35, nameTemplates: ['Budget', 'Social', 'Friendly', 'Basic'] },
    { type: 'Entire villa', avgPrice: 400, nameTemplates: ['Luxury', 'Stunning', 'Exclusive', 'Premium'] },
    { type: 'Studio', avgPrice: 80, nameTemplates: ['Compact', 'Efficient', 'Minimalist', 'Urban'] }
  ]

  const amenities = [
    'WiFi', 'Kitchen', 'Air conditioning', 'Heating', 'Washer', 'Dryer', 'TV', 'Parking',
    'Hot tub', 'Pool', 'Gym', 'Balcony', 'Garden', 'Fireplace', 'Breakfast', 'Laptop workspace',
    'Pet friendly', 'Smoking allowed', 'Suitable for events', 'Family friendly'
  ]

  const hostNames = [
    'Sarah', 'Michael', 'Emma', 'David', 'Lisa', 'John', 'Maria', 'Chris', 'Anna', 'James',
    'Sophie', 'Daniel', 'Rachel', 'Tom', 'Julia', 'Mark', 'Nina', 'Paul', 'Kate', 'Alex'
  ]

  // Generate 8-15 listings
  const numListings = Math.floor(Math.random() * 8) + 8
  const listings: AirbnbListing[] = []

  for (let i = 0; i < numListings; i++) {
    const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)]
    const nameTemplate = propertyType.nameTemplates[Math.floor(Math.random() * propertyType.nameTemplates.length)]
    
    // Price influenced by property type, location, and search params
    const basePrice = propertyType.avgPrice
    const priceVariation = (Math.random() - 0.5) * 0.4 // ±20% variation
    const groupSizeMultiplier = Math.max(1, (adults + children) * 0.15) // More people = higher price
    const locationMultiplier = getLocationPriceMultiplier(city, country)
    
    let finalPrice = Math.round(basePrice * (1 + priceVariation) * groupSizeMultiplier * locationMultiplier)
    
    // Ensure price is within search range
    finalPrice = Math.max(minPrice, Math.min(maxPrice, finalPrice))

    const listing: AirbnbListing = {
      id: `demo_${Math.random().toString(36).substr(2, 9)}`,
      name: `${nameTemplate} ${propertyType.type.toLowerCase()} in ${city}`,
      url: `https://www.airbnb.com/rooms/demo_${i}`,
      images: [
        `https://picsum.photos/600/400?random=${Date.now() + i}`,
        `https://picsum.photos/600/400?random=${Date.now() + i + 1000}`
      ],
      price: {
        total: finalPrice,
        rate: finalPrice,
        currency: 'USD'
      },
      rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
      reviewsCount: Math.floor(Math.random() * 300) + 5,
      location: {
        city,
        country
      },
      host: {
        name: hostNames[Math.floor(Math.random() * hostNames.length)],
        isSuperhost: Math.random() > 0.6
      },
      amenities: amenities
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.floor(Math.random() * 6) + 3),
      roomType: propertyType.type
    }

    listings.push(listing)
  }

  // Sort by a combination of rating and price (best value first)
  listings.sort((a, b) => {
    const scoreA = a.rating / Math.log(a.price.rate + 1)
    const scoreB = b.rating / Math.log(b.price.rate + 1)
    return scoreB - scoreA
  })

  return listings
}

function getLocationPriceMultiplier(city: string, country: string): number {
  const cityLower = city.toLowerCase()
  const countryLower = country.toLowerCase()
  
  // Price multipliers based on location (rough estimates)
  const expensiveCities = ['paris', 'london', 'new york', 'tokyo', 'san francisco', 'zurich', 'geneva']
  const expensiveCountries = ['switzerland', 'norway', 'denmark', 'monaco']
  const moderateCities = ['barcelona', 'amsterdam', 'berlin', 'rome', 'chicago', 'boston']
  const affordableCities = ['prague', 'budapest', 'lisbon', 'mexico city', 'bangkok']
  
  if (expensiveCities.some(c => cityLower.includes(c)) || expensiveCountries.some(c => countryLower.includes(c))) {
    return 1.8 + Math.random() * 0.4 // 1.8-2.2x
  } else if (moderateCities.some(c => cityLower.includes(c))) {
    return 1.2 + Math.random() * 0.3 // 1.2-1.5x
  } else if (affordableCities.some(c => cityLower.includes(c))) {
    return 0.5 + Math.random() * 0.3 // 0.5-0.8x
  } else {
    return 0.8 + Math.random() * 0.4 // 0.8-1.2x (default)
  }
}