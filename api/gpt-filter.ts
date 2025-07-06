// GPT-powered semantic filtering for property listings
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { API_CONFIG } from './config'

interface ListingSummary {
  id: string
  name: string
  roomType: string
  amenities: string[]
  rating: number
  reviewsCount: number
  price: number
  isSuperhost: boolean
}

interface GPTFilterRequest {
  query: string
  listings: ListingSummary[]
}

interface GPTFilterResponse {
  filteredIds: string[]
  success: boolean
  error?: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, listings }: GPTFilterRequest = req.body

    if (!query || !listings || !Array.isArray(listings)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query and listings array are required',
        filteredIds: []
      })
    }

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured',
        filteredIds: []
      })
    }

    console.log(`GPT filtering ${listings.length} listings for query: "${query}"`)
    
    const filteredIds = await filterListingsWithGPT(query, listings, openaiKey)
    
    const response: GPTFilterResponse = {
      filteredIds,
      success: true
    }

    console.log(`GPT filtering result: ${filteredIds.length}/${listings.length} properties matched`)
    return res.status(200).json(response)

  } catch (error) {
    console.error('GPT filtering error:', error)
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      filteredIds: []
    })
  }
}

async function filterListingsWithGPT(
  query: string, 
  listings: ListingSummary[], 
  apiKey: string
): Promise<string[]> {
  try {
    // Rule-based filtering instead of GPT (since GPT is not following instructions)
    const queryLower = query.toLowerCase()
    
    let filteredListings = [...listings]
    
    // Apply strict filtering rules
    if (queryLower.includes('superhost only') || (queryLower.includes('superhost') && !queryLower.includes('non-superhost'))) {
      filteredListings = filteredListings.filter(listing => listing.isSuperhost)
      console.log(`Superhost filter: ${filteredListings.length} properties`)
    }
    
    if (queryLower.includes('luxury')) {
      filteredListings = filteredListings.filter(listing => 
        listing.price >= 200 || listing.rating >= 4.8 || listing.isSuperhost
      )
      console.log(`Luxury filter: ${filteredListings.length} properties`)
    }
    
    if (queryLower.includes('villa')) {
      filteredListings = filteredListings.filter(listing => {
        const nameType = (listing.name + ' ' + listing.roomType).toLowerCase()
        return nameType.includes('villa') || nameType.includes('estate') || nameType.includes('luxury home')
      })
      console.log(`Villa filter: ${filteredListings.length} properties`)
    }
    
    if (queryLower.includes('budget') || queryLower.includes('cheap') || queryLower.includes('under $')) {
      const priceMatch = queryLower.match(/under \$(\d+)/)
      const maxPrice = priceMatch ? parseInt(priceMatch[1]) : 150
      filteredListings = filteredListings.filter(listing => listing.price <= maxPrice)
      console.log(`Budget filter (under $${maxPrice}): ${filteredListings.length} properties`)
    }
    
    if (queryLower.includes('apartment') || queryLower.includes('apt')) {
      filteredListings = filteredListings.filter(listing => {
        const nameType = (listing.name + ' ' + listing.roomType).toLowerCase()
        return nameType.includes('apartment') || nameType.includes('condo') || nameType.includes('flat') || nameType.includes('studio')
      })
      console.log(`Apartment filter: ${filteredListings.length} properties`)
    }
    
    if (queryLower.includes('house') && !queryLower.includes('villa')) {
      filteredListings = filteredListings.filter(listing => {
        const nameType = (listing.name + ' ' + listing.roomType).toLowerCase()
        return nameType.includes('house') || nameType.includes('home') || nameType.includes('cottage') || nameType.includes('cabin')
      })
      console.log(`House filter: ${filteredListings.length} properties`)
    }
    
    // Rating filters
    if (queryLower.includes('4.8+') || queryLower.includes('excellent') || queryLower.includes('highly rated')) {
      const minRating = queryLower.includes('4.8+') ? 4.8 : 4.5
      filteredListings = filteredListings.filter(listing => listing.rating >= minRating)
      console.log(`Rating filter (${minRating}+): ${filteredListings.length} properties`)
    }
    
    // If filters eliminate everything and we started with results, be less strict on secondary criteria
    if (filteredListings.length === 0 && listings.length > 0) {
      console.log('All properties filtered out, applying progressive relaxation')
      
      // Relax in order of importance: keep superhost requirement, relax luxury/property type
      if (queryLower.includes('superhost only')) {
        filteredListings = listings.filter(listing => listing.isSuperhost)
      } else if (queryLower.includes('luxury')) {
        filteredListings = listings.filter(listing => listing.price >= 150 || listing.rating >= 4.5)
      } else {
        // Return top-rated properties as fallback (stable sorting)
        filteredListings = listings.sort((a, b) => {
          const ratingDiff = b.rating - a.rating
          return ratingDiff !== 0 ? ratingDiff : a.id.localeCompare(b.id)
        }).slice(0, Math.ceil(listings.length * 0.5))
      }
      console.log(`Progressive relaxation: ${filteredListings.length} properties`)
    }
    
    // Sort by relevance: superhosts first, then rating, then price, then ID for stability
    filteredListings.sort((a, b) => {
      if (a.isSuperhost !== b.isSuperhost) return b.isSuperhost ? 1 : -1
      if (Math.abs(a.rating - b.rating) > 0.1) return b.rating - a.rating
      if (Math.abs(a.price - b.price) > 0.01) return a.price - b.price
      // Use ID as final tiebreaker for deterministic results
      return a.id.localeCompare(b.id)
    })
    
    const filteredIds = filteredListings.map(listing => listing.id)
    console.log(`Rule-based filtering: ${filteredIds.length}/${listings.length} properties matched for "${query}"`)
    return filteredIds

  } catch (error) {
    console.error('Rule-based filtering failed:', error)
    // Fallback to all properties
    return listings.map(l => l.id)
  }
}