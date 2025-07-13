#!/usr/bin/env node

// Compare Google vs other providers to see why multi-provider might be better
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function compareProviders() {
  console.log('🔍 Google vs Others: Why Multi-Provider?');
  console.log('==========================================\n');
  
  const testCases = [
    { query: 'Paris', expectation: 'Should show France first, but also Texas option' },
    { query: 'Portland', expectation: 'Should show Oregon first, but also Maine option' },
    { query: 'London', expectation: 'Should show UK first, but also Ontario option' },
    { query: 'Cambridge', expectation: 'Should show options for UK vs Massachusetts' },
    { query: 'Cape Cod', expectation: 'Should find Massachusetts peninsula' },
    { query: 'Disney World', expectation: 'Should find Florida location' }
  ];

  for (const testCase of testCases) {
    console.log(`\n🎯 Testing: "${testCase.query}"`);
    console.log(`Expected: ${testCase.expectation}\n`);
    
    // Test Google
    await testGoogle(testCase.query);
    
    // Test Nominatim
    await testNominatim(testCase.query);
    
    // Test Mapbox
    await testMapbox(testCase.query);
    
    console.log('─'.repeat(80));
  }
}

async function testGoogle(query) {
  console.log('🌐 Google Results:');
  try {
    const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
    const params = new URLSearchParams({
      address: query,
      key: apiKey
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results?.length > 0) {
      console.log(`   Found ${data.results.length} results:`);
      data.results.slice(0, 3).forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.formatted_address}`);
      });
      
      // Check disambiguation
      if (data.results.length === 1) {
        console.log('   ⚠️ Only ONE result - no alternatives for user choice');
      } else {
        console.log(`   ✅ ${data.results.length} alternatives available`);
      }
    } else {
      console.log(`   ❌ ${data.status}: ${data.error_message || 'No results'}`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function testNominatim(query) {
  console.log('🗺️ Nominatim Results:');
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '5'
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'ChatBnb-Test/1.0',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      console.log(`   Found ${data.length} results:`);
      
      // Group by country to show diversity
      const byCountry = {};
      data.slice(0, 5).forEach(result => {
        const country = result.address?.country || 'Unknown';
        if (!byCountry[country]) byCountry[country] = [];
        byCountry[country].push(result);
      });
      
      Object.entries(byCountry).forEach(([country, results]) => {
        console.log(`   📍 ${country}:`);
        results.slice(0, 2).forEach(result => {
          console.log(`      - ${result.display_name}`);
        });
      });
      
      const countries = Object.keys(byCountry);
      if (countries.length > 1) {
        console.log(`   ✅ ${countries.length} countries - good disambiguation`);
      } else {
        console.log(`   ⚠️ Only ${countries.length} country found`);
      }
    } else {
      console.log(`   ❌ No results`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function testMapbox(query) {
  console.log('🗺️ Mapbox Results:');
  try {
    const apiKey = process.env.MAPBOX_ACCESS_TOKEN;
    const params = new URLSearchParams({
      access_token: apiKey,
      types: 'place,locality,region,district',
      limit: '5'
    });

    const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      console.log(`   Found ${data.features.length} results:`);
      
      // Group by country
      const byCountry = {};
      data.features.forEach(feature => {
        const country = feature.context?.find(c => c.id.startsWith('country'))?.text || 'Unknown';
        if (!byCountry[country]) byCountry[country] = [];
        byCountry[country].push(feature);
      });
      
      Object.entries(byCountry).forEach(([country, features]) => {
        console.log(`   📍 ${country}:`);
        features.slice(0, 2).forEach(feature => {
          console.log(`      - ${feature.place_name}`);
        });
      });
      
      const countries = Object.keys(byCountry);
      if (countries.length > 1) {
        console.log(`   ✅ ${countries.length} countries - good disambiguation`);
      } else {
        console.log(`   ⚠️ Only ${countries.length} country found`);
      }
    } else {
      console.log(`   ❌ No results`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function analyzeCostAndReliability() {
  console.log('\n💰 Cost & Reliability Analysis');
  console.log('==============================\n');
  
  console.log('🌐 Google Geocoding API:');
  console.log('   💰 Cost: $5 per 1,000 requests (after 200 free per day)');
  console.log('   📊 Rate Limit: 50 requests per second');
  console.log('   🔑 Dependency: Requires API key and billing setup');
  console.log('   🌍 Coverage: Excellent worldwide');
  console.log('   ⚡ Speed: Fast');
  console.log('   🔒 Risk: Single point of failure, billing issues can break app');
  console.log('');
  
  console.log('🗺️ Nominatim (OpenStreetMap):');
  console.log('   💰 Cost: FREE');
  console.log('   📊 Rate Limit: 1 request per second (can host your own for more)');
  console.log('   🔑 Dependency: None - public service');
  console.log('   🌍 Coverage: Excellent worldwide, especially for geographic features');
  console.log('   ⚡ Speed: Moderate');
  console.log('   🔒 Risk: Low - community-maintained, very stable');
  console.log('');
  
  console.log('🗺️ Mapbox Geocoding:');
  console.log('   💰 Cost: $0.50 per 1,000 requests (after 100,000 free per month)');
  console.log('   📊 Rate Limit: 600 requests per minute');
  console.log('   🔑 Dependency: Requires API key');
  console.log('   🌍 Coverage: Excellent for major cities and places');
  console.log('   ⚡ Speed: Very fast');
  console.log('   🔒 Risk: Medium - reliable service but requires API key');
}

async function demonstrateMultiProviderBenefits() {
  console.log('\n✨ Multi-Provider Benefits');
  console.log('=========================\n');
  
  console.log('🎯 Why Multi-Provider Strategy Wins:');
  console.log('');
  console.log('1. 🛡️ RELIABILITY:');
  console.log('   - If Google has billing issues → Nominatim/Mapbox continue working');
  console.log('   - If one API is down → Others provide backup');
  console.log('   - No single point of failure');
  console.log('');
  console.log('2. 💰 COST OPTIMIZATION:');
  console.log('   - Use FREE Nominatim for geographic features (Cape Cod, mountains)');
  console.log('   - Use cheaper Mapbox for major cities');
  console.log('   - Use Google only when needed for best accuracy');
  console.log('');
  console.log('3. 🎨 BETTER USER EXPERIENCE:');
  console.log('   - Combine results from all providers');
  console.log('   - More alternatives for ambiguous locations');
  console.log('   - Best provider for each query type');
  console.log('');
  console.log('4. 📊 BETTER DISAMBIGUATION:');
  console.log('   - Google might return 1 result for "Paris"');
  console.log('   - Multi-provider shows Paris, France AND Paris, Texas');
  console.log('   - Users can choose what they actually meant');
  console.log('');
  console.log('5. 🌍 COMPREHENSIVE COVERAGE:');
  console.log('   - Mapbox: Great for cities');
  console.log('   - Nominatim: Great for geographic features');
  console.log('   - Google: Great for businesses and POIs');
  console.log('   - Combined: Best of all worlds');
}

async function main() {
  await compareProviders();
  await analyzeCostAndReliability();
  await demonstrateMultiProviderBenefits();
  
  console.log('\n🏆 Recommendation');
  console.log('=================');
  console.log('Use Google as primary for most queries, but keep multi-provider for:');
  console.log('• Cost savings (free Nominatim for some queries)');
  console.log('• Reliability (backup when Google has issues)');
  console.log('• Better disambiguation (more alternatives)');
  console.log('• Specialized use cases (Cape Cod works better with Nominatim)');
}

main().catch(console.error);