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
  title: string
  price: number
  rating: number
  reviewCount: number
  imageUrl: string
  url: string
  hostName: string
  propertyType: string
  bedrooms: number
  bathrooms: number
  amenities: string[]
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
    
    // Step 2: Build search request parameters
    const searchPayload = buildSearchPayload(params)
    console.log('🔧 Built search payload')
    
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
  const rawParams = [
    { filterName: 'adults', filterValues: [params.adults?.toString() || '1'] }
  ]
  
  if (params.children && params.children > 0) {
    rawParams.push({ filterName: 'children', filterValues: [params.children.toString()] })
  }
  
  if (params.checkin && params.checkout) {
    rawParams.push({ filterName: 'checkin', filterValues: [params.checkin] })
    rawParams.push({ filterName: 'checkout', filterValues: [params.checkout] })
  }
  
  return {
    operationName: 'StaysSearch',
    locale: 'en',
    currency: 'USD',
    variables: {
      staysSearchRequest: {
        requestedPageType: 'STAYS_SEARCH',
        metadataOnly: false,
        source: 'structured_search_input_header',
        searchType: 'filter_change',
        treatmentFlags: [
          'stays_search_rehydration_treatment_desktop',
          'stays_search_rehydration_treatment_moweb'
        ],
        rawParams: [
          ...rawParams,
          { filterName: 'location', filterValues: [params.location] }
        ]
      }
    }
  }
}

function transformAirbnbResults(data: any): AirbnbListing[] {
  try {
    // Navigate Airbnb's response structure
    const sections = data?.data?.dora?.exploreV3?.sections || []
    const staysSection = sections.find((section: any) => 
      section.sectionComponentType === 'STAYS_GRID' || 
      section.listingCards?.length > 0
    )
    
    if (!staysSection?.listingCards) {
      console.warn('No listing cards found in response')
      return []
    }
    
    return staysSection.listingCards.map((card: any) => {
      const listing = card.listing || {}
      const pricingQuote = card.pricingQuote || {}
      
      return {
        id: listing.id || '',
        title: listing.name || 'Untitled Property',
        price: pricingQuote.structuredStayDisplayPrice?.primaryLine?.price || 0,
        rating: listing.avgRating || 4.0,
        reviewCount: listing.reviewsCount || 0,
        imageUrl: listing.contextualPictures?.[0]?.picture || listing.pictureUrls?.[0] || '',
        url: `https://www.airbnb.com/rooms/${listing.id}`,
        hostName: listing.user?.firstName || 'Host',
        propertyType: listing.roomTypeCategory || 'Property',
        bedrooms: listing.bedrooms || 0,
        bathrooms: listing.bathrooms || 0,
        amenities: extractAmenities(listing)
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
  
  return [...new Set(amenities)] // Remove duplicates
}