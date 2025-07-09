// Local testing script for the scraper (bypasses Vercel serverless limitations)
const { exec } = require('child_process');

async function testLocalScraper() {
  console.log('🧪 Testing scraper locally...\n');
  
  try {
    // Test a simple search
    const testData = {
      platform: 'airbnb',
      location: 'Miami, FL',
      adults: 2,
      children: 0
    };
    
    console.log('Test payload:', JSON.stringify(testData, null, 2));
    console.log('\n⏳ Running local scraper test...\n');
    
    // For local testing, you would need to:
    console.log('To test locally:');
    console.log('1. Install Chrome locally: npx puppeteer browsers install chrome');
    console.log('2. Create a test script that imports the scraper functions directly');
    console.log('3. Or deploy to Vercel and test remotely');
    
    console.log('\n🚀 For Vercel testing:');
    console.log('vercel --prod');
    console.log('\nThen test with:');
    console.log(`curl -X POST https://your-app.vercel.app/api/scraper \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(testData)}'`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLocalScraper();