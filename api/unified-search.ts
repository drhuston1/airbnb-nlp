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
      console.log('🏨 Booking.com: HTTP API not yet implemented')
    }

    if (platforms.includes('vrbo')) {
      console.log('🏖️ VRBO: HTTP API not yet implemented')
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
        if (platformResult.status === 'success' && (platformResult.data?.listings || platformResult.data?.results)) {
          // Add platform identifier to each listing
          const rawListings = platformResult.data.listings || platformResult.data.results
          const platformListings = rawListings.map((listing: any) => ({
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
    
    // Simplified search using the search endpoint instead of GraphQL
    const searchUrl = new URL('https://www.airbnb.com/api/v2/explore_tabs')
    searchUrl.searchParams.set('version', '1.3.9')
    searchUrl.searchParams.set('_format', 'for_explore_search_web')
    searchUrl.searchParams.set('items_per_grid', '20')
    searchUrl.searchParams.set('federated_search_session_id', Date.now().toString())
    searchUrl.searchParams.set('tab_id', 'home_tab')
    searchUrl.searchParams.set('refinement_paths[]', '/homes')
    searchUrl.searchParams.set('query', location)
    searchUrl.searchParams.set('place_id', '')
    searchUrl.searchParams.set('checkin', '')
    searchUrl.searchParams.set('checkout', '')
    searchUrl.searchParams.set('adults', adults.toString())
    searchUrl.searchParams.set('children', children.toString())
    searchUrl.searchParams.set('infants', '0')
    searchUrl.searchParams.set('guests', (adults + children).toString())
    searchUrl.searchParams.set('min_bathrooms', '0')
    searchUrl.searchParams.set('min_bedrooms', '0')
    searchUrl.searchParams.set('min_beds', '0')
    searchUrl.searchParams.set('min_num_pic_urls', '10')
    searchUrl.searchParams.set('monthly_start_date', '')
    searchUrl.searchParams.set('monthly_length', '')
    searchUrl.searchParams.set('price_min', '0')
    searchUrl.searchParams.set('price_max', '1000')
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
    
    // Log structure for monitoring
    console.log(`🔍 Raw listing keys:`, Object.keys(listingCards[0]).slice(0, 10))
    
    return listingCards.map((item: any, index: number) => {
      // Handle both explore_tabs and GraphQL formats
      const listing = item.listing || item
      
      // Log first listing for monitoring
      if (index === 0) {
        console.log(`🔍 Processing first listing with ID: ${listing.id}`)
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
      
      // Better image extraction
      let images: string[] = []
      if (listing.picture_urls && Array.isArray(listing.picture_urls)) {
        images = listing.picture_urls
      } else if (listing.contextual_pictures && Array.isArray(listing.contextual_pictures)) {
        images = listing.contextual_pictures.map((pic: any) => pic.picture).filter(Boolean)
      } else if (listing.picture_url) {
        images = [listing.picture_url]
      }

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
        rating: parseFloat(listing.avg_rating_localized) || listing.star_rating || listing.avgRating || 4.0,
        reviewsCount: listing.reviews_count || listing.reviewsCount || 0,
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
        platform: 'airbnb' as const,
        
        // Enhanced data for better cards
        bedrooms: listing.bedrooms || 0,
        bathrooms: listing.bathrooms || 0,
        beds: listing.beds || 0,
        maxGuests: listing.person_capacity || 1,
        propertyType: listing.room_and_property_type || listing.space_type || 'Property',
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
        badges: listing.formatted_badges || listing.badges || []
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