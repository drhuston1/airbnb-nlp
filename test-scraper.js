// Test script for the web scraper
const fetch = require('node-fetch')

async function testScraper() {
  try {
    console.log('Testing web scraper...')
    
    const testPayloads = [
      {
        platform: 'airbnb',
        location: 'Malibu, CA',
        adults: 2,
        children: 0,
        page: 1
      },
      {
        platform: 'booking',
        location: 'Miami, FL',
        adults: 2,
        children: 0,
        page: 1
      },
      {
        platform: 'vrbo',
        location: 'Austin, TX',
        adults: 4,
        children: 0,
        page: 1
      }
    ]
    
    // Note: This would need to be run on a deployed Vercel function
    // For local testing, you'd need to run the scraper function directly
    console.log('To test the scraper, deploy to Vercel and call:')
    console.log('POST /api/scraper')
    
    testPayloads.forEach((payload, index) => {
      console.log(`\n${index + 1}. Test ${payload.platform.toUpperCase()}:`)
      console.log('Body:', JSON.stringify(payload, null, 2))
    })
    
    console.log('\nOr test unified search with all platforms:')
    console.log('POST /api/unified-search')
    console.log('Body:', JSON.stringify({
      query: 'Luxury beachfront villa',
      location: 'Malibu, CA',
      adults: 2,
      platforms: ['airbnb', 'booking', 'vrbo']
    }, null, 2))
    
    console.log('\nExample VRBO-specific search:')
    console.log('Body:', JSON.stringify({
      query: 'Family vacation home with pool',
      location: 'Orlando, FL',
      adults: 4,
      children: 2,
      platforms: ['vrbo']
    }, null, 2))
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testScraper()