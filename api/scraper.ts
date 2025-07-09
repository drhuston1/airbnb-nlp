// Web scraper for property listings from multiple platforms
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ScraperManager, waitForSelector, extractNumber, extractRating, randomDelay, sanitizeText, extractAmenitiesFromText } from './scraper-utils'

interface ScraperRequest {
  platform: 'airbnb' | 'booking' | 'vrbo'
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  page?: number
}

interface ScrapedProperty {
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
  platform: 'airbnb' | 'booking' | 'vrbo'
}

interface ScraperResponse {
  listings: ScrapedProperty[]
  hasMore: boolean
  totalResults: number
  page: number
  searchUrl: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { 
      platform, 
      location, 
      checkin, 
      checkout, 
      adults = 2, 
      children = 0, 
      page = 1 
    }: ScraperRequest = req.body

    if (!platform || !location) {
      return res.status(400).json({ error: 'Platform and location are required' })
    }

    console.log(`Starting ${platform} scraper for:`, { location, adults, children, page })

    let result: ScraperResponse

    switch (platform) {
      case 'airbnb':
        result = await scrapeAirbnb({ location, checkin, checkout, adults, children, page })
        break
      case 'booking':
        result = await scrapeBooking({ location, checkin, checkout, adults, children, page })
        break
      case 'vrbo':
        result = await scrapeVrbo({ location, checkin, checkout, adults, children, page })
        break
      default:
        return res.status(400).json({ error: 'Unsupported platform' })
    }

    console.log(`${platform} scraper completed: ${result.listings.length} properties found`)
    return res.status(200).json(result)

  } catch (error) {
    console.error('Scraper error:', error)
    return res.status(500).json({ 
      error: 'Scraper failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function scrapeAirbnb(params: Omit<ScraperRequest, 'platform'>): Promise<ScraperResponse> {
  const scraper = new ScraperManager()
  
  try {
    await scraper.initialize()
    const page = await scraper.createPage()

    // Build Airbnb search URL
    const searchUrl = buildAirbnbUrl(params)
    console.log('Navigating to Airbnb URL:', searchUrl)

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // Add random delay to appear more human-like
    await randomDelay(2000, 4000)

    // Wait for listings to load
    const hasListings = await waitForSelector(page, '[data-testid="card-container"]', 15000)
    
    if (!hasListings) {
      console.warn('No listings found on Airbnb page')
      return {
        listings: [],
        hasMore: false,
        totalResults: 0,
        page: params.page || 1,
        searchUrl
      }
    }

    // Extract listings data
    const listings = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="card-container"]')
      const results: any[] = []

      cards.forEach((card, index) => {
        try {
          // Extract basic info
          const nameElement = card.querySelector('[data-testid="listing-card-title"]')
          const name = sanitizeText(nameElement?.textContent || `Property ${index + 1}`)

          const linkElement = card.querySelector('a[href*="/rooms/"]') as HTMLAnchorElement
          const relativeUrl = linkElement?.href || ''
          const url = relativeUrl.startsWith('http') ? relativeUrl : `https://www.airbnb.com${relativeUrl}`

          // Extract ID from URL
          const idMatch = url.match(/\/rooms\/(\d+)/)
          const id = idMatch ? idMatch[1] : `airbnb_${index}`

          // Extract image
          const imgElement = card.querySelector('img[data-testid="card-image"]') as HTMLImageElement
          const image = imgElement?.src || ''
          const images = image ? [image] : []

          // Extract price
          const priceElement = card.querySelector('[data-testid="price-availability-row"] span')
          const priceText = priceElement?.textContent || '$100'
          const priceMatch = priceText.match(/\$(\d+(?:,\d+)*)/)
          const rate = priceMatch ? parseInt(priceMatch[1].replace(',', '')) : 100

          // Extract rating
          const ratingElement = card.querySelector('[data-testid="listing-card-subtitle"]')
          const ratingText = ratingElement?.textContent || ''
          const ratingMatch = ratingText.match(/([\d.]+)/)
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.0

          // Extract review count
          const reviewMatch = ratingText.match(/\(([\d,]+)\)/)
          const reviewsCount = reviewMatch ? parseInt(reviewMatch[1].replace(',', '')) : 0

          // Extract room type
          const subtitleElements = card.querySelectorAll('[data-testid="listing-card-subtitle"]')
          const roomType = subtitleElements.length > 1 ? 
            subtitleElements[1]?.textContent?.trim() || 'Entire place' : 
            'Entire place'

          // Check for superhost badge
          const superhostElement = card.querySelector('[data-testid="superhost-badge"]')
          const isSuperhost = !!superhostElement

          results.push({
            id,
            name,
            url,
            images,
            price: {
              total: rate * 7, // Estimate weekly total
              rate,
              currency: 'USD'
            },
            rating,
            reviewsCount,
            location: {
              city: (window as any).searchLocation || 'Unknown',
              country: 'US'
            },
            host: {
              name: isSuperhost ? 'Superhost' : 'Host',
              isSuperhost
            },
            amenities: extractAmenitiesFromName(name),
            roomType,
            platform: 'airbnb'
          })
        } catch (error) {
          console.error('Error extracting listing:', error)
        }
      })

      return results
    })

    // Set search location for listings
    await page.evaluate((location: string) => {
      (window as any).searchLocation = location
    }, params.location)

    // Update listings with correct location
    const updatedListings = listings.map(listing => ({
      ...listing,
      location: {
        city: params.location,
        country: 'US'
      }
    }))

    return {
      listings: updatedListings,
      hasMore: listings.length >= 18,
      totalResults: listings.length,
      page: params.page || 1,
      searchUrl
    }

  } finally {
    await scraper.close()
  }
}

