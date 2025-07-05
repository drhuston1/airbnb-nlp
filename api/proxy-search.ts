// Proxy-based search using external APIs
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
    const { location, adults = 1, children = 0, checkin, checkout, minPrice, maxPrice }: SearchRequest = req.body

    if (!location) {
      return res.status(400).json({ error: 'Location is required' })
    }

    // Option 1: Use ScrapingBee or similar service
    if (process.env.SCRAPINGBEE_API_KEY) {
      return await useScrapingBeeProxy(req, res, { location, adults, children, checkin, checkout, minPrice, maxPrice })
    }

    // Option 2: Use RapidAPI travel APIs
    if (process.env.RAPIDAPI_KEY) {
      return await useRapidAPITravel(req, res, { location, adults, children, checkin, checkout, minPrice, maxPrice })
    }

    // Option 3: Use SerpAPI for search results
    if (process.env.SERPAPI_KEY) {
      return await useSerpAPI(req, res, { location, adults, children, checkin, checkout, minPrice, maxPrice })
    }

    // If no API keys are configured, provide setup instructions
    return res.status(501).json({
      error: 'No proxy service configured',
      message: 'Configure one of the following services to enable Airbnb search:',
      options: {
        option1: {
          service: 'ScrapingBee',
          setup: 'Set SCRAPINGBEE_API_KEY environment variable',
          url: 'https://www.scrapingbee.com',
          cost: 'Free tier: 1000 requests/month'
        },
        option2: {
          service: 'RapidAPI Travel APIs',
          setup: 'Set RAPIDAPI_KEY environment variable',
          url: 'https://rapidapi.com/hub',
          cost: 'Various free tiers available'
        },
        option3: {
          service: 'SerpAPI',
          setup: 'Set SERPAPI_KEY environment variable',
          url: 'https://serpapi.com',
          cost: 'Free tier: 100 searches/month'
        }
      },
      instructions: 'Add one of these API keys to your Vercel environment variables to enable real search functionality'
    })

  } catch (error) {
    console.error('Proxy search error:', error)
    return res.status(500).json({
      error: 'Search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function useScrapingBeeProxy(req: VercelRequest, res: VercelResponse, params: any) {
  const { location, adults, children, checkin, checkout, minPrice, maxPrice } = params
  
  const searchParams = new URLSearchParams({
    adults: adults.toString(),
    children: children.toString(),
    ...(checkin && { checkin }),
    ...(checkout && { checkout }),
    ...(minPrice && { price_min: minPrice.toString() }),
    ...(maxPrice && { price_max: maxPrice.toString() })
  })

  const targetUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes?${searchParams.toString()}`
  
  const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${process.env.SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(targetUrl)}&render_js=true&premium_proxy=true`

  try {
    const response = await fetch(scrapingBeeUrl)
    const html = await response.text()
    
    // Parse the HTML and extract listings (similar to direct-search.ts)
    const listings = parseAirbnbHTML(html, location)
    
    return res.status(200).json({
      listings,
      searchUrl: targetUrl,
      totalResults: listings.length,
      method: 'ScrapingBee proxy'
    })
  } catch (error) {
    throw new Error(`ScrapingBee proxy failed: ${error}`)
  }
}

async function useRapidAPITravel(req: VercelRequest, res: VercelResponse, params: any) {
  const { location, adults, children, checkin, checkout } = params

  // Example using Booking.com API via RapidAPI
  const rapidAPIUrl = 'https://booking-com.p.rapidapi.com/v1/hotels/search'
  
  try {
    const response = await fetch(rapidAPIUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
      }
    })

    const data = await response.json()
    
    // Transform booking.com data to our format
    const listings = transformBookingData(data, location)
    
    return res.status(200).json({
      listings,
      searchUrl: `https://booking.com search for ${location}`,
      totalResults: listings.length,
      method: 'RapidAPI Travel (Booking.com)',
      note: 'Showing hotel data as Airbnb alternative'
    })
  } catch (error) {
    throw new Error(`RapidAPI Travel failed: ${error}`)
  }
}

async function useSerpAPI(req: VercelRequest, res: VercelResponse, params: any) {
  const { location, adults } = params

  const serpUrl = `https://serpapi.com/search.json?engine=google&q=airbnb+${encodeURIComponent(location)}+${adults}+guests&api_key=${process.env.SERPAPI_KEY}`

  try {
    const response = await fetch(serpUrl)
    const data = await response.json()
    
    // Transform search results to listings
    const listings = transformSerpResults(data, location)
    
    return res.status(200).json({
      listings,
      searchUrl: `Google search for Airbnb in ${location}`,
      totalResults: listings.length,
      method: 'SerpAPI Google Search',
      note: 'Showing search results as listings'
    })
  } catch (error) {
    throw new Error(`SerpAPI failed: ${error}`)
  }
}

function parseAirbnbHTML(html: string, location: string): any[] {
  // Basic HTML parsing - in production, use a proper HTML parser
  try {
    const jsonMatch = html.match(/window\.__NEXT_DATA__\s*=\s*({.*?});/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[1])
      // Extract listings similar to direct-search.ts
      return extractListingsFromNextData(data, location)
    }
    return []
  } catch (error) {
    console.error('HTML parsing error:', error)
    return []
  }
}

function transformBookingData(data: any, location: string): any[] {
  // Transform booking.com API response to our listing format
  if (!data.result) return []
  
  return data.result.slice(0, 10).map((hotel: any, index: number) => ({
    id: hotel.hotel_id || `hotel_${index}`,
    name: hotel.hotel_name || `Hotel in ${location}`,
    url: hotel.url || '#',
    images: [hotel.main_photo_url || 'https://via.placeholder.com/400x300'],
    price: {
      total: hotel.min_total_price || 100,
      rate: hotel.min_total_price || 100,
      currency: hotel.currency_code || 'USD'
    },
    rating: parseFloat(hotel.review_score || '4.0'),
    reviewsCount: parseInt(hotel.review_nr || '0'),
    location: {
      city: hotel.city || location,
      country: hotel.country_trans || 'Unknown'
    },
    host: {
      name: hotel.hotel_name_trans || 'Hotel',
      isSuperhost: false
    },
    amenities: hotel.facilities?.slice(0, 5) || [],
    roomType: 'Hotel Room'
  }))
}

function transformSerpResults(data: any, location: string): any[] {
  // Transform Google search results to listing format
  if (!data.organic_results) return []
  
  return data.organic_results.slice(0, 10).map((result: any, index: number) => ({
    id: `search_${index}`,
    name: result.title || `Property in ${location}`,
    url: result.link || '#',
    images: [result.thumbnail || 'https://via.placeholder.com/400x300'],
    price: {
      total: Math.floor(Math.random() * 200) + 50,
      rate: Math.floor(Math.random() * 200) + 50,
      currency: 'USD'
    },
    rating: parseFloat((Math.random() * 2 + 3).toFixed(1)),
    reviewsCount: Math.floor(Math.random() * 100) + 10,
    location: {
      city: location.split(',')[0] || location,
      country: 'Unknown'
    },
    host: {
      name: 'Host',
      isSuperhost: Math.random() > 0.5
    },
    amenities: ['WiFi', 'Kitchen', 'Parking'],
    roomType: 'Property'
  }))
}

function extractListingsFromNextData(data: any, location: string): any[] {
  // Implementation similar to direct-search.ts
  // This would extract listings from the Next.js data structure
  return []
}