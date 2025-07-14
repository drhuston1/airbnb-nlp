// HTTP API-based Airbnb search (no browser automation needed)
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface AirbnbSearchParams {
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  page?: number
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
  propertyType?: string
  platform?: string
  bedrooms?: number
  bathrooms?: number
  beds?: number
  maxGuests?: number
  trustScore?: number
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🔍 Starting HTTP API-based Airbnb search...')
    
    const params: AirbnbSearchParams = req.body
    console.log('📋 Search parameters:', params)
    
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
    
    console.log('✅ Session initialized with cookies and CSRF token')
    
    // Step 2: Build search URL
    const searchUrl = buildSearchPayload(params)
    console.log('🔧 Built search URL')
    
    // Step 3: Make search API call
    console.log('🚀 Making search API request...')
    console.log('URL:', searchUrl)
    const searchResponse = await fetch(searchUrl, {
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
    
    // Step 4: Transform results to our format
    const listings = transformAirbnbResults(searchData)
    console.log(`🎉 Successfully found ${listings.length} listings`)
    
    return res.status(200).json({
      success: true,
      platform: 'airbnb',
      query: params.location,
      totalResults: listings.length,
      results: listings,
      metadata: {
        searchType: 'http_api',
        timestamp: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ Airbnb API search failed:', error)
    return res.status(500).json({
      success: false,
      platform: 'airbnb',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

function buildSearchPayload(params: AirbnbSearchParams) {
  // Simplified approach using URL parameters instead of complex GraphQL
  const searchUrl = new URL('https://www.airbnb.com/api/v2/explore_tabs')
  searchUrl.searchParams.set('version', '1.3.9')
  searchUrl.searchParams.set('_format', 'for_explore_search_web')
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
  
  // Core search parameters
  searchUrl.searchParams.set('query', params.location)
  searchUrl.searchParams.set('place_id', '')
  searchUrl.searchParams.set('checkin', params.checkin || '')
  searchUrl.searchParams.set('checkout', params.checkout || '')
  searchUrl.searchParams.set('adults', (params.adults || 1).toString())
  searchUrl.searchParams.set('children', (params.children || 0).toString())
  searchUrl.searchParams.set('infants', '0')
  searchUrl.searchParams.set('guests', ((params.adults || 1) + (params.children || 0)).toString())
  searchUrl.searchParams.set('min_bathrooms', '0')
  searchUrl.searchParams.set('min_bedrooms', '0')
  searchUrl.searchParams.set('min_beds', '0')
  searchUrl.searchParams.set('min_num_pic_urls', '1')
  searchUrl.searchParams.set('monthly_start_date', '')
  searchUrl.searchParams.set('monthly_length', '')
  searchUrl.searchParams.set('price_min', '0')
  searchUrl.searchParams.set('price_max', '1000')
  searchUrl.searchParams.set('room_types[]', 'Entire home/apt')
  searchUrl.searchParams.set('top_tier_stays[]', 'true')
  searchUrl.searchParams.set('satori_version', '1.2.0')
  searchUrl.searchParams.set('_cb', Date.now().toString())
  
  return searchUrl.toString()
}

function transformAirbnbResults(data: any): AirbnbListing[] {
  try {
    // Navigate explore_tabs API response structure
    let listingCards: any[] = []
    
    // Structure 1: explore_tabs sections
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
    
    if (!listingCards.length) {
      console.warn('No listing cards found in any known response structure')
      console.log('🔍 Available top-level keys:', Object.keys(data))
      return []
    }
    
    return listingCards.map((item: any, index: number) => {
      // Handle both explore_tabs and listing formats
      const listing = item.listing || item
      
      // Log first listing for monitoring
      if (index === 0) {
        console.log(`🔍 Raw listing fields:`, Object.keys(listing))
      }
      
      // More robust ID extraction
      const listingId = listing.id || item.id || listing.listing_id || item.listing_id || `temp_${index}`
      
      // Extract price information
      let price = 0
      if (listing.pricing_quote?.rate?.amount) {
        price = listing.pricing_quote.rate.amount
      } else if (listing.price?.rate) {
        price = listing.price.rate
      } else if (item.pricing_quote?.rate?.amount) {
        price = item.pricing_quote.rate.amount
      }
      
      // Extract images array
      let images: string[] = []
      if (listing.contextual_pictures && Array.isArray(listing.contextual_pictures)) {
        images = listing.contextual_pictures.map((pic: any) => pic.picture || pic.url || pic.src).filter(Boolean)
      } else if (listing.picture_url) {
        images = [listing.picture_url]
      }
      
      const rating = listing.avg_rating || listing.avgRating || listing.rating || 4.0
      const reviewsCount = listing.reviews_count || listing.reviewsCount || listing.reviewCount || 0
      const trustScore = calculateTrustScore(rating, reviewsCount)
      
      return {
        id: listingId,
        name: listing.name || listing.title || 'Untitled Property',
        url: `https://www.airbnb.com/rooms/${listingId}`,
        images,
        price: {
          total: price,
          rate: price,
          currency: 'USD'
        },
        rating,
        reviewsCount,
        location: {
          city: listing.localized_city || listing.city || 'Unknown',
          country: listing.localized_country || listing.country || 'Unknown'
        },
        host: {
          name: listing.primary_host?.host_name || listing.user?.firstName || listing.host?.name || 'Host',
          isSuperhost: listing.is_superhost || listing.user?.isSuperhost || listing.primary_host?.is_superhost || false
        },
        amenities: extractAmenities(listing),
        roomType: listing.room_type_category || listing.roomTypeCategory || 'Property',
        propertyType: listing.room_and_property_type || listing.space_type || 'Property',
        platform: 'airbnb',
        bedrooms: listing.bedrooms || listing.bedroom_count || 0,
        bathrooms: listing.bathrooms || (listing.bathroomLabel ? parseInt(listing.bathroomLabel) : 0) || 0,
        beds: listing.beds || 0,
        maxGuests: listing.person_capacity || 1,
        trustScore
      }
    }).filter((listing: AirbnbListing) => listing.id) // Remove invalid entries
    
  } catch (error) {
    console.error('Error transforming Airbnb results:', error)
    return []
  }
}

function extractAmenities(listing: any): string[] {
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
  
  return Array.from(new Set(amenities)) // Remove duplicates
}

// Calculate trust score based on rating and review count
function calculateTrustScore(rating: number, reviewsCount: number): number {
  if (!rating || !reviewsCount || reviewsCount === 0) return 0

  // Base score from rating (0-60 points)
  const ratingScore = Math.min(60, (rating / 5.0) * 60)

  // Review count confidence boost (0-40 points)
  let reviewCountScore = 0
  if (reviewsCount >= 100) {
    reviewCountScore = 40
  } else if (reviewsCount >= 50) {
    reviewCountScore = 35
  } else if (reviewsCount >= 25) {
    reviewCountScore = 30
  } else if (reviewsCount >= 10) {
    reviewCountScore = 20
  } else if (reviewsCount >= 5) {
    reviewCountScore = 10
  } else {
    reviewCountScore = 5
  }

  const totalScore = Math.round(ratingScore + reviewCountScore)
  return Math.min(100, Math.max(0, totalScore))
}