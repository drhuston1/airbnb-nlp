// Utility functions for web scraping
import puppeteer, { Browser, Page } from 'puppeteer-core'

export interface ScraperConfig {
  timeout: number
  retries: number
  headless: boolean
  userAgent: string
}

export const DEFAULT_CONFIG: ScraperConfig = {
  timeout: 30000,
  retries: 2,
  headless: true,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

export class ScraperManager {
  private browser: Browser | null = null
  private config: ScraperConfig

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async initialize(): Promise<void> {
    if (this.browser) {
      return
    }

    // Configure Chromium for serverless environments (like Vercel)
    const isDev = process.env.NODE_ENV === 'development'
    
    if (isDev) {
      // Local development - use local Chrome
      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      })
    } else {
      // Production/Vercel - use @sparticuz/chromium with dynamic import
      const chromium = await import('@sparticuz/chromium')
      
      this.browser = await puppeteer.launch({
        args: [
          ...chromium.default.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--hide-scrollbars',
        ],
        defaultViewport: chromium.default.defaultViewport,
        executablePath: await chromium.default.executablePath(),
        headless: chromium.default.headless,
        ignoreHTTPSErrors: true,
      })
    }
  }

  async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.initialize()
    }

    const page = await this.browser!.newPage()
    
    // Set user agent and viewport
    await page.setUserAgent(this.config.userAgent)
    await page.setViewport({ width: 1920, height: 1080 })
    
    // Block unnecessary resources for faster loading (but allow images)
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const resourceType = req.resourceType()
      if (['stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort()
      } else {
        req.continue()
      }
    })

    return page
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        console.warn(`Attempt ${attempt} failed:`, error)
        
        if (attempt < this.config.retries) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries')
  }
}

export async function waitForSelector(page: Page, selector: string, timeout = 15000): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout })
    return true
  } catch (error) {
    console.warn(`Selector ${selector} not found within ${timeout}ms`)
    return false
  }
}

export function extractNumber(text: string, defaultValue = 0): number {
  const match = text.match(/(\d+(?:,\d+)*(?:\.\d+)?)/)
  return match ? parseFloat(match[1].replace(/,/g, '')) : defaultValue
}

export function extractRating(text: string, maxRating = 5): number {
  const match = text.match(/([\d.]+)/)
  if (!match) return 4.0
  
  const rating = parseFloat(match[1])
  
  // Convert different rating scales to 5-point scale
  if (rating > 5 && rating <= 10) {
    return rating / 2 // Convert 10-point to 5-point
  }
  
  return Math.min(rating, maxRating)
}

export function generateRandomDelay(min = 1000, max = 3000): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function randomDelay(min = 1000, max = 3000): Promise<void> {
  const delay = generateRandomDelay(min, max)
  await new Promise(resolve => setTimeout(resolve, delay))
}

export function sanitizeText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[^\w\s\-.,!?()]/g, '')
}

export function extractAmenitiesFromText(text: string): string[] {
  const amenities: string[] = []
  const lowerText = text.toLowerCase()
  
  const amenityPatterns = [
    { pattern: /pool/i, amenity: 'Pool' },
    { pattern: /hot\s*tub|jacuzzi/i, amenity: 'Hot Tub' },
    { pattern: /kitchen/i, amenity: 'Kitchen' },
    { pattern: /parking/i, amenity: 'Parking' },
    { pattern: /wifi|internet/i, amenity: 'WiFi' },
    { pattern: /gym|fitness/i, amenity: 'Gym' },
    { pattern: /laundry/i, amenity: 'Laundry' },
    { pattern: /air\s*conditioning|a\/c/i, amenity: 'Air Conditioning' },
    { pattern: /balcony/i, amenity: 'Balcony' },
    { pattern: /terrace/i, amenity: 'Terrace' },
    { pattern: /garden/i, amenity: 'Garden' },
    { pattern: /fireplace/i, amenity: 'Fireplace' },
    { pattern: /pet\s*friendly/i, amenity: 'Pet Friendly' },
    { pattern: /beach/i, amenity: 'Beach Access' },
    { pattern: /ocean|sea\s*view/i, amenity: 'Ocean View' },
    { pattern: /mountain\s*view/i, amenity: 'Mountain View' },
    { pattern: /waterfront/i, amenity: 'Waterfront' },
    { pattern: /spa/i, amenity: 'Spa' },
    { pattern: /sauna/i, amenity: 'Sauna' },
    { pattern: /bbq|grill/i, amenity: 'BBQ/Grill' }
  ]
  
  for (const { pattern, amenity } of amenityPatterns) {
    if (pattern.test(text)) {
      amenities.push(amenity)
    }
  }
  
  return [...new Set(amenities)]
}

export class RateLimiter {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private delay: number

  constructor(delayMs = 2000) {
    this.delay = delayMs
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true

    while (this.queue.length > 0) {
      const operation = this.queue.shift()!
      await operation()
      
      if (this.queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, this.delay))
      }
    }

    this.processing = false
  }
}