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
      platforms = ['airbnb'] // Focus on Airbnb only until Booking.com API is configured
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
        new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 25000))
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

// Direct API integration without importing handlers to avoid mock object issues

// Helper function to call individual platform APIs directly
async function callPlatformAPI(endpoint: string, payload: any, platform: string) {
  try {
    console.log(`Calling ${platform} API directly with payload:`, payload)
    
    if (endpoint === '/api/mcp-search') {
      // Call MCP search directly by reimplementing the core logic
      return await callMCPSearchDirect(payload, platform)
    } else if (endpoint === '/api/booking-search') {
      // Call booking search with proper error handling for missing API key
      return await callBookingSearchDirect(payload, platform)
    } else {
      throw new Error(`Unknown endpoint: ${endpoint}`)
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

// Direct MCP search implementation
async function callMCPSearchDirect(payload: any, platform: string) {
  try {
    const { location, adults = 2, children = 0, page = 1 } = payload
    
    if (!location) {
      throw new Error('Location is required for MCP search')
    }

    const searchParams = {
      location,
      adults,
      children,
      page,
      ignoreRobotsText: true
    }

    console.log('Calling external MCP server with params:', searchParams)

    // Use environment variable or default to the enhanced MCP server
    const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://airbnb-mcp-production.up.railway.app'
    
    const response = await fetch(`${mcpServerUrl}/airbnb-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchParams)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`External MCP server error: ${response.status} - ${errorText}`)
    }

    const mcpResult = await response.json()
    
    if (!mcpResult || !mcpResult.searchResults) {
      throw new Error(`MCP server returned data but no searchResults`)
    }

    // Transform MCP results to our format
    const listings = await transformMCPResults(mcpResult.searchResults, payload)

    return {
      platform,
      data: {
        listings,
        searchUrl: mcpResult.searchUrl,
        totalResults: listings.length,
        page: page,
        hasMore: listings.length >= 18,
        source: 'Real Airbnb MCP Server'
      },
      status: 'success' as const
    }

  } catch (error) {
    console.error('MCP search direct call failed:', error)
    throw error
  }
}

// Direct booking search implementation with proper error handling
async function callBookingSearchDirect(payload: any, platform: string) {
  try {
    // Check if Booking.com API key is available
    if (!process.env.BOOKING_API_KEY) {
      console.log('BOOKING_API_KEY not configured, skipping Booking.com search')
      return {
        platform,
        data: {
          listings: [],
          hasMore: false,
          totalResults: 0,
          page: 1,
          source: 'booking.com'
        },
        status: 'error' as const,
        error: 'BOOKING_API_KEY not configured'
      }
    }

    // If API key is available, call the booking handler
    // For now, return empty results since the API key is not configured
    return {
      platform,
      data: {
        listings: [],
        hasMore: false,
        totalResults: 0,
        page: 1,
        source: 'booking.com'
      },
      status: 'error' as const,
      error: 'Booking.com API not configured'
    }

  } catch (error) {
    console.error('Booking search direct call failed:', error)
    return {
      platform,
      data: {
        listings: [],
        hasMore: false,
        totalResults: 0,
        page: 1,
        source: 'booking.com'
      },
      status: 'error' as const,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Transform MCP results helper function
async function transformMCPResults(searchResults: any[], payload?: any) {
  return Promise.all(searchResults.map(async (listing: any) => {
    // Improved price extraction
    const priceLabel = listing.structuredDisplayPrice?.primaryLine?.accessibilityLabel || ''
    const priceDetails = listing.structuredDisplayPrice?.explanationData?.priceDetails || ''
    
    // Extract total and nightly rates more accurately
    let totalPrice = 100
    let nightlyRate = 100
    
    const totalMatch = priceLabel.match(/\$(\d+(?:,\d+)*)\s+for\s+(\d+)\s+night/)
    if (totalMatch) {
      totalPrice = parseInt(totalMatch[1].replace(/,/g, ''))
      const nights = parseInt(totalMatch[2])
      nightlyRate = Math.round(totalPrice / nights)
    } else {
      const priceDetailsMatch = priceDetails.match(/\$(\d+(?:,\d+)*(?:\.\d+)?)\s+x\s+(\d+)\s+night/)
      if (priceDetailsMatch) {
        nightlyRate = Math.round(parseFloat(priceDetailsMatch[1].replace(/,/g, '')))
        const nights = parseInt(priceDetailsMatch[2])
        totalPrice = nightlyRate * nights
      }
    }

    // Extract rating and reviews more accurately
    const ratingMatch = listing.avgRatingA11yLabel?.match(/([\d.]+)\s+out\s+of\s+5/)
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.0

    const reviewMatch = listing.avgRatingA11yLabel?.match(/(\d+(?:,\d+)*)\s+review/)
    const reviewsCount = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : 0

    // Enhanced badge detection
    const badges = listing.badges?.toLowerCase() || ''
    const isSuperhost = badges.includes('superhost')
    const isGuestFavorite = badges.includes('guest favorite')

    // Extract amenities from property name and structured content
    const name = listing.demandStayListing?.description?.name?.localizedStringWithTranslationPreference || 'Property'
    const primaryLine = listing.structuredContent?.primaryLine || ''
    const amenities = extractAmenitiesFromText(name + ' ' + primaryLine)

    // Extract city from search location and property name
    let city = 'Unknown'
    const searchLocation = payload.location || ''
    const propertyName = name || ''
    
    // Use search location as the primary city
    if (searchLocation) {
      city = searchLocation
    }
    
    // Try to extract more specific city from property name
    const cityMatches = propertyName.match(/\b(Malibu|Los Angeles|Beverly Hills|Santa Monica|Venice|Hollywood|West Hollywood|Pasadena|Burbank|Glendale|Long Beach|Manhattan Beach|Hermosa Beach|Redondo Beach)\b/i)
    if (cityMatches) {
      city = cityMatches[0]
    }
    
    // Fallback to coordinates if needed
    const lat = listing.demandStayListing?.location?.coordinate?.latitude
    const lng = listing.demandStayListing?.location?.coordinate?.longitude
    if (city === 'Unknown' && lat && lng) {
      city = await getCityFromCoordinates(lat, lng) || searchLocation || 'Unknown'
    }

    // Generate Airbnb image URL
    const images = [`https://a0.muscache.com/im/pictures/miso/${listing.id}/original.jpg`]

    return {
      id: listing.id,
      name,
      url: listing.url,
      images,
      price: {
        total: totalPrice,
        rate: nightlyRate,
        currency: 'USD'
      },
      rating,
      reviewsCount,
      location: {
        city,
        country: 'US'
      },
      host: {
        name: isGuestFavorite ? 'Guest Favorite Host' : (isSuperhost ? 'Superhost' : 'Host'),
        isSuperhost
      },
      amenities,
      roomType: primaryLine || 'Property'
    }
  }))
}

// Helper functions
async function getCityFromCoordinates(lat: number, lng: number): Promise<string | undefined> {
  if (!lat || !lng) return undefined

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ChatBnb/1.0 (https://chatbnb.vercel.app)'
        }
      }
    )

    if (response.ok) {
      const data = await response.json()
      const address = data.address
      
      const city = address?.city || 
                   address?.town || 
                   address?.village || 
                   address?.municipality ||
                   address?.county
      
      return city
    }
  } catch (error) {
    console.log('Reverse geocoding failed:', error)
  }

  return undefined
}

