// Test endpoint to compare HTTP API vs Browser scraping approaches
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const testParams = {
    location: 'Miami, FL',
    adults: 2,
    children: 0
  }

  console.log('🧪 Testing both approaches for comparison...')

  try {
    const startTime = Date.now()
    
    // Test HTTP API approach
    console.log('🔗 Testing HTTP API approach...')
    const apiStart = Date.now()
    
    const apiResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/airbnb-api`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testParams)
    })
    
    const apiData = await apiResponse.json()
    const apiDuration = Date.now() - apiStart
    
    console.log('📊 HTTP API Results:')
    console.log(`  - Duration: ${apiDuration}ms`)
    console.log(`  - Results: ${apiData.results?.length || 0} listings`)
    console.log(`  - Success: ${apiData.success}`)
    
    // Test browser scraping approach (if available)
    console.log('🎭 Testing browser scraping approach...')
    const scraperStart = Date.now()
    let scraperData = null
    let scraperDuration = 0
    
    try {
      const scraperResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http' : 'https'}://${req.headers.host}/api/scraper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...testParams, platform: 'airbnb' })
      })
      
      scraperData = await scraperResponse.json()
      scraperDuration = Date.now() - scraperStart
      
      console.log('📊 Browser Scraping Results:')
      console.log(`  - Duration: ${scraperDuration}ms`)
      console.log(`  - Results: ${scraperData.results?.length || 0} listings`)
      console.log(`  - Success: ${scraperData.success}`)
      
    } catch (scraperError) {
      console.log('❌ Browser scraping failed:', (scraperError as Error).message)
      scraperData = { 
        success: false, 
        error: (scraperError as Error).message,
        results: []
      }
    }
    
    const totalDuration = Date.now() - startTime
    
    // Performance comparison
    const comparison = {
      httpApi: {
        duration: apiDuration,
        success: apiData.success,
        resultCount: apiData.results?.length || 0,
        errorMessage: apiData.error || null
      },
      browserScraping: {
        duration: scraperDuration,
        success: scraperData?.success || false,
        resultCount: scraperData?.results?.length || 0,
        errorMessage: scraperData?.error || null
      },
      winner: apiDuration < scraperDuration && apiData.success ? 'HTTP API' : 
              scraperData?.success ? 'Browser Scraping' : 'Neither',
      performanceGain: scraperDuration > 0 ? 
        `HTTP API is ${Math.round(((scraperDuration - apiDuration) / scraperDuration) * 100)}% faster` :
        'Cannot compare - scraper failed'
    }
    
    return res.status(200).json({
      success: true,
      testParams,
      comparison,
      totalTestDuration: totalDuration,
      timestamp: new Date().toISOString(),
      recommendation: comparison.winner === 'HTTP API' ? 
        'Switch to HTTP API approach - faster, more reliable, no browser dependencies' :
        'Further investigation needed'
    })
    
  } catch (error) {
    console.error('❌ Test comparison failed:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}