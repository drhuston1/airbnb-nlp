#!/usr/bin/env node

/**
 * Comprehensive workflow testing script
 * Tests each part of the search pipeline to identify issues
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const API_BASE = 'http://localhost:5175/api';
const TEST_QUERY = 'Cape Cod houses for families';

class WorkflowTester {
  constructor() {
    this.results = {
      classification: null,
      analysis: null,
      geocoding: null,
      validation: null,
      search: null
    };
    this.errors = [];
  }

  log(step, message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] ${step}: ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  error(step, message, error) {
    const timestamp = new Date().toISOString();
    console.error(`\n[${timestamp}] ❌ ${step} ERROR: ${message}`);
    console.error(error);
    this.errors.push({ step, message, error: error.message || error });
  }

  /**
   * Test 1: Query Classification
   */
  async testQueryClassification() {
    this.log('STEP 1', 'Testing Query Classification');
    
    try {
      const response = await fetch(`${API_BASE}/classify-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: TEST_QUERY,
          context: { hasSearchResults: false }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.results.classification = result;
      
      this.log('STEP 1', '✅ Query Classification Success', {
        intent: result.result?.intent,
        confidence: result.result?.confidence,
        extractedLocation: result.result?.extractedLocation,
        suggestedAction: result.result?.suggestedAction
      });

      return result;
    } catch (error) {
      this.error('STEP 1', 'Query Classification Failed', error);
      return null;
    }
  }

  /**
   * Test 2: Query Analysis (GPT Location Extraction)
   */
  async testQueryAnalysis() {
    this.log('STEP 2', 'Testing Query Analysis (GPT Location Extraction)');
    
    try {
      const response = await fetch(`${API_BASE}/analyze-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: TEST_QUERY,
          previousLocation: null,
          hasExistingResults: false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.results.analysis = result;
      
      this.log('STEP 2', '✅ Query Analysis Success', {
        extractedLocation: result.analysis?.location,
        isRefinement: result.analysis?.isRefinement,
        confidence: result.analysis?.confidence,
        locationValidation: result.analysis?.locationValidation ? 'Present' : 'None'
      });

      return result;
    } catch (error) {
      this.error('STEP 2', 'Query Analysis Failed', error);
      return null;
    }
  }

  /**
   * Test 3: Direct Geocoding Service
   */
  async testGeocodingService() {
    this.log('STEP 3', 'Testing Direct Geocoding Service');
    
    const testLocation = this.results.analysis?.analysis?.location || 'Cape Cod';
    
    try {
      // Test with a simple geocoding call
      const response = await fetch(`${API_BASE}/test-geocoding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: testLocation,
          options: {
            includeAlternatives: true,
            maxResults: 5
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.results.geocoding = result;
      
      this.log('STEP 3', '✅ Geocoding Service Success', {
        input: testLocation,
        primaryResult: result.location,
        displayName: result.displayName,
        confidence: result.confidence,
        coordinates: result.coordinates,
        country: result.components?.country,
        alternativeCount: result.alternatives?.length || 0
      });

      return result;
    } catch (error) {
      this.error('STEP 3', 'Geocoding Service Failed', error);
      return null;
    }
  }

  /**
   * Test 4: Location Validation (Full Pipeline)
   */
  async testLocationValidation() {
    this.log('STEP 4', 'Testing Location Validation Pipeline');
    
    if (!this.results.analysis?.analysis?.location) {
      this.error('STEP 4', 'No location from analysis to validate', 'Skipping');
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/validate-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: this.results.analysis.analysis.location,
          originalQuery: TEST_QUERY
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.results.validation = result;
      
      this.log('STEP 4', '✅ Location Validation Success', {
        input: this.results.analysis.analysis.location,
        valid: result.valid,
        confidence: result.confidence,
        validatedLocation: result.validated?.location,
        disambiguationRequired: result.disambiguation?.required,
        alternativeCount: result.alternatives?.length || 0
      });

      return result;
    } catch (error) {
      this.error('STEP 4', 'Location Validation Failed', error);
      return null;
    }
  }

  /**
   * Test 5: Unified Search
   */
  async testUnifiedSearch() {
    this.log('STEP 5', 'Testing Unified Search API');
    
    // Use validated location if available, otherwise use raw location
    const location = this.results.validation?.validated?.location || 
                    this.results.analysis?.analysis?.location || 
                    'Cape Cod';
    
    try {
      const response = await fetch(`${API_BASE}/unified-search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: TEST_QUERY,
          location: location,
          adults: 2,
          children: 0,
          page: 1
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.results.search = result;
      
      this.log('STEP 5', '✅ Unified Search Success', {
        searchLocation: location,
        resultCount: result.listings?.length || 0,
        sources: result.sources?.map(s => `${s.platform}: ${s.status}`) || [],
        firstListingLocation: result.listings?.[0]?.location || 'None',
        firstListingName: result.listings?.[0]?.name || 'None'
      });

      return result;
    } catch (error) {
      this.error('STEP 5', 'Unified Search Failed', error);
      return null;
    }
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('                      WORKFLOW TEST REPORT');
    console.log('='.repeat(80));
    
    console.log(`\nTest Query: "${TEST_QUERY}"`);
    console.log(`\nEnvironment Check:`);
    console.log(`  ✅ OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Present' : '❌ Missing'}`);
    console.log(`  ✅ MAPBOX_ACCESS_TOKEN: ${process.env.MAPBOX_ACCESS_TOKEN ? 'Present' : '❌ Missing'}`);
    console.log(`  ✅ GOOGLE_GEOCODING_API_KEY: ${process.env.GOOGLE_GEOCODING_API_KEY ? 'Present' : '❌ Missing'}`);

    console.log(`\nStep Results:`);
    console.log(`  1. Query Classification: ${this.results.classification ? '✅ Success' : '❌ Failed'}`);
    console.log(`  2. Query Analysis: ${this.results.analysis ? '✅ Success' : '❌ Failed'}`);
    console.log(`  3. Geocoding Service: ${this.results.geocoding ? '✅ Success' : '❌ Failed'}`);
    console.log(`  4. Location Validation: ${this.results.validation ? '✅ Success' : '❌ Failed'}`);
    console.log(`  5. Unified Search: ${this.results.search ? '✅ Success' : '❌ Failed'}`);

    if (this.errors.length > 0) {
      console.log(`\n❌ Errors Found (${this.errors.length}):`);
      this.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.step}: ${error.message}`);
      });
    }

    console.log(`\nLocation Flow Analysis:`);
    if (this.results.analysis?.analysis?.location) {
      console.log(`  Raw extraction: "${this.results.analysis.analysis.location}"`);
    }
    if (this.results.validation?.validated?.location) {
      console.log(`  After validation: "${this.results.validation.validated.location}"`);
    }
    if (this.results.search?.listings?.[0]?.location) {
      console.log(`  Final search results: "${this.results.search.listings[0].location.city}, ${this.results.search.listings[0].location.country}"`);
    }

    console.log('\n' + '='.repeat(80));
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Comprehensive Workflow Tests...\n');
    
    await this.testQueryClassification();
    await this.testQueryAnalysis();
    await this.testGeocodingService();
    await this.testLocationValidation();
    await this.testUnifiedSearch();
    
    this.generateReport();
  }
}

// Check if the development server is running  
async function checkServerStatus() {
  console.log('📝 Checking server status...\n');
  
  try {
    // Check the main app first
    const appResponse = await fetch('http://localhost:5175/');
    if (appResponse.ok) {
      console.log('✅ Development server is running on port 5175');
    } else {
      console.log('⚠️ Server responded but with error status');
    }
  } catch (error) {
    console.error('❌ Development server not accessible. Make sure to run: npm run dev');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the tests
async function main() {
  await checkServerStatus();
  
  const tester = new WorkflowTester();
  await tester.runAllTests();
}

main().catch(console.error);