function extractAmenitiesFromText(text: string): string[] {
  const amenities: string[] = []
  const lowerText = text.toLowerCase()
  
  // Common amenities to extract
  const amenityPatterns = [
    { pattern: /pool/i, amenity: 'Pool' },
    { pattern: /hot\s*tub/i, amenity: 'Hot Tub' },
    { pattern: /kitchen/i, amenity: 'Kitchen' },
    { pattern: /parking/i, amenity: 'Parking' },
    { pattern: /wifi|internet/i, amenity: 'WiFi' },
    { pattern: /gym|fitness/i, amenity: 'Gym' },
    { pattern: /laundry/i, amenity: 'Laundry' },
    { pattern: /air\s*conditioning|a\/c/i, amenity: 'Air Conditioning' },
    { pattern: /heating/i, amenity: 'Heating' },
    { pattern: /balcony/i, amenity: 'Balcony' },
    { pattern: /terrace/i, amenity: 'Terrace' },
    { pattern: /garden/i, amenity: 'Garden' },
    { pattern: /fireplace/i, amenity: 'Fireplace' },
    { pattern: /washer|dryer/i, amenity: 'Washer & Dryer' },
    { pattern: /pet\s*friendly/i, amenity: 'Pet Friendly' },
    { pattern: /wheelchair|accessible/i, amenity: 'Wheelchair Accessible' },
    { pattern: /workspace|office/i, amenity: 'Workspace' },
    { pattern: /tv|television/i, amenity: 'TV' },
    { pattern: /streaming|netflix/i, amenity: 'Streaming Services' },
    { pattern: /waterfall/i, amenity: 'Waterfall' },
    { pattern: /sauna/i, amenity: 'Sauna' },
    { pattern: /massage/i, amenity: 'Massage Chair' },
    { pattern: /bike/i, amenity: 'Bikes' },
    { pattern: /trail/i, amenity: 'Trail Access' }
  ]
  
  for (const { pattern, amenity } of amenityPatterns) {
    if (pattern.test(text)) {
      amenities.push(amenity)
    }
  }
  
  return [...new Set(amenities)] // Remove duplicates
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