async function scrapeBooking(params: Omit<ScraperRequest, 'platform'>): Promise<ScraperResponse> {
  const scraper = new ScraperManager()
  
  try {
    await scraper.initialize()
    const page = await scraper.createPage()

    // Build Booking.com search URL
    const searchUrl = buildBookingUrl(params)
    console.log('Navigating to Booking.com URL:', searchUrl)

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // Add random delay
    await randomDelay(2000, 4000)

    // Handle potential cookie banner
    const hasPropertyCards = await waitForSelector(page, '[data-testid="property-card"]', 10000)
    const hasTitles = hasPropertyCards || await waitForSelector(page, '[data-testid="title"]', 5000)
    
    if (!hasTitles) {
      console.warn('No listings found on Booking.com page')
      return {
        listings: [],
        hasMore: false,
        totalResults: 0,
        page: params.page || 1,
        searchUrl
      }
    }

    // Extract listings data
    const listings = await page.evaluate(() => {
      const cards = document.querySelectorAll('[data-testid="property-card"]')
      const results: any[] = []

      cards.forEach((card, index) => {
        try {
          // Extract basic info
          const nameElement = card.querySelector('[data-testid="title"]')
          const name = sanitizeText(nameElement?.textContent || `Property ${index + 1}`)

          const linkElement = card.querySelector('a[data-testid="title-link"]') as HTMLAnchorElement
          const url = linkElement?.href || ''

          // Extract ID from URL or create one
          const idMatch = url.match(/hotel\/([^\/\?]+)/)
          const id = idMatch ? idMatch[1] : `booking_${index}`

          // Extract image
          const imgElement = card.querySelector('img[data-testid="image"]') as HTMLImageElement
          const image = imgElement?.src || ''
          const images = image ? [image] : []

          // Extract price
          const priceElement = card.querySelector('[data-testid="price-and-discounted-price"]')
          const priceText = priceElement?.textContent || '$100'
          const priceMatch = priceText.match(/\$(\d+(?:,\d+)*)/)
          const rate = priceMatch ? parseInt(priceMatch[1].replace(',', '')) : 100

          // Extract rating
          const ratingElement = card.querySelector('[data-testid="review-score"]')
          const ratingText = ratingElement?.textContent || ''
          const ratingMatch = ratingText.match(/([\d.]+)/)
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.0

          // Extract review count
          const reviewElement = card.querySelector('[data-testid="review-score"] + div')
          const reviewText = reviewElement?.textContent || ''
          const reviewMatch = reviewText.match(/([\d,]+)/)
          const reviewsCount = reviewMatch ? parseInt(reviewMatch[1].replace(',', '')) : 0

          // Extract property type
          const typeElement = card.querySelector('[data-testid="property-type-badge"]')
          const roomType = typeElement?.textContent?.trim() || 'Hotel'

          results.push({
            id,
            name,
            url,
            images,
            price: {
              total: rate * 7, // Estimate weekly total
              rate,
              currency: 'USD'
            },
            rating: rating / 2, // Convert from 10-point to 5-point scale
            reviewsCount,
            location: {
              city: (window as any).searchLocation || 'Unknown',
              country: 'US'
            },
            host: {
              name: 'Hotel',
              isSuperhost: false
            },
            amenities: extractAmenitiesFromName(name),
            roomType,
            platform: 'booking'
          })
        } catch (error) {
          console.error('Error extracting listing:', error)
        }
      })

      return results
    })

    // Update listings with correct location
    const updatedListings = listings.map(listing => ({
      ...listing,
      location: {
        city: params.location,
        country: 'US'
      }
    }))

    return {
      listings: updatedListings,
      hasMore: listings.length >= 18,
      totalResults: listings.length,
      page: params.page || 1,
      searchUrl
    }

  } finally {
    await scraper.close()
  }
}

