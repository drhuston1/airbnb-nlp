// Unified search API that aggregates results from multiple platforms (Airbnb + Booking.com)
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface UnifiedSearchRequest {
  query: string
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  page?: number
  platforms?: string[] // ['airbnb', 'booking.com'] - which platforms to search
}

interface UnifiedProperty {
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
  platform: 'airbnb' | 'booking.com' | 'vrbo' // Source platform
}

interface UnifiedSearchResponse {
  listings: UnifiedProperty[]
  hasMore: boolean
  totalResults: number
  page: number
  sources: {
    platform: string
    count: number
    status: 'success' | 'error' | 'timeout'
    error?: string
  }[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { 
      query, 
      location, 
      checkin, 
      checkout, 
      adults = 2, 
      children = 0, 
      page = 1,
      platforms = ['airbnb', 'booking.com'] // Both platforms with real APIs
    }: UnifiedSearchRequest = req.body

    console.log('Unified search request:', { query, location, platforms, adults, children })

    if (!location) {
      return res.status(400).json({ error: 'Location is required for unified search' })
    }

    // Prepare search payload for all platforms
    const searchPayload = {
      query,
      location,
      checkin,
      checkout,
      adults,
      children,
      page
    }

    // Call multiple platforms in parallel
    const searchPromises: Promise<{platform: string, data: any, status: 'success' | 'error', error?: string}>[] = []

    if (platforms.includes('airbnb')) {
      searchPromises.push(
        callPlatformAPI('/api/mcp-search', searchPayload, 'airbnb')
      )
    }

    if (platforms.includes('booking.com')) {
      searchPromises.push(
        callPlatformAPI('/api/booking-search', searchPayload, 'booking.com')
      )
    }

    console.log(`Searching ${platforms.length} platforms in parallel...`)

    // Wait for all searches to complete (with timeout)
    const results = await Promise.allSettled(searchPromises.map(p => 
      Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 10000))
      ])
    ))

    console.log('Platform search results:', results.map((r, i) => ({
      platform: platforms[i],
      status: r.status,
      fulfilled: r.status === 'fulfilled'
    })))

    // Process results from each platform
    let allListings: UnifiedProperty[] = []
    const sourceStatus: UnifiedSearchResponse['sources'] = []

    results.forEach((result, index) => {
      const platform = platforms[index]
      
      if (result.status === 'fulfilled') {
        const platformResult = result.value as any
        if (platformResult.status === 'success' && platformResult.data?.listings) {
          // Add platform identifier to each listing
          const platformListings = platformResult.data.listings.map((listing: any) => ({
            ...listing,
            platform,
            id: `${platform}_${listing.id}` // Ensure unique IDs across platforms
          }))
          
          allListings = allListings.concat(platformListings)
          sourceStatus.push({
            platform,
            count: platformListings.length,
            status: 'success'
          })
        } else {
          sourceStatus.push({
            platform,
            count: 0,
            status: 'error',
            error: platformResult.error || 'Unknown error'
          })
        }
      } else {
        sourceStatus.push({
          platform,
          count: 0,
          status: 'error',
          error: result.reason?.message || 'Request failed'
        })
      }
    })

    // Remove duplicates (same property on multiple platforms)
    const deduplicatedListings = deduplicateProperties(allListings)

    // Sort combined results by rating and price
    const sortedListings = deduplicatedListings.sort((a, b) => {
      // Prioritize higher ratings, then lower prices
      if (Math.abs(a.rating - b.rating) > 0.1) {
        return b.rating - a.rating
      }
      return a.price.rate - b.price.rate
    })

    const response: UnifiedSearchResponse = {
      listings: sortedListings,
      hasMore: sourceStatus.some(s => s.count > 0), // More results available if any platform returned results
      totalResults: sortedListings.length,
      page,
      sources: sourceStatus
    }

    console.log(`Unified search complete: ${sortedListings.length} total properties from ${sourceStatus.filter(s => s.status === 'success').length} platforms`)

    return res.status(200).json(response)

  } catch (error) {
    console.error('Unified search error:', error)
    return res.status(500).json({ 
      error: 'Failed to perform unified search',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// Import the API handlers directly to avoid HTTP round-trips
import mcpSearchHandler from './mcp-search'
import bookingSearchHandler from './booking-search'

// Helper function to call individual platform APIs directly
async function callPlatformAPI(endpoint: string, payload: any, platform: string) {
  try {
    console.log(`Calling ${platform} API directly with payload:`, payload)
    
    // Create mock request/response objects for the handlers
    const mockReq = {
      method: 'POST',
      body: payload
    } as any
    
    let result: any = null
    let mockRes: any = {
      status: (code: number) => ({
        json: (data: any) => {
          result = { statusCode: code, data }
          return result
        }
      })
    }
    
    // Call the appropriate handler directly
    if (endpoint === '/api/mcp-search') {
      await mcpSearchHandler(mockReq, mockRes)
    } else if (endpoint === '/api/booking-search') {
      await bookingSearchHandler(mockReq, mockRes)
    } else {
      throw new Error(`Unknown endpoint: ${endpoint}`)
    }
    
    if (result?.statusCode === 200) {
      return { platform, data: result.data, status: 'success' as const }
    } else {
      throw new Error(`${platform} API returned ${result?.statusCode || 'unknown status'}: ${JSON.stringify(result?.data)}`)
    }
    
  } catch (error) {
    console.error(`${platform} API error:`, error)
    return { 
      platform, 
      data: null, 
      status: 'error' as const, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

// Remove duplicate properties that appear on multiple platforms
function deduplicateProperties(listings: UnifiedProperty[]): UnifiedProperty[] {
  const seen = new Map<string, UnifiedProperty>()
  
  for (const listing of listings) {
    // Create a key based on property name and location for deduplication
    const key = `${listing.name.toLowerCase().trim()}_${listing.location.city.toLowerCase()}`
    
    if (!seen.has(key)) {
      seen.set(key, listing)
    } else {
      // If duplicate found, keep the one from the preferred platform or with better rating
      const existing = seen.get(key)!
      if (listing.rating > existing.rating || 
          (listing.platform === 'airbnb' && existing.platform !== 'airbnb')) {
        seen.set(key, listing)
      }
    }
  }
  
  return Array.from(seen.values())
}