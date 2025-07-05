// Direct Airbnb search using web scraping in serverless function
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
    const { location, adults = 1, children = 0, infants = 0, pets = 0, checkin, checkout, minPrice, maxPrice }: SearchRequest = req.body

    if (!location) {
      return res.status(400).json({ error: 'Location is required' })
    }

    // Build Airbnb search URL
    const searchParams = new URLSearchParams({
      adults: adults.toString(),
      children: children.toString(),
      infants: infants.toString(),
      pets: pets.toString(),
      ...(checkin && { checkin }),
      ...(checkout && { checkout }),
      ...(minPrice && { price_min: minPrice.toString() }),
      ...(maxPrice && { price_max: maxPrice.toString() })
    })

    const searchUrl = `https://www.airbnb.com/s/${encodeURIComponent(location)}/homes?${searchParams.toString()}`

    // Fetch Airbnb page
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch Airbnb page: ${response.status}`)
    }

    const html = await response.text()

    // Extract JSON data from the page
    const jsonMatch = html.match(/window\.__NEXT_DATA__\s*=\s*({.*?});/)
    if (!jsonMatch) {
      throw new Error('Could not find listing data in page')
    }

    const data = JSON.parse(jsonMatch[1])
    const listings = extractListingsFromData(data, location)

    return res.status(200).json({
      listings,
      searchUrl,
      totalResults: listings.length
    })

  } catch (error) {
    console.error('Airbnb search error:', error)
    
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('robots.txt') || error.message.includes('403')) {
        return res.status(403).json({
          error: 'Access blocked by Airbnb',
          message: 'Airbnb is blocking automated requests. Consider using their official API or the MCP server approach.',
          suggestion: 'Deploy a proxy server with rotating IP addresses or use Airbnb\'s official API'
        })
      }
    }

    return res.status(500).json({
      error: 'Failed to search Airbnb listings',
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Try deploying an MCP server for more reliable access'
    })
  }
}

function extractListingsFromData(data: any, location: string): AirbnbListing[] {
  try {
    // Navigate through the Next.js data structure to find listings
    const pageProps = data?.props?.pageProps
    if (!pageProps) return []

    // Look for listings in various possible locations in the data structure
    let listings: any[] = []
    
    // Try different possible paths where listings might be stored
    const possiblePaths = [
      pageProps.searchState?.searchResults,
      pageProps.bootstrapData?.reduxData?.exploreTab?.response?.explore_tabs?.[0]?.sections?.[0]?.listings,
      pageProps.exploreSearchState?.resultsSection?.searchResults,
    ]

    for (const path of possiblePaths) {
      if (path && Array.isArray(path)) {
        listings = path
        break
      }
    }

    if (!listings.length) {
      // If we can't find listings in the expected places, return empty array
      return []
    }

    // Transform the raw listing data
    return listings.slice(0, 20).map((listing: any, index: number) => {
      const pricing = listing.pricing || listing.priceDetails || {}
      const listingData = listing.listing || listing

      return {
        id: listingData.id || `listing_${index}`,
        name: listingData.name || listingData.title || `Property in ${location}`,
        url: `https://www.airbnb.com/rooms/${listingData.id || ''}`,
        images: [
          listingData.picture?.picture || 
          listingData.photos?.[0]?.picture || 
          'https://via.placeholder.com/400x300?text=No+Image'
        ],
        price: {
          total: pricing.total?.amount || pricing.rate?.amount || 100,
          rate: pricing.rate?.amount || pricing.price?.amount || 100,
          currency: pricing.total?.currency || 'USD'
        },
        rating: parseFloat(listingData.avgRating || listingData.starRating || '4.0'),
        reviewsCount: parseInt(listingData.reviewsCount || '0'),
        location: {
          city: location.split(',')[0]?.trim() || location,
          country: location.includes(',') ? location.split(',')[1]?.trim() || 'Unknown' : 'Unknown'
        },
        host: {
          name: listingData.host?.firstName || 'Host',
          isSuperhost: listingData.host?.isSuperhost || false
        },
        amenities: listingData.amenities?.slice(0, 5) || [],
        roomType: listingData.roomType || listingData.propertyType || 'Entire place'
      }
    })
  } catch (error) {
    console.error('Error extracting listings:', error)
    return []
  }
}