async function scrapeVrbo(params: Omit<ScraperRequest, 'platform'>): Promise<ScraperResponse> {
  const scraper = new ScraperManager()
  
  try {
    await scraper.initialize()
    const page = await scraper.createPage()

    // Build VRBO search URL
    const searchUrl = buildVrboUrl(params)
    console.log('Navigating to VRBO URL:', searchUrl)

    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 })

    // Add random delay
    await randomDelay(2000, 4000)

    // Wait for listings to load - VRBO uses different selectors
    const hasListings = await waitForSelector(page, '[data-testid="listings-card"]', 15000) ||
                       await waitForSelector(page, '.SearchResult', 10000) ||
                       await waitForSelector(page, '[data-stid="lodging-card-responsive"]', 10000)
    
    if (!hasListings) {
      console.warn('No listings found on VRBO page')
      return {
        listings: [],
        hasMore: false,
        totalResults: 0,
        page: params.page || 1,
        searchUrl
      }
    }

    // Extract listings data
    const listings = await page.evaluate(() => {
      // Try multiple selectors for VRBO listings
      let cards = document.querySelectorAll('[data-testid="listings-card"]')
      if (cards.length === 0) {
        cards = document.querySelectorAll('.SearchResult')
      }
      if (cards.length === 0) {
        cards = document.querySelectorAll('[data-stid="lodging-card-responsive"]')
      }
      
      const results: any[] = []

      cards.forEach((card, index) => {
        try {
          // Extract basic info - VRBO has different structure
          const nameElement = card.querySelector('h3 a') || 
                             card.querySelector('[data-testid="listing-card-title"]') ||
                             card.querySelector('.ListingHeadline a')
          const name = nameElement?.textContent?.trim() || `VRBO Property ${index + 1}`

          const linkElement = nameElement as HTMLAnchorElement
          const relativeUrl = linkElement?.href || ''
          const url = relativeUrl.startsWith('http') ? relativeUrl : `https://www.vrbo.com${relativeUrl}`

          // Extract ID from URL
          const idMatch = url.match(/\/(\d+)/) || url.match(/\/([a-zA-Z0-9]+)$/)
          const id = idMatch ? idMatch[1] : `vrbo_${index}`

          // Extract image
          const imgElement = card.querySelector('img') as HTMLImageElement
          const image = imgElement?.src || ''
          const images = image ? [image] : []

          // Extract price - VRBO shows nightly rates
          const priceElement = card.querySelector('[data-testid="price-summary"]') ||
                              card.querySelector('.Price') ||
                              card.querySelector('[data-stid="price-display"]')
          const priceText = priceElement?.textContent || '$100'
          const priceMatch = priceText.match(/\$(\d+(?:,\d+)*)/)
          const rate = priceMatch ? parseInt(priceMatch[1].replace(',', '')) : 100

          // Extract rating - VRBO uses 5-star system
          const ratingElement = card.querySelector('[data-testid="review-rating"]') ||
                               card.querySelector('.Reviews') ||
                               card.querySelector('[aria-label*="star"]')
          const ratingText = ratingElement?.textContent || ratingElement?.getAttribute('aria-label') || ''
          const ratingMatch = ratingText.match(/([\d.]+)/)
          const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.0

          // Extract review count
          const reviewElement = card.querySelector('[data-testid="review-count"]') ||
                               card.querySelector('.ReviewCount')
          const reviewText = reviewElement?.textContent || ''
          const reviewMatch = reviewText.match(/(\d+(?:,\d+)*)/)
          const reviewsCount = reviewMatch ? parseInt(reviewMatch[1].replace(',', '')) : 0

          // Extract property type
          const typeElement = card.querySelector('[data-testid="property-type"]') ||
                             card.querySelector('.PropertyType') ||
                             card.querySelector('.UnitType')
          const roomType = typeElement?.textContent?.trim() || 'Vacation Rental'

          // Extract location from card or use search location
          const locationElement = card.querySelector('[data-testid="property-location"]') ||
                                 card.querySelector('.Location')
          const locationText = locationElement?.textContent?.trim() || ''

          results.push({
            id,
            name: name.replace(/[^\w\s\-.,!?()]/g, ''),
            url,
            images,
            price: {
              total: rate * 7, // Estimate weekly total
              rate,
              currency: 'USD'
            },
            rating: Math.min(rating, 5), // Ensure 5-star max
            reviewsCount,
            location: {
              city: locationText || (window as any).searchLocation || 'Unknown',
              country: 'US'
            },
            host: {
              name: 'Host',
              isSuperhost: false // VRBO doesn't have superhost concept
            },
            amenities: extractAmenitiesFromText(name),
            roomType,
            platform: 'vrbo'
          })
        } catch (error) {
          console.error('Error extracting VRBO listing:', error)
        }
      })

      return results
    })

    // Set search location for listings
    await page.evaluate((location: string) => {
      (window as any).searchLocation = location
    }, params.location)

    // Update listings with correct location
    const updatedListings = listings.map(listing => ({
      ...listing,
      location: {
        city: params.location,
        country: 'US'
      }
    }))

    return {
      listings: updatedListings,
      hasMore: listings.length >= 20, // VRBO typically shows 20 per page
      totalResults: listings.length,
      page: params.page || 1,
      searchUrl
    }

  } finally {
    await scraper.close()
  }
}

