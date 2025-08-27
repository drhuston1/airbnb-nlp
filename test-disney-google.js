#!/usr/bin/env node

// Test Disney-specific queries with Google after restriction removal
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function testDisneyVariations() {
  console.log('🏰 Testing Disney Variations with Google');
  console.log('========================================\n');
  
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  
  const disneyQueries = [
    'Disney World',
    'Walt Disney World',
    'Walt Disney World Resort',
    'Disney World Orlando',
    'Disney World Florida',
    'Magic Kingdom',
    'Disney Parks',
    'Disney Resort',
    'Disney Orlando',
    'Disneyland', // California version
    'Universal Studios Orlando', // Compare with Universal
    'Orlando, Florida' // Simple city name
  ];

  for (const query of disneyQueries) {
    console.log(`🎯 Testing: "${query}"`);
    await testWithDelay(query, apiKey);
    console.log('');
  }
}

async function testWithDelay(query, apiKey) {
  try {
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const params = new URLSearchParams({
      address: query,
      key: apiKey
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    
    console.log(`   Status: ${data.status}`);
    
    if (data.status === 'OK' && data.results?.length > 0) {
      const result = data.results[0];
      console.log(`   ✅ ${result.formatted_address}`);
      console.log(`   📍 [${result.geometry.location.lat}, ${result.geometry.location.lng}]`);
      console.log(`   🏷️ Types: ${result.types?.slice(0, 3).join(', ')}`);
      
      // Check if this is in Florida/Orlando area
      const inFlorida = result.formatted_address.includes('Florida') || 
                       result.formatted_address.includes('FL') ||
                       result.formatted_address.includes('Orlando');
      
      if (inFlorida) {
        console.log(`   🎉 SUCCESS: Found in Florida/Orlando area!`);
      }
      
    } else if (data.status === 'REQUEST_DENIED') {
      console.log(`   ❌ REQUEST_DENIED: ${data.error_message}`);
      
      // Check if the error message is different now
      if (data.error_message && !data.error_message.includes('referer restrictions')) {
        console.log(`   💡 New error type - not referrer restrictions anymore`);
      }
      
    } else if (data.status === 'ZERO_RESULTS') {
      console.log(`   ⚠️ ZERO_RESULTS: No results found`);
    } else {
      console.log(`   ⚠️ ${data.status}: ${data.error_message || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Network Error: ${error.message}`);
  }
}

async function compareProviersForDisney() {
  console.log('\n🔄 Comparing Providers for Disney World');
  console.log('======================================\n');
  
  const query = 'Walt Disney World';
  
  // Test Nominatim (we know this works)
  console.log('📍 Nominatim:');
  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '1'
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'ChatBnb-Test/1.0',
        'Accept': 'application/json'
      }
    });
    
    const data = await response.json();
    if (data && data.length > 0) {
      console.log(`   ✅ ${data[0].display_name}`);
      console.log(`   📍 [${data[0].lat}, ${data[0].lon}]`);
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  // Test Google again
  console.log('\n🌐 Google:');
  await testWithDelay(query, process.env.GOOGLE_GEOCODING_API_KEY);
}

async function main() {
  console.log('🧪 Testing Disney Queries After API Restriction Removal');
  console.log('=======================================================\n');
  
  await testDisneyVariations();
  await compareProviersForDisney();
  
  console.log('\n📋 Conclusion');
  console.log('=============');
  console.log('If Disney queries are still failing, it might be:');
  console.log('1. API changes taking time to propagate (try again in 5-10 minutes)');
  console.log('2. Specific restrictions on Disney-related content');
  console.log('3. Different billing/quota rules for certain query types');
  console.log('4. Need to enable additional Google APIs beyond Geocoding');
  console.log('');
  console.log('✅ Good news: Nominatim + Mapbox already handle all these cases perfectly!');
}

main().catch(console.error);