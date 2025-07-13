// Airbnb search API using HTTP API only
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface UnifiedSearchRequest {
  query: string
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  priceMin?: number
  priceMax?: number
  minBedrooms?: number
  minBathrooms?: number
  page?: number
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
  bedrooms?: number
  bathrooms?: number
  beds?: number
  maxGuests?: number
  trustScore?: number
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
      priceMin,
      priceMax,
      page = 1,
      minBedrooms,
      minBathrooms
    }: UnifiedSearchRequest = req.body

    console.log('Airbnb search request:', { query, location, adults, children, priceMin, priceMax, minBedrooms, minBathrooms })

    if (!location) {
      return res.status(400).json({ error: 'Location is required for search' })
    }

    // Search Airbnb using HTTP API only
    console.log('🚀 Searching Airbnb using HTTP API...')
    
    const result = await callAirbnbHttpAPI({
      query,
      location,
      checkin,
      checkout,
      adults,
      children,
      priceMin,
      priceMax,
      minBedrooms,
      minBathrooms,
      page
    })

    console.log('Airbnb search completed:', { status: 'success' })

    // Process Airbnb results
    let allListings: UnifiedProperty[] = []
    const sourceStatus: UnifiedSearchResponse['sources'] = []

    if (result.status === 'success' && result.data?.results) {
      allListings = result.data.results
      
      sourceStatus.push({
        platform: 'airbnb',
        count: allListings.length,
        status: 'success'
      })
    } else {
      sourceStatus.push({
        platform: 'airbnb', 
        count: 0,
        status: 'error',
        error: result.error || 'Unknown error'
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
      error: 'Failed to perform search',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// HTTP API implementation for Airbnb
async function callAirbnbHttpAPI(payload: any) {
  console.log('🔍 Starting HTTP API-based Airbnb search...')
  
  const { location, adults = 1, children = 0, checkin, checkout, priceMin, priceMax, minBedrooms, minBathrooms } = payload
  
  // Log filtering parameters
  if (checkin && checkout) {
    console.log(`📅 Filtering by dates: ${checkin} to ${checkout}`)
  }
  if (priceMin || priceMax) {
    console.log(`💰 Filtering by price: $${priceMin || 0} - $${priceMax || 'unlimited'}`)
  }
  if (minBedrooms) {
    console.log(`🛏️ Filtering by bedrooms: ${minBedrooms}+ bedrooms`)
  }
  if (minBathrooms) {
    console.log(`🛁 Filtering by bathrooms: ${minBathrooms}+ bathrooms`)
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
    searchUrl.searchParams.set('min_bathrooms', (minBathrooms || 0).toString())
    searchUrl.searchParams.set('min_bedrooms', (minBedrooms || 0).toString())
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
    
    // Step 4: Transform results to our format
    const listings = transformAirbnbHttpResults(searchData)
    console.log(`🎉 HTTP API found ${listings.length} listings`)
    
    return {
      platform: 'airbnb',
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
    return {
      platform: 'airbnb',
      data: null,
      status: 'error' as const,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function transformAirbnbHttpResults(data: any): UnifiedProperty[] {
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
    
    if (!listingCards.length) {
      console.warn('No listing cards found in any known response structure')
      console.log('🔍 Available top-level keys:', Object.keys(data))
      return []
    }
    
    return listingCards.map((item: any, index: number) => {
      // Handle both explore_tabs and GraphQL formats
      const listing = item.listing || item
      
      // Log first listing for monitoring
      if (index === 0) {
        console.log(`🔍 Raw listing fields:`, Object.keys(listing))
        console.log(`🔍 First listing data:`, {
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          beds: listing.beds,
          person_capacity: listing.person_capacity,
          avg_rating_localized: listing.avg_rating_localized,
          reviews_count: listing.reviews_count,
          room_type_category: listing.room_type_category,
          room_and_property_type: listing.room_and_property_type
        })
      }
      
      // More robust ID extraction
      const listingId = listing.id || item.id || listing.listing_id || item.listing_id || `temp_${index}`
      
      // Try to get the actual URL from the API response first
      let listingUrl = listing.url || item.url || listing.listing_url || item.listing_url
      
      // If no URL provided, construct one, but validate the ID format first
      if (!listingUrl) {
        // Airbnb listing IDs are typically numeric, but can be very long
        const cleanId = listingId.toString().replace(/[^0-9]/g, '')
        if (cleanId && cleanId.length > 0) {
          listingUrl = `https://www.airbnb.com/rooms/${cleanId}`
        } else {
          // Fallback to search if ID is invalid
          const searchQuery = encodeURIComponent(listing.name || listing.public_address || 'property')
          listingUrl = `https://www.airbnb.com/s/?query=${searchQuery}`
        }
      }
      
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
      
      // Extract images with enhanced debugging
      let images: string[] = []
      
      // Log available image-related fields for debugging
      if (index === 0) {
        console.log('🖼️ Image fields available:', {
          pictures: listing.pictures ? `Array(${listing.pictures.length})` : 'none',
          picture_urls: listing.picture_urls ? `Array(${listing.picture_urls.length})` : 'none',
          xl_picture_url: listing.xl_picture_url || 'none',
          picture_url: listing.picture_url || 'none',
          photos: listing.photos ? `Array(${listing.photos.length})` : 'none',
          images: listing.images ? `Array(${listing.images.length})` : 'none'
        })
      }
      
      // Try multiple image extraction strategies
      if (listing.photos && Array.isArray(listing.photos) && listing.photos.length > 0) {
        // New API structure - photos array
        images = listing.photos.map((photo: any) => {
          if (photo.picture) return photo.picture
          if (photo.url) return photo.url
          if (photo.src) return photo.src
          if (typeof photo === 'string') return photo
          return null
        }).filter(Boolean)
      } else if (listing.pictures && Array.isArray(listing.pictures) && listing.pictures.length > 0) {
        // Legacy structure - pictures array
        images = listing.pictures.map((pic: any) => {
          if (pic.picture) return pic.picture
          if (pic.url) return pic.url
          if (typeof pic === 'string') return pic
          return null
        }).filter(Boolean)
      } else if (listing.picture_url) {
        // Single picture URL (most common in current API)
        images = [listing.picture_url]
      } else if (listing.picture_urls && Array.isArray(listing.picture_urls) && listing.picture_urls.length > 0) {
        // Array of picture URLs
        images = listing.picture_urls.filter(Boolean)
      } else if (listing.xl_picture_url) {
        images = [listing.xl_picture_url]
      } else if (listing.images && Array.isArray(listing.images)) {
        // Sometimes images are directly in an 'images' field
        images = listing.images.filter(Boolean)
      } else if (listing.id) {
        // Last resort: try to construct Airbnb image URLs
        const baseId = listing.id.toString()
        console.log(`⚠️ No images found for listing ${baseId}, attempting URL construction`)
        images = [
          `https://a0.muscache.com/im/pictures/hosting/Hosting-${baseId}/original/`,
          `https://a0.muscache.com/im/pictures/miso/Hosting-${baseId}/original/`,
          `https://a0.muscache.com/im/pictures/${baseId}/original/`
        ]
      }
      
      if (index === 0 && images.length > 0) {
        console.log(`✅ Extracted ${images.length} images, first: ${images[0]}`)
      } else if (index === 0) {
        console.log('❌ No images extracted for first listing')
      }

      const rating = parseFloat(listing.avg_rating_localized) || listing.star_rating || listing.avgRating || 4.0
      const reviewsCount = listing.reviews_count || listing.reviewsCount || 0
      
      // Calculate trust score
      const trustScore = calculateTrustScore(rating, reviewsCount)
      
      const transformedListing: UnifiedProperty = {
        id: listingId?.toString() || `fallback_${index}`,
        name: listing.name || listing.public_address || `Property ${index + 1}`,
        url: listingUrl,
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
        trustScore
      }
      
      if (index === 0) {
        console.log(`✅ Sample transformed: ${transformedListing.name} - $${transformedListing.price.rate} - ${transformedListing.bedrooms}br/${transformedListing.bathrooms}ba - Trust: ${transformedListing.trustScore}`)
      }
      
      return transformedListing
    })
    
  } catch (error) {
    console.error('Error transforming Airbnb HTTP results:', error)
    return []
  }
}

function extractHttpAmenities(listing: any): string[] {
  const amenities: string[] = []
  
  // Extract from amenity_ids
  if (listing.amenity_ids || listing.amenityIds) {
    const amenityIds = listing.amenity_ids || listing.amenityIds
    // Extended amenity mapping based on Airbnb's API
    const amenityMap: Record<number, string> = {
      1: 'WiFi',
      4: 'Kitchen',
      8: 'Free parking',
      10: 'Pool',
      23: 'Hot tub',
      25: 'Gym',
      30: 'Heating',
      33: 'Air conditioning',
      35: 'Washer',
      36: 'Dryer',
      47: 'Laptop friendly workspace',
      54: 'TV',
      71: 'Self check-in'
    }
    
    if (Array.isArray(amenityIds)) {
      amenityIds.forEach((id: number) => {
        if (amenityMap[id]) {
          amenities.push(amenityMap[id])
        }
      })
    }
  }
  
  return [...new Set(amenities)] // Remove duplicates
}

// Calculate trust score based on rating and review count
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