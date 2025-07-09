// Utility functions for web scraping using Playwright with serverless Chromium
import { chromium, Browser, Page } from 'playwright-chromium'

// Type definition for @sparticuz/chromium
interface ChromiumPackage {
  executablePath(): Promise<string>
  headless: boolean
  args: string[]
}

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
      console.log('🔄 Browser already initialized, reusing existing instance')
      return
    }

    console.log('🎭 Using Playwright with serverless Chromium')
    console.log('🔍 Environment variables:')
    console.log('  - VERCEL:', process.env.VERCEL || 'undefined')
    console.log('  - AWS_LAMBDA_FUNCTION_NAME:', process.env.AWS_LAMBDA_FUNCTION_NAME || 'undefined')
    console.log('  - NODE_ENV:', process.env.NODE_ENV || 'undefined')
    console.log('  - Platform:', process.platform)
    console.log('  - Architecture:', process.arch)
    
    // Detect if we're in a serverless environment
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    console.log('🎯 Environment detection result:', isServerless ? 'SERVERLESS' : 'LOCAL')
    
    if (isServerless) {
      console.log('🌐 Serverless environment detected, attempting @sparticuz/chromium')
      try {
        console.log('📦 Loading @sparticuz/chromium module...')
        
        // Use eval to prevent bundlers from transforming dynamic import
        const dynamicImport = new Function('specifier', 'return import(specifier)')
        console.log('✅ Dynamic import function created')
        
        const chromiumModule = await dynamicImport('@sparticuz/chromium') as { default: ChromiumPackage }
        console.log('✅ @sparticuz/chromium module loaded successfully')
        
        const chromiumPkg = chromiumModule.default
        console.log('✅ Chromium package extracted from module')
        
        // Get executable path and log details
        const executablePath = await chromiumPkg.executablePath()
        console.log('🚀 Chromium details:')
        console.log('  - Executable path:', executablePath)
        console.log('  - Headless mode:', chromiumPkg.headless)
        console.log('  - Default args count:', chromiumPkg.args.length)
        console.log('  - Default args:', chromiumPkg.args.slice(0, 5).join(', '), '...')
        
        const launchArgs = [
          ...chromiumPkg.args,
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--hide-scrollbars'
        ]
        console.log('🔧 Final launch args count:', launchArgs.length)
        
        console.log('🚀 Launching Chromium with serverless configuration...')
        this.browser = await chromium.launch({
          executablePath,
          headless: chromiumPkg.headless,
          args: launchArgs
        })
        console.log('✅ Chromium launched successfully in serverless mode!')
        
      } catch (error) {
        console.error('❌ Failed to load @sparticuz/chromium:')
        console.error('  - Error type:', error.constructor.name)
        console.error('  - Error message:', error.message)
        console.error('  - Error code:', (error as any).code)
        console.error('  - Full error:', error)
        
        console.log('🔄 Attempting fallback to system Chrome...')
        try {
          this.browser = await chromium.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--window-size=1920,1080',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor',
              '--hide-scrollbars'
            ]
          })
          console.log('✅ System Chrome fallback successful')
        } catch (fallbackError) {
          console.error('❌ System Chrome fallback also failed:')
          console.error('  - Fallback error:', fallbackError.message)
          throw new Error(`Both serverless and system Chrome failed. Serverless: ${error.message}, System: ${fallbackError.message}`)
        }
      }
    } else {
      console.log('💻 Local environment detected, using system Chromium')
      try {
        console.log('🚀 Launching system Chromium...')
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--hide-scrollbars'
          ]
        })
        console.log('✅ System Chromium launched successfully!')
      } catch (error) {
        console.error('❌ System Chromium launch failed:')
        console.error('  - Error:', error.message)
        throw error
      }
    }
    
    console.log('🎉 Browser initialization completed successfully!')
    console.log('📊 Browser info:')
    console.log('  - Version:', await this.browser.version())
    console.log('  - Connected:', this.browser.isConnected())
  }
  }

  async createPage(): Promise<Page> {
    console.log('📄 Creating new page...')
    if (!this.browser) {
      console.log('🔄 Browser not initialized, initializing now...')
      await this.initialize()
    }

    try {
      const page = await this.browser!.newPage()
      console.log('✅ Page created successfully')
      
      // Set user agent and viewport (Playwright API)
      console.log('🔧 Setting page configuration...')
      await page.setExtraHTTPHeaders({
        'User-Agent': this.config.userAgent
      })
      console.log('  - User agent set')
      
      await page.setViewportSize({ width: 1920, height: 1080 })
      console.log('  - Viewport size set')
      
      // Block unnecessary resources for faster loading (but allow images)
      await page.route('**/*', (route) => {
        const resourceType = route.request().resourceType()
        if (['stylesheet', 'font', 'media'].includes(resourceType)) {
          route.abort()
        } else {
          route.continue()
        }
      })
      console.log('  - Resource blocking configured')
      
      console.log('🎉 Page setup completed successfully!')
      return page
      
    } catch (error) {
      console.error('❌ Failed to create page:')
      console.error('  - Error:', error.message)
      throw error
    }
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