#!/usr/bin/env node

// Debug Google Geocoding API issues
import { config } from 'dotenv';
import fetch from 'node-fetch';

config({ path: '.env.local' });

async function debugGoogleGeocoding() {
  console.log('🌐 Debugging Google Geocoding API');
  console.log('==================================\n');
  
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  console.log(`API Key status: ${apiKey ? 'Present' : '❌ Missing'}`);
  
  if (!apiKey) {
    console.log('❌ GOOGLE_GEOCODING_API_KEY not found in environment variables');
    console.log('Available env vars:', Object.keys(process.env).filter(key => 
      key.toLowerCase().includes('google') || key.toLowerCase().includes('geocoding')
    ));
    return;
  }
  
  console.log(`API Key format: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`);
  console.log(`API Key length: ${apiKey.length} characters\n`);
  
  const testQueries = [
    'Cape Cod',
    'Disney World', 
    'Paris',
    'New York',
    'San Francisco'
  ];

  for (const query of testQueries) {
    console.log(`🎯 Testing: "${query}"`);
    await testGoogleQuery(query, apiKey);
    console.log('');
  }
}

async function testGoogleQuery(query, apiKey) {
  try {
    const params = new URLSearchParams({
      address: query,
      key: apiKey
    });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?${params}`;
    console.log(`🔗 Request URL: ${url.replace(apiKey, 'REDACTED')}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ChatBnb-Test/1.0'
      }
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status}`);
      const errorText = await response.text();
      console.log(`Error details: ${errorText}`);
      return;
    }

    const data = await response.json();
    console.log(`📊 Response structure:`, Object.keys(data));
    
    if (data.status) {
      console.log(`🔍 Google API Status: ${data.status}`);
      
      if (data.status !== 'OK') {
        console.log(`❌ API Error Status: ${data.status}`);
        
        if (data.error_message) {
          console.log(`Error message: ${data.error_message}`);
        }
        
        // Explain common Google API error codes
        switch (data.status) {
          case 'REQUEST_DENIED':
            console.log('💡 This usually means:');
            console.log('   - API key is invalid');
            console.log('   - Geocoding API is not enabled for this key');
            console.log('   - Billing is not set up');
            console.log('   - API key restrictions are blocking the request');
            break;
          case 'OVER_QUERY_LIMIT':
            console.log('💡 Query limit exceeded - need to upgrade plan or wait');
            break;
          case 'ZERO_RESULTS':
            console.log('💡 No results found for this query');
            break;
          case 'INVALID_REQUEST':
            console.log('💡 Invalid request - check parameters');
            break;
          case 'UNKNOWN_ERROR':
            console.log('💡 Server error - try again later');
            break;
        }
        return;
      }
    }
    
    if (data.results && data.results.length > 0) {
      console.log(`✅ Found ${data.results.length} results:`);
      data.results.slice(0, 3).forEach((result, i) => {
        console.log(`  ${i + 1}. ${result.formatted_address}`);
        console.log(`     Types: ${result.types?.join(', ') || 'None'}`);
        console.log(`     Location: [${result.geometry.location.lat}, ${result.geometry.location.lng}]`);
      });
    } else {
      console.log(`⚠️ API responded OK but no results found`);
    }
    
  } catch (error) {
    console.log(`❌ Network/Request Error: ${error.message}`);
  }
}

async function testGoogleAPIKeyValidation() {
  console.log('\n🔑 Testing Google API Key Validation');
  console.log('====================================\n');
  
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    console.log('❌ No API key to test');
    return;
  }
  
  try {
    // Test with a simple, known location
    const params = new URLSearchParams({
      address: 'Times Square, New York',
      key: apiKey
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();
    
    console.log(`Status: ${data.status}`);
    
    if (data.status === 'REQUEST_DENIED') {
      console.log('\n🔧 API Key Issues Detected:');
      console.log('1. Check that the Geocoding API is enabled in Google Cloud Console');
      console.log('2. Verify billing is set up for your project');
      console.log('3. Check API key restrictions (HTTP referrers, IP addresses)');
      console.log('4. Make sure the API key has Geocoding API permissions');
      console.log('\n📋 To fix:');
      console.log('• Go to: https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com');
      console.log('• Enable the Geocoding API');
      console.log('• Set up billing: https://console.cloud.google.com/billing');
      console.log('• Check API key: https://console.cloud.google.com/apis/credentials');
    } else if (data.status === 'OK') {
      console.log('✅ API key is working correctly!');
      console.log(`Found: ${data.results[0]?.formatted_address}`);
    } else {
      console.log(`⚠️ Unexpected status: ${data.status}`);
      if (data.error_message) {
        console.log(`Error: ${data.error_message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Validation failed: ${error.message}`);
  }
}

async function main() {
  await debugGoogleGeocoding();
  await testGoogleAPIKeyValidation();
  
  console.log('\n📋 Summary');
  console.log('==========');
  console.log('This test shows exactly what error Google Geocoding is returning.');
  console.log('Common issues are usually API key configuration or billing setup.');
}

main().catch(console.error);