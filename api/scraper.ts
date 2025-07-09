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
  const startTime = Date.now()
  console.log('🚀 Scraper API request started at:', new Date().toISOString())
  
  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method)
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

    console.log('📝 Request parameters:')
    console.log('  - Platform:', platform)
    console.log('  - Location:', location)
    console.log('  - Check-in:', checkin || 'not provided')
    console.log('  - Check-out:', checkout || 'not provided')
    console.log('  - Adults:', adults)
    console.log('  - Children:', children)
    console.log('  - Page:', page)

    if (!platform || !location) {
      console.log('❌ Missing required parameters')
      return res.status(400).json({ error: 'Platform and location are required' })
    }

    console.log(`🎯 Starting ${platform} scraper for:`, { location, adults, children, page })

    let result: ScraperResponse

    switch (platform) {
      case 'airbnb':
        console.log('🏠 Initiating Airbnb scraper...')
        result = await scrapeAirbnb({ location, checkin, checkout, adults, children, page })
        break
      case 'booking':
        console.log('🏨 Initiating Booking.com scraper...')
        result = await scrapeBooking({ location, checkin, checkout, adults, children, page })
        break
      case 'vrbo':
        console.log('🏖️ Initiating VRBO scraper...')
        result = await scrapeVrbo({ location, checkin, checkout, adults, children, page })
        break
      default:
        console.log('❌ Unsupported platform:', platform)
        return res.status(400).json({ error: 'Unsupported platform' })
    }

    const duration = Date.now() - startTime
    console.log(`✅ ${platform} scraper completed successfully!`)
    console.log('📊 Results summary:')
    console.log('  - Properties found:', result.listings.length)
    console.log('  - Has more pages:', result.hasMore)
    console.log('  - Total duration:', `${duration}ms`)
    console.log('  - Images extracted:', result.listings.reduce((acc, listing) => acc + listing.images.length, 0))
    
    return res.status(200).json(result)

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ Scraper failed after', `${duration}ms`)
    console.error('🔍 Error details:')
    console.error('  - Type:', error.constructor.name)
    console.error('  - Message:', error.message)
    console.error('  - Stack:', error.stack)
    
    return res.status(500).json({ 
      error: 'Scraper failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    })
  }
}

async function scrapeAirbnb(params: Omit<ScraperRequest, 'platform'>): Promise<ScraperResponse> {
  console.log('🏠 Starting Airbnb scraper function')
  const scraper = new ScraperManager()
  
  try {
    console.log('⚙️ Initializing scraper manager...')
    await scraper.initialize()
    
    console.log('📄 Creating page...')
    const page = await scraper.createPage()

    // Build Airbnb search URL
    const searchUrl = buildAirbnbUrl(params)
    console.log('🔗 Built Airbnb URL:', searchUrl)

    console.log('🌐 Navigating to Airbnb...')
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })
    console.log('✅ Navigation completed')

    // Add random delay to appear more human-like
    console.log('⏱️ Adding human-like delay...')
    await randomDelay(2000, 4000)

    // Wait for listings to load
    console.log('🔍 Waiting for listings to load...')
    const hasListings = await waitForSelector(page, '[data-testid="card-container"]', 15000)
    console.log('📋 Listings found:', hasListings)
    
    if (!hasListings) {
      console.warn('⚠️ No listings found on Airbnb page')
      console.log('🔍 Checking page content for debugging...')
      const pageTitle = await page.title()
      const pageUrl = page.url()
      console.log('  - Page title:', pageTitle)
      console.log('  - Current URL:', pageUrl)
      
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

          // Extract images - try to get multiple if available
          const imgElements = card.querySelectorAll('img[data-testid="card-image"], img')
          const images: string[] = []
          imgElements.forEach((img: HTMLImageElement) => {
            if (img.src && !img.src.includes('data:image') && !img.src.includes('blank')) {
              images.push(img.src)
            }
          })
          // Ensure we have at least one image, even if placeholder
          if (images.length === 0) {
            const fallbackImg = card.querySelector('img') as HTMLImageElement
            if (fallbackImg?.src) {
              images.push(fallbackImg.src)
            }
          }

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

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })

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

          // Extract images - try to get multiple if available
          const imgElements = card.querySelectorAll('img[data-testid="image"], img')
          const images: string[] = []
          imgElements.forEach((img: HTMLImageElement) => {
            if (img.src && !img.src.includes('data:image') && !img.src.includes('blank') && !img.src.includes('placeholder')) {
              images.push(img.src)
            }
          })
          // Ensure we have at least one image
          if (images.length === 0) {
            const fallbackImg = card.querySelector('img') as HTMLImageElement
            if (fallbackImg?.src) {
              images.push(fallbackImg.src)
            }
          }

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

    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })

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

          // Extract images - VRBO often has multiple images
          const imgElements = card.querySelectorAll('img')
          const images: string[] = []
          imgElements.forEach((img: HTMLImageElement) => {
            if (img.src && !img.src.includes('data:image') && !img.src.includes('blank') && !img.src.includes('placeholder')) {
              images.push(img.src)
            }
          })
          // Ensure we have at least one image
          if (images.length === 0) {
            const fallbackImg = card.querySelector('img') as HTMLImageElement
            if (fallbackImg?.src) {
              images.push(fallbackImg.src)
            }
          }

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