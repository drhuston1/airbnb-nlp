#!/usr/bin/env node

// Test the improved Disney World geocoding specifically
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function testDisneyWorldQueries() {
  console.log('🏰 Testing Disney World Geocoding Improvements');
  console.log('==============================================\n');
  
  const queries = [
    'Disney World',
    'Walt Disney World',
    'vacation home near Disney World',
    'house close to Disney World',
    'rental near Walt Disney World',
    'stay near Disney World Orlando'
  ];

  // Test with our API endpoint
  for (const query of queries) {
    console.log(`🎯 Testing: "${query}"`);
    
    try {
      const response = await fetch('http://localhost:5175/api/test-geocoding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: query,
          options: {
            includeAlternatives: true,
            maxResults: 3
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ Success:`);
        console.log(`     Location: "${data.location}"`);
        console.log(`     Display Name: "${data.displayName}"`);
        console.log(`     Confidence: ${data.confidence}`);
        console.log(`     Type: ${data.type}`);
        console.log(`     Providers: ${data.providers?.join(', ')}`);
        console.log(`     Coordinates: [${data.coordinates?.lat}, ${data.coordinates?.lng}]`);
        
        if (data.components) {
          console.log(`     State: ${data.components.state || 'N/A'}`);
          console.log(`     Country: ${data.components.country || 'N/A'}`);
        }
        
        if (data.alternatives && data.alternatives.length > 0) {
          console.log(`     Alternatives: ${data.alternatives.length}`);
          data.alternatives.slice(0, 2).forEach((alt, i) => {
            console.log(`       ${i + 1}. ${alt.displayName} (${alt.confidence})`);
          });
        }
        
        // Check if we got the right Disney World
        const isCorrect = data.displayName?.includes('Florida') && 
                         (data.displayName?.includes('Disney') || data.displayName?.includes('Walt Disney World'));
        
        if (isCorrect) {
          console.log(`     🎉 SUCCESS: Found correct Disney World in Florida!`);
        } else {
          console.log(`     ❌ WRONG: This doesn't appear to be Disney World, Florida`);
        }
        
      } else {
        console.log(`  ❌ API Error: ${response.status}`);
        const errorText = await response.text();
        console.log(`     Details: ${errorText}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Request failed: ${error.message}`);
    }
    
    console.log(''); // Separator
  }
}

async function testOtherLandmarks() {
  console.log('🗺️ Testing Other Major Landmarks');
  console.log('=================================\n');
  
  const landmarks = [
    'Universal Studios Orlando',
    'Times Square',
    'Central Park',
    'Golden Gate Bridge',
    'Yellowstone National Park'
  ];

  for (const landmark of landmarks) {
    console.log(`🎯 Testing: "${landmark}"`);
    
    try {
      const response = await fetch('http://localhost:5175/api/test-geocoding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: landmark,
          options: {
            includeAlternatives: true,
            maxResults: 2
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ Found: "${data.displayName}" (${data.confidence})`);
        console.log(`     Providers: ${data.providers?.join(', ')}`);
        console.log(`     Type: ${data.type}`);
      } else {
        console.log(`  ❌ Failed: ${response.status}`);
      }
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🧪 Testing Improved Landmark Geocoding');
  console.log('======================================\n');
  
  // Check if server is running
  try {
    const pingResponse = await fetch('http://localhost:5175/');
    if (!pingResponse.ok) throw new Error('Server not accessible');
    console.log('✅ Development server is running\n');
  } catch (error) {
    console.log('❌ Development server not accessible. Please run: npm run dev\n');
    return;
  }
  
  await testDisneyWorldQueries();
  await testOtherLandmarks();
  
  console.log('\n📋 Summary');
  console.log('==========');
  console.log('If Disney World queries now return Florida locations, the fix is working!');
  console.log('The system should now handle landmark-based queries much better.');
}

main().catch(console.error);