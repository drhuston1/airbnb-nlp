// Quick test of the unified search API
const testLocation = 'Los Angeles'

async function testUnifiedSearch() {
  console.log('Testing unified search...')
  
  try {
    const response = await fetch('http://localhost:3000/api/unified-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Find me a place in Los Angeles',
        location: testLocation,
        adults: 2,
        platforms: ['airbnb']
      })
    })
    
    const data = await response.json()
    console.log('Response status:', response.status)
    console.log('Response data:', JSON.stringify(data, null, 2))
    
    if (data.listings && data.listings.length > 0) {
      console.log('\n🏠 First listing:')
      console.log('Name:', data.listings[0].name)
      console.log('Price:', data.listings[0].price)
      console.log('Images count:', data.listings[0].images?.length || 0)
      console.log('Images:', data.listings[0].images)
    }
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

testUnifiedSearch()