function buildAirbnbUrl(params: Omit<ScraperRequest, 'platform'>): string {
  const { location, checkin, checkout, adults = 2, children = 0, page = 1 } = params
  
  const baseUrl = 'https://www.airbnb.com/s'
  const searchParams = new URLSearchParams()
  
  searchParams.set('query', location)
  searchParams.set('adults', adults.toString())
  if (children > 0) searchParams.set('children', children.toString())
  
  if (checkin && checkout) {
    searchParams.set('check_in', checkin)
    searchParams.set('check_out', checkout)
  }
  
  // Add pagination
  if (page > 1) {
    searchParams.set('items_offset', ((page - 1) * 18).toString())
  }
  
  return `${baseUrl}/${encodeURIComponent(location)}?${searchParams.toString()}`
}

function buildBookingUrl(params: Omit<ScraperRequest, 'platform'>): string {
  const { location, checkin, checkout, adults = 2, children = 0, page = 1 } = params
  
  const baseUrl = 'https://www.booking.com/searchresults.html'
  const searchParams = new URLSearchParams()
  
  searchParams.set('ss', location)
  searchParams.set('group_adults', adults.toString())
  if (children > 0) searchParams.set('group_children', children.toString())
  
  if (checkin && checkout) {
    searchParams.set('checkin', checkin)
    searchParams.set('checkout', checkout)
  }
  
  // Add pagination
  if (page > 1) {
    searchParams.set('offset', ((page - 1) * 25).toString())
  }
  
  searchParams.set('order', 'popularity')
  searchParams.set('nflt', 'ht_id%3D204') // Apartments/vacation rentals
  
  return `${baseUrl}?${searchParams.toString()}`
}

function buildVrboUrl(params: Omit<ScraperRequest, 'platform'>): string {
  const { location, checkin, checkout, adults = 2, children = 0, page = 1 } = params
  
  const baseUrl = 'https://www.vrbo.com/search'
  const searchParams = new URLSearchParams()
  
  // VRBO uses 'destination' instead of 'query'
  searchParams.set('destination', location)
  searchParams.set('adults', adults.toString())
  if (children > 0) searchParams.set('children', children.toString())
  
  if (checkin && checkout) {
    // VRBO uses different date format
    searchParams.set('arrival', checkin)
    searchParams.set('departure', checkout)
  }
  
  // Add pagination for VRBO
  if (page > 1) {
    searchParams.set('page', page.toString())
  }
  
  // VRBO specific parameters
  searchParams.set('sort', 'RECOMMENDED') // Default sort
  searchParams.set('propertyType', 'HOUSE,APARTMENT,CONDO') // Focus on vacation rentals
  
  return `${baseUrl}?${searchParams.toString()}`
}

// Add missing utility functions inline (fallback if import fails)
function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\w\s\-.,!?()]/g, '')
}

function extractAmenitiesFromName(name: string): string[] {
  return extractAmenitiesFromText(name)
}