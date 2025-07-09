// Quick test to verify Puppeteer can launch locally
const puppeteer = require('puppeteer-core');

async function testPuppeteer() {
  console.log('🎭 Testing Puppeteer browser launch...\n');
  
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('✅ Page created successfully');
    
    await page.goto('https://www.google.com', { timeout: 10000 });
    console.log('✅ Navigation successful');
    
    const title = await page.title();
    console.log(`✅ Page title: ${title}`);
    
    await browser.close();
    console.log('✅ Browser closed successfully');
    
    console.log('\n🎉 Puppeteer test completed successfully!');
    console.log('🚀 The scraper should now work in Vercel serverless functions');
    
  } catch (error) {
    console.error('❌ Puppeteer test failed:', error.message);
    console.error('\nThis suggests there may still be browser issues');
  }
}

testPuppeteer();