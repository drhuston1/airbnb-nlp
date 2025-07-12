// Airbnb search API with enhanced trust scoring and review insights
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface UnifiedSearchRequest {
  query: string
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  page?: number
  // Note: Now focused on Airbnb for the best search experience
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
  propertyType?: string
  platform?: string
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
      page = 1
    }: UnifiedSearchRequest = req.body

    console.log('Airbnb search request:', { query, location, adults, children })

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

    // Search Airbnb using HTTP API with MCP fallback
    console.log('🚀 Searching Airbnb using HTTP API...')
    
    const searchPromise = callPlatformAPI('/api/airbnb-api', searchPayload, 'airbnb')
    
    // Wait for search to complete (with timeout)
    const result = await Promise.race([
      searchPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 25000))
    ])

    console.log('Airbnb search completed:', { status: 'success' })

    // Process Airbnb results
    let allListings: UnifiedProperty[] = []
    const sourceStatus: UnifiedSearchResponse['sources'] = []

    try {
      const airbnbResult = result as any
      if (airbnbResult.status === 'success' && (airbnbResult.data?.listings || airbnbResult.data?.results)) {
        const rawListings = airbnbResult.data.listings || airbnbResult.data.results
        allListings = rawListings
        
        sourceStatus.push({
          platform: 'airbnb',
          count: rawListings.length,
          status: 'success'
        })
      } else {
        sourceStatus.push({
          platform: 'airbnb', 
          count: 0,
          status: 'error',
          error: airbnbResult.error || 'Unknown error'
        })
      }
    } catch (error) {
      sourceStatus.push({
        platform: 'airbnb',
        count: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Request failed'
      })
    }

    // Sort results by trust score first, then rating and price
    const sortedListings = allListings.sort((a, b) => {
      // Prioritize trust score, then higher ratings, then lower prices
      if (a.trustScore !== undefined && b.trustScore !== undefined) {
        if (Math.abs(a.trustScore - b.trustScore) > 5) {
          return b.trustScore - a.trustScore
        }
      }
      if (Math.abs(a.rating - b.rating) > 0.1) {
        return b.rating - a.rating
      }
      if (Math.abs(a.price.rate - b.price.rate) > 0.01) {
        return a.price.rate - b.price.rate
      }
      return a.id.localeCompare(b.id)
    })

    const response: UnifiedSearchResponse = {
      listings: sortedListings,
      hasMore: sourceStatus.some(s => s.count > 0),
      totalResults: sortedListings.length,
      page,
      sources: sourceStatus
    }

    console.log(`Airbnb search complete: ${sortedListings.length} properties found`)

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
      console.error('MCP server failed:', mcpError)
      throw mcpError
    }

  } catch (error) {
    console.error('MCP search failed:', error)
    throw error
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
      roomType: primaryLine || 'Property',
      propertyType: primaryLine || 'Property',
      platform: 'airbnb'
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

// Calculate trust score based on rating and review count (same logic as review-analysis.ts)
function calculateTrustScore(rating: number, reviewsCount: number): number {
  if (!rating || !reviewsCount || reviewsCount === 0) return 0

  // Base score from rating (0-60 points)
  const ratingScore = Math.min(60, (rating / 5.0) * 60)

  // Review count confidence boost (0-40 points)
  let reviewCountScore = 0
  if (reviewsCount >= 100) {
    reviewCountScore = 40 // Very high confidence
  } else if (reviewsCount >= 50) {
    reviewCountScore = 35 // High confidence  
  } else if (reviewsCount >= 25) {
    reviewCountScore = 30 // Good confidence
  } else if (reviewsCount >= 10) {
    reviewCountScore = 20 // Moderate confidence
  } else if (reviewsCount >= 5) {
    reviewCountScore = 10 // Low confidence
  } else {
    reviewCountScore = 5 // Very low confidence
  }

  const totalScore = Math.round(ratingScore + reviewCountScore)
  return Math.min(100, Math.max(0, totalScore))
}

// Note: Deduplication removed since we're now Airbnb-focused

// HTTP API implementation for Airbnb (embedded to avoid deployment issues)
async function callAirbnbHttpAPI(payload: any, platform: string) {
  console.log('🔍 Starting HTTP API-based Airbnb search...')
  
  const { location, adults = 1, children = 0, checkin, checkout, priceMin, priceMax } = payload
  
  // Log date filtering if dates are provided
  if (checkin && checkout) {
    console.log(`📅 Filtering by dates: ${checkin} to ${checkout}`)
  }
  
  // Log price filtering if price range is provided
  if (priceMin || priceMax) {
    console.log(`💰 Filtering by price: $${priceMin || 0} - $${priceMax || 'unlimited'}`)
  }
  
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
    
    // Simplified search using the search endpoint instead of GraphQL
    const searchUrl = new URL('https://www.airbnb.com/api/v2/explore_tabs')
    searchUrl.searchParams.set('version', '1.3.9')
    searchUrl.searchParams.set('_format', 'for_explore_search_web')
    searchUrl.searchParams.set('experiences_per_grid', '20')
    searchUrl.searchParams.set('guidebooks_per_grid', '20')
    searchUrl.searchParams.set('auto_ib', 'false')
    searchUrl.searchParams.set('fetch_filters', 'true')
    searchUrl.searchParams.set('has_zero_guest_treatment', 'false')
    searchUrl.searchParams.set('is_guided_search', 'true')
    searchUrl.searchParams.set('is_new_cards_experiment', 'true')
    searchUrl.searchParams.set('luxury_pre_launch', 'false')
    searchUrl.searchParams.set('query_understanding_enabled', 'true')
    searchUrl.searchParams.set('show_groupings', 'true')
    searchUrl.searchParams.set('supports_for_you_v3', 'true')
    searchUrl.searchParams.set('timezone_offset', '0')
    searchUrl.searchParams.set('items_per_grid', '20')
    searchUrl.searchParams.set('federated_search_session_id', Date.now().toString())
    searchUrl.searchParams.set('tab_id', 'home_tab')
    searchUrl.searchParams.set('refinement_paths[]', '/homes')
    searchUrl.searchParams.set('query', location)
    searchUrl.searchParams.set('place_id', '')
    searchUrl.searchParams.set('checkin', checkin || '')
    searchUrl.searchParams.set('checkout', checkout || '')
    searchUrl.searchParams.set('adults', adults.toString())
    searchUrl.searchParams.set('children', children.toString())
    searchUrl.searchParams.set('infants', '0')
    searchUrl.searchParams.set('guests', (adults + children).toString())
    searchUrl.searchParams.set('min_bathrooms', '0')
    searchUrl.searchParams.set('min_bedrooms', '0')
    searchUrl.searchParams.set('min_beds', '0')
    searchUrl.searchParams.set('min_num_pic_urls', '1')
    searchUrl.searchParams.set('monthly_start_date', '')
    searchUrl.searchParams.set('monthly_length', '')
    searchUrl.searchParams.set('price_min', (priceMin || 0).toString())
    searchUrl.searchParams.set('price_max', (priceMax || 1000).toString())
    searchUrl.searchParams.set('room_types[]', 'Entire home/apt')
    searchUrl.searchParams.set('top_tier_stays[]', 'true')
    searchUrl.searchParams.set('satori_version', '1.2.0')
    searchUrl.searchParams.set('_cb', Date.now().toString())
    
    console.log('🔗 Search URL:', searchUrl.toString())
    
    // Step 3: Make search API call
    console.log('🚀 Making search API request...')
    const searchResponse = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        ...AIRBNB_HEADERS,
        'Cookie': sessionCookies,
        'X-CSRF-Token': csrfToken
      }
    })
    
    if (!searchResponse.ok) {
      throw new Error(`Airbnb API returned ${searchResponse.status}: ${searchResponse.statusText}`)
    }
    
    const searchData = await searchResponse.json()
    console.log('✅ Received search response')
    
    // Log basic response info
    console.log('🔍 Response keys:', Object.keys(searchData))
    
    // Step 4: Transform results to our format
    const listings = transformAirbnbHttpResults(searchData)
    console.log(`🎉 HTTP API found ${listings.length} listings`)
    
    // Log sample for monitoring
    if (listings.length > 0) {
      console.log('📊 Sample listing keys:', Object.keys(listings[0]))
    }
    
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
    // Try multiple possible response structures for explore_tabs API
    let listingCards: any[] = []
    
    // Structure 1: explore_tabs API - sections[].listings
    if (data?.explore_tabs?.[0]?.sections) {
      for (const section of data.explore_tabs[0].sections) {
        if (section.listings?.length > 0) {
          listingCards = section.listings
          console.log(`✅ Found ${listingCards.length} listings in section: ${section.section_type_uid}`)
          break
        }
      }
    }
    
    // Structure 2: Direct explore_tabs listings
    if (!listingCards.length && data?.explore_tabs?.[0]?.listings) {
      listingCards = data.explore_tabs[0].listings
      console.log(`✅ Found ${listingCards.length} listings in explore_tabs`)
    }
    
    // Structure 3: GraphQL format (fallback)
    if (!listingCards.length && data?.data?.dora?.exploreV3?.sections) {
      for (const section of data.data.dora.exploreV3.sections) {
        if (section.listingCards?.length > 0) {
          listingCards = section.listingCards
          console.log(`✅ Found ${listingCards.length} cards in section: ${section.sectionComponentType}`)
          break
        }
      }
    }
    
    // Structure 4: Direct results array
    if (!listingCards.length && Array.isArray(data?.results)) {
      listingCards = data.results
      console.log(`✅ Found ${listingCards.length} cards in direct results`)
    }
    
    if (!listingCards.length) {
      console.warn('No listing cards found in any known response structure')
      console.log('🔍 Available top-level keys:', Object.keys(data))
      return []
    }
    
    // Debug first listing completely for image issues
    if (listingCards.length > 0) {
      console.log(`🔍 First listing complete structure:`, JSON.stringify(listingCards[0], null, 2).substring(0, 3000))
      console.log(`🔍 First listing keys:`, Object.keys(listingCards[0]))
      if (listingCards[0].listing) {
        console.log(`🔍 First listing.listing keys:`, Object.keys(listingCards[0].listing))
      }
    }
    
    return listingCards.map((item: any, index: number) => {
      // Handle both explore_tabs and GraphQL formats
      const listing = item.listing || item
      
      // Log first listing for monitoring
      if (index === 0) {
        console.log(`🔍 Processing first listing with ID: ${listing.id}`)
        
        // Detailed image field debugging
        console.log(`🖼️ Image fields debug:`, {
          pictures: !!listing.pictures,
          pictures_length: listing.pictures?.length,
          picture_urls: !!listing.picture_urls,
          picture_urls_length: listing.picture_urls?.length,
          contextual_pictures: !!listing.contextual_pictures,
          contextual_pictures_length: listing.contextual_pictures?.length,
          xl_picture_url: !!listing.xl_picture_url,
          picture_url: !!listing.picture_url,
          thumbnail_url: !!listing.thumbnail_url,
          photos: !!listing.photos,
          photos_length: listing.photos?.length,
          images: !!listing.images,
          images_length: listing.images?.length
        })
        
        // Show actual URLs if they exist
        if (listing.pictures?.[0]) console.log(`🖼️ First pictures entry:`, listing.pictures[0])
        if (listing.picture_urls?.[0]) console.log(`🖼️ First picture_url:`, listing.picture_urls[0])
        if (listing.contextual_pictures?.[0]) console.log(`🖼️ First contextual_picture:`, listing.contextual_pictures[0])
      }
      
      // More robust ID extraction
      const listingId = listing.id || item.id || listing.listing_id || item.listing_id || `temp_${index}`
      
      // Extract price info from pricing_quote (sibling to listing)
      const pricingQuote = item.pricing_quote || {}
      let priceValue = 100
      
      if (pricingQuote.rate?.amount) {
        priceValue = pricingQuote.rate.amount
      } else if (pricingQuote.rate_formatted) {
        priceValue = parseInt(pricingQuote.rate_formatted.replace(/[^0-9]/g, '')) || 100
      } else if (listing.pricing_quote?.rate?.amount) {
        priceValue = listing.pricing_quote.rate.amount
      } else if (listing.price?.rate?.amount_formatted) {
        priceValue = parseInt(listing.price.rate.amount_formatted.replace(/[^0-9]/g, '')) || 100
      }
      
      // Extract images from the explore_tabs API response structure
      let images: string[] = []
      
      // For explore_tabs API, images are often in different locations
      if (listing.pictures && Array.isArray(listing.pictures) && listing.pictures.length > 0) {
        images = listing.pictures.map((pic: any) => pic.picture || pic).filter(Boolean)
        if (index === 0) console.log(`✅ Using pictures array: ${images.length} images`)
      } else if (listing.picture_urls && Array.isArray(listing.picture_urls) && listing.picture_urls.length > 0) {
        images = listing.picture_urls
        if (index === 0) console.log(`✅ Using picture_urls: ${images.length} images`)
      } else if (listing.contextual_pictures && Array.isArray(listing.contextual_pictures) && listing.contextual_pictures.length > 0) {
        images = listing.contextual_pictures.map((pic: any) => pic.picture || pic.url).filter(Boolean)
        if (index === 0) console.log(`✅ Using contextual_pictures: ${images.length} images`)
      } else if (listing.xl_picture_url) {
        images = [listing.xl_picture_url]
        if (index === 0) console.log(`✅ Using xl_picture_url: ${images.length} image`)
      } else if (listing.picture_url) {
        images = [listing.picture_url]
        if (index === 0) console.log(`✅ Using picture_url: ${images.length} image`)
      } else if (listing.thumbnail_url) {
        images = [listing.thumbnail_url]
        if (index === 0) console.log(`✅ Using thumbnail_url: ${images.length} image`)
      } else {
        // Construct Airbnb image URLs using the listing ID and known patterns
        if (listing.id) {
          const baseId = listing.id.toString()
          // Use the most common Airbnb image URL pattern
          images = [
            `https://a0.muscache.com/im/pictures/hosting/Hosting-${baseId}/original/`,
            `https://a0.muscache.com/im/pictures/miso/Hosting-${baseId}/original/`,
            `https://a0.muscache.com/im/pictures/${baseId}/original/`
          ]
          if (index === 0) console.log(`🔧 Constructed ${images.length} potential image URLs from ID: ${baseId}`)
        } else {
          if (index === 0) console.log(`❌ No images found and no ID to construct URL`)
        }
      }

      const rating = parseFloat(listing.avg_rating_localized) || listing.star_rating || listing.avgRating || 4.0
      const reviewsCount = listing.reviews_count || listing.reviewsCount || 0
      
      // Calculate trust score immediately
      const trustScore = calculateTrustScore(rating, reviewsCount)
      
      const transformedListing = {
        id: listingId?.toString() || `fallback_${index}`,
        name: listing.name || listing.public_address || `Property ${index + 1}`,
        url: `https://www.airbnb.com/rooms/${listingId}`,
        images,
        price: {
          total: priceValue,
          rate: priceValue,
          currency: 'USD'
        },
        rating,
        reviewsCount,
        location: {
          city: listing.localized_city || listing.city || 'Unknown',
          country: listing.localized_country || listing.country || 'Unknown'
        },
        host: {
          name: listing.user?.first_name || listing.primary_host?.first_name || 'Host',
          isSuperhost: listing.is_superhost || listing.user?.isSuperhost || listing.primary_host?.is_superhost || false
        },
        amenities: extractHttpAmenities(listing),
        roomType: listing.room_type_category || listing.roomTypeCategory || 'Property',
        propertyType: listing.room_and_property_type || listing.space_type || 'Property',
        platform: 'airbnb',
        
        // Enhanced data for better cards
        bedrooms: listing.bedrooms || 0,
        bathrooms: listing.bathrooms || 0,
        beds: listing.beds || 0,
        maxGuests: listing.person_capacity || 1,
        neighborhood: listing.public_address || listing.localized_city || listing.city,
        isNewListing: listing.is_new_listing || false,
        instantBook: listing.instant_book || false,
        minNights: listing.min_nights || 1,
        maxNights: listing.max_nights || 365,
        latitude: listing.lat,
        longitude: listing.lng,
        hostThumbnail: listing.host_thumbnail_url || listing.host_thumbnail_url_small,
        description: listing.overview || listing.home_details?.overview || '',
        highlights: listing.detailed_p2_label_highlights || [],
        badges: listing.formatted_badges || listing.badges || [],
        
        // Review insights
        trustScore,
        // Note: Full review analysis is computationally expensive, so we'll add it on-demand
        // Users can click to get detailed review insights for specific properties
      }
      
      if (index === 0) {
        console.log(`✅ Sample: ${transformedListing.name} - $${transformedListing.price.rate} - ${transformedListing.images.length} images`)
      }
      
      return transformedListing
    }) // Remove the filter to see all results for debugging
    
  } catch (error) {
    console.error('Error transforming Airbnb HTTP results:', error)
    return []
  }
}

function extractHttpAmenities(listing: any): string[] {
  const amenities: string[] = []
  
  // Extract from amenity_ids (the actual field name)
  if (listing.amenity_ids || listing.amenityIds) {
    const amenityIds = listing.amenity_ids || listing.amenityIds
    // Extended amenity mapping based on Airbnb's API
    const amenityMap: Record<number, string> = {
      1: 'WiFi',
      4: 'Kitchen',
      8: 'Free parking',
      9: 'Wireless Internet',
      10: 'Pool',
      16: 'Breakfast',
      21: 'Elevator',
      23: 'Hot tub',
      25: 'Gym',
      30: 'Heating',
      33: 'Air conditioning',
      35: 'Washer',
      36: 'Dryer',
      37: 'Smoke alarm',
      38: 'Carbon monoxide alarm',
      39: 'First aid kit',
      40: 'Safety card',
      41: 'Fire extinguisher',
      44: 'Hangers',
      45: 'Hair dryer',
      46: 'Iron',
      47: 'Laptop friendly workspace',
      51: 'Private entrance',
      54: 'TV',
      55: 'Cable TV',
      57: 'Microwave',
      58: 'Coffee maker',
      59: 'Refrigerator',
      60: 'Dishwasher',
      61: 'Stove',
      62: 'BBQ grill',
      63: 'Garden or backyard',
      64: 'Beach access',
      65: 'Lake access',
      71: 'Self check-in',
      72: 'Lockbox',
      73: 'Private pool',
      74: 'Hot water',
      77: 'Bed linens',
      78: 'Extra pillows and blankets',
      79: 'Ethernet connection',
      85: 'Bathtub',
      86: 'Room-darkening shades',
      89: 'Body soap',
      90: 'Toilet paper',
      91: 'Towels included',
      93: 'Long term stays allowed',
      94: 'Host greets you'
    }
    
    if (Array.isArray(amenityIds)) {
      amenityIds.forEach((id: number) => {
        if (amenityMap[id]) {
          amenities.push(amenityMap[id])
        }
      })
    }
  }
  
  // Extract from preview tags
  if (listing.preview_tags && Array.isArray(listing.preview_tags)) {
    listing.preview_tags.forEach((tag: any) => {
      if (tag.name) {
        amenities.push(tag.name)
      }
    })
  }
  
  // Extract from detailed highlights
  if (listing.detailed_p2_label_highlights && Array.isArray(listing.detailed_p2_label_highlights)) {
    listing.detailed_p2_label_highlights.forEach((highlight: any) => {
      if (highlight.label) {
        amenities.push(highlight.label)
      }
    })
  }
  
  return [...new Set(amenities)] // Remove duplicates
}

// Calculate trust score based on rating and review count (same logic as review-analysis.ts)
function calculateTrustScore(rating: number, reviewsCount: number): number {
  if (!rating || !reviewsCount || reviewsCount === 0) return 0

  // Base score from rating (0-60 points)
  const ratingScore = Math.min(60, (rating / 5.0) * 60)

  // Review count confidence boost (0-40 points)
  let reviewCountScore = 0
  if (reviewsCount >= 100) {
    reviewCountScore = 40 // Very high confidence
  } else if (reviewsCount >= 50) {
    reviewCountScore = 35 // High confidence  
  } else if (reviewsCount >= 25) {
    reviewCountScore = 30 // Good confidence
  } else if (reviewsCount >= 10) {
    reviewCountScore = 20 // Moderate confidence
  } else if (reviewsCount >= 5) {
    reviewCountScore = 10 // Low confidence
  } else {
    reviewCountScore = 5 // Very low confidence
  }

  const totalScore = Math.round(ratingScore + reviewCountScore)
  return Math.min(100, Math.max(0, totalScore))
}