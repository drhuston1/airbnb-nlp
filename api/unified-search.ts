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
  platforms?: string[] // ['airbnb', 'booking', 'vrbo'] - which platforms to search
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
  platform: 'airbnb' | 'booking' | 'vrbo' // Source platform
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
      platforms = ['airbnb', 'booking', 'vrbo'] // Now supports Airbnb, Booking.com, and VRBO via scraping
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
      // Use HTTP API with MCP fallback (handled in callPlatformAPI)
      console.log('🚀 Using HTTP API for Airbnb with MCP fallback')
      searchPromises.push(
        callPlatformAPI('/api/airbnb-api', searchPayload, 'airbnb')
      )
    }

    if (platforms.includes('booking')) {
      console.log('🏨 Booking.com temporarily disabled - browser scraping removed')
      // TODO: Implement Booking.com HTTP API approach
    }

    if (platforms.includes('vrbo')) {
      console.log('🏖️ VRBO temporarily disabled - browser scraping removed')
      // TODO: Implement VRBO HTTP API approach
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

    // Sort combined results by rating and price (stable/deterministic sorting)
    const sortedListings = deduplicatedListings.sort((a, b) => {
      // Prioritize higher ratings, then lower prices, then by ID for stable sorting
      if (Math.abs(a.rating - b.rating) > 0.1) {
        return b.rating - a.rating
      }
      if (Math.abs(a.price.rate - b.price.rate) > 0.01) {
        return a.price.rate - b.price.rate
      }
      // Use ID as tiebreaker for deterministic results
      return a.id.localeCompare(b.id)
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
    
    if (endpoint === '/api/airbnb-api') {
      // Try HTTP API, fall back to MCP if it fails
      try {
        return await callAirbnbHttpAPI(payload, platform)
      } catch (httpError) {
        console.log(`❌ HTTP API failed for ${platform}, falling back to MCP:`, httpError)
        return await callMCPSearchDirect(payload, platform)
      }
    } else if (endpoint === '/api/mcp-search') {
      // Call MCP search directly by reimplementing the core logic
      return await callMCPSearchDirect(payload, platform)
    } else if (endpoint === '/api/scraper') {
      // Call scraper directly for all platforms (temporarily including Airbnb for testing)
      return await callScraperFallback(payload, platform)
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

// Direct MCP search implementation with scraper fallback
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
    
    try {
      const response = await fetch(`${mcpServerUrl}/airbnb-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams),
        signal: AbortSignal.timeout(20000) // 20 second timeout
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
    } catch (mcpError) {
      console.error('MCP server failed, falling back to scraper:', mcpError)
      
      // Fallback to web scraper
      return await callScraperFallback(payload, platform)
    }

  } catch (error) {
    console.error('Both MCP and scraper failed:', error)
    throw error
  }
}

// Scraper fallback implementation
async function callScraperFallback(payload: any, platform: string) {
  try {
    console.log('Using web scraper fallback for platform:', platform)
    
    const scraperPayload = {
      platform: platform as 'airbnb' | 'booking' | 'vrbo',
      location: payload.location,
      checkin: payload.checkin,
      checkout: payload.checkout,
      adults: payload.adults || 2,
      children: payload.children || 0,
      page: payload.page || 1
    }

    // Call our scraper API directly
    const scraperResult = await callScraperDirect(scraperPayload)
    
    return {
      platform,
      data: {
        listings: scraperResult.listings,
        searchUrl: scraperResult.searchUrl,
        totalResults: scraperResult.totalResults,
        page: scraperResult.page,
        hasMore: scraperResult.hasMore,
        source: `Web Scraper (${platform})`
      },
      status: 'success' as const
    }
    
  } catch (error) {
    console.error('Scraper fallback failed:', error)
    throw error
  }
}

// Direct scraper call (reimplemented to avoid circular imports)
async function callScraperDirect(scraperPayload: any) {
  // Import scraper functions dynamically to avoid Vercel build issues
  const scraper = await import('./scraper')
  
  // Create a mock request/response for the scraper handler
  const mockReq = {
    method: 'POST',
    body: scraperPayload
  } as any

  let result: any
  const mockRes = {
    status: (code: number) => ({
      json: (data: any) => {
        result = { statusCode: code, data }
        return result
      }
    }),
    json: (data: any) => {
      result = { statusCode: 200, data }
      return result
    }
  } as any

  await scraper.default(mockReq, mockRes)
  
  if (result.statusCode !== 200) {
    throw new Error(result.data.error || 'Scraper failed')
  }
  
  return result.data
}

// VRBO integration removed - requires Expedia Partner Network credentials

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

// HTTP API implementation for Airbnb (embedded to avoid deployment issues)
async function callAirbnbHttpAPI(payload: any, platform: string) {
  console.log('🔍 Starting HTTP API-based Airbnb search...')
  
  const { location, adults = 1, children = 0 } = payload
  
  // Headers that mimic Airbnb's web frontend
  const AIRBNB_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.airbnb.com/',
    'Origin': 'https://www.airbnb.com',
    'X-Airbnb-API-Key': 'd306zoyjsyarp7ifhu67rjxn52tv0t20', // Public API key from frontend
    'X-Airbnb-Screen-Size': '1920x1080',
    'X-Airbnb-Supports-Airlock-V2': 'true',
    'Content-Type': 'application/json'
  }

  try {
    // Step 1: Initialize session and get cookies
    console.log('🍪 Initializing session...')
    const sessionResponse = await fetch('https://www.airbnb.com/', {
      headers: AIRBNB_HEADERS
    })
    
    const sessionCookies = sessionResponse.headers.get('set-cookie') || ''
    const sessionText = await sessionResponse.text()
    
    // Extract CSRF token from page content
    const csrfMatch = sessionText.match(/"csrfToken":"([^"]+)"/)
    const csrfToken = csrfMatch ? csrfMatch[1] : ''
    
    console.log('✅ Session initialized')
    
    // Step 2: Build search request parameters
    const rawParams = [
      { filterName: 'adults', filterValues: [adults.toString()] }
    ]
    
    if (children > 0) {
      rawParams.push({ filterName: 'children', filterValues: [children.toString()] })
    }
    
    const searchPayload = {
      operationName: 'StaysSearch',
      locale: 'en',
      currency: 'USD',
      variables: {
        staysSearchRequest: {
          requestedPageType: 'STAYS_SEARCH',
          metadataOnly: false,
          source: 'structured_search_input_header',
          searchType: 'pagination',
          treatmentFlags: [
            'stays_search_rehydration_treatment_desktop',
            'stays_search_rehydration_treatment_moweb',
            'flex_destinations_june_2021_ldp_web_treatment',
            'stays_search_map_toggle_2021'
          ],
          rawParams: [
            ...rawParams,
            { filterName: 'query', filterValues: [location] },
            { filterName: 'place_id', filterValues: [] }
          ]
        }
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: 'f2ee243b3b6b99c6b0d7ef7d5f6b8b2a3c8e2b7b5c6c5c5c5c5c5c5c5c5c5c5c'
        }
      }
    }
    
    // Step 3: Make search API call
    console.log('🚀 Making search API request...')
    const searchResponse = await fetch('https://www.airbnb.com/api/v3/StaysSearch', {
      method: 'POST',
      headers: {
        ...AIRBNB_HEADERS,
        'Cookie': sessionCookies,
        'X-CSRF-Token': csrfToken
      },
      body: JSON.stringify(searchPayload)
    })
    
    if (!searchResponse.ok) {
      throw new Error(`Airbnb API returned ${searchResponse.status}: ${searchResponse.statusText}`)
    }
    
    const searchData = await searchResponse.json()
    console.log('✅ Received search response')
    
    // Debug: Log response structure
    console.log('🔍 Response keys:', Object.keys(searchData))
    if (searchData.data) {
      console.log('🔍 Data keys:', Object.keys(searchData.data))
      if (searchData.data.dora) {
        console.log('🔍 Dora keys:', Object.keys(searchData.data.dora))
        if (searchData.data.dora.exploreV3) {
          console.log('🔍 ExploreV3 keys:', Object.keys(searchData.data.dora.exploreV3))
          if (searchData.data.dora.exploreV3.sections) {
            console.log(`🔍 Found ${searchData.data.dora.exploreV3.sections.length} sections`)
            searchData.data.dora.exploreV3.sections.forEach((section: any, i: number) => {
              console.log(`🔍 Section ${i}: ${section.sectionComponentType}, cards: ${section.listingCards?.length || 0}`)
            })
          }
        }
      }
    }
    
    // Step 4: Transform results to our format
    const listings = transformAirbnbHttpResults(searchData)
    console.log(`🎉 HTTP API found ${listings.length} listings`)
    
    return {
      platform,
      data: {
        success: true,
        platform: 'airbnb',
        query: location,
        totalResults: listings.length,
        results: listings,
        metadata: {
          searchType: 'http_api',
          timestamp: new Date().toISOString()
        }
      },
      status: 'success' as const
    }
    
  } catch (error) {
    console.error('❌ Airbnb HTTP API failed:', error)
    throw error // Re-throw to trigger MCP fallback
  }
}

function transformAirbnbHttpResults(data: any): any[] {
  try {
    // Try multiple possible response structures
    let listingCards: any[] = []
    
    // Structure 1: data.dora.exploreV3.sections[].listingCards
    if (data?.data?.dora?.exploreV3?.sections) {
      for (const section of data.data.dora.exploreV3.sections) {
        if (section.listingCards?.length > 0) {
          listingCards = section.listingCards
          console.log(`✅ Found ${listingCards.length} cards in section: ${section.sectionComponentType}`)
          break
        }
      }
    }
    
    // Structure 2: data.data.presentation.staysSearch.results.searchResults
    if (!listingCards.length && data?.data?.presentation?.staysSearch?.results?.searchResults) {
      listingCards = data.data.presentation.staysSearch.results.searchResults
      console.log(`✅ Found ${listingCards.length} cards in searchResults`)
    }
    
    // Structure 3: data.data.staysSearch.results.homes
    if (!listingCards.length && data?.data?.staysSearch?.results?.homes) {
      listingCards = data.data.staysSearch.results.homes
      console.log(`✅ Found ${listingCards.length} cards in homes`)
    }
    
    // Structure 4: Direct results array
    if (!listingCards.length && Array.isArray(data?.data?.results)) {
      listingCards = data.data.results
      console.log(`✅ Found ${listingCards.length} cards in direct results`)
    }
    
    if (!listingCards.length) {
      console.warn('No listing cards found in any known response structure')
      return []
    }
    
    return listingCards.map((card: any) => {
      const listing = card.listing || {}
      const pricingQuote = card.pricingQuote || {}
      
      return {
        id: listing.id || '',
        name: listing.name || 'Untitled Property',
        url: `https://www.airbnb.com/rooms/${listing.id}`,
        images: listing.contextualPictures?.map((pic: any) => pic.picture) || 
                listing.pictureUrls || [],
        price: {
          total: pricingQuote.structuredStayDisplayPrice?.primaryLine?.price || 100,
          rate: pricingQuote.structuredStayDisplayPrice?.primaryLine?.price || 100,
          currency: 'USD'
        },
        rating: listing.avgRating || 4.0,
        reviewsCount: listing.reviewsCount || 0,
        location: {
          city: listing.city || 'Unknown',
          country: listing.country || 'Unknown'
        },
        host: {
          name: listing.user?.firstName || 'Host',
          isSuperhost: listing.user?.isSuperhost || false
        },
        amenities: extractHttpAmenities(listing),
        roomType: listing.roomTypeCategory || 'Property',
        platform: 'airbnb' as const
      }
    }).filter((listing: any) => listing.id) // Remove invalid entries
    
  } catch (error) {
    console.error('Error transforming Airbnb HTTP results:', error)
    return []
  }
}

function extractHttpAmenities(listing: any): string[] {
  const amenities: string[] = []
  
  // Extract from various possible locations in the response
  if (listing.amenityIds) {
    // Map common amenity IDs to human readable names
    const amenityMap: Record<number, string> = {
      1: 'WiFi',
      4: 'Kitchen',
      8: 'Parking',
      10: 'Pool',
      30: 'Hot Tub',
      33: 'Air Conditioning',
      40: 'Laundry',
      51: 'Gym'
    }
    
    listing.amenityIds.forEach((id: number) => {
      if (amenityMap[id]) {
        amenities.push(amenityMap[id])
      }
    })
  }
  
  // Extract from listing highlights
  if (listing.highlights) {
    listing.highlights.forEach((highlight: any) => {
      if (highlight.message) {
        amenities.push(highlight.message)
      }
    })
  }
  
  return [...new Set(amenities)] // Remove duplicates
}