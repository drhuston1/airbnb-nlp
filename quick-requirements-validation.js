#!/usr/bin/env node

// Quick Requirements Validation for ChatBnb
// Tests critical functionality against requirements without heavy browser automation

const TEST_CASES = [
  // REQ-1.1: Location Extraction
  {
    id: 'LOC-001',
    category: 'Location Extraction',
    test: 'Basic location extraction',
    api: '/api/analyze-query',
    payload: { query: 'house in Charleston SC' },
    expect: result => result.analysis?.location === 'Charleston SC',
    critical: true
  },
  {
    id: 'LOC-002',
    category: 'Location Extraction', 
    test: 'Missing location handling',
    api: '/api/analyze-query',
    payload: { query: 'luxury house with pool' },
    expect: result => result.analysis?.location === 'Unknown',
    critical: true
  },

  // REQ-1.2: Property Type Recognition
  {
    id: 'PROP-001',
    category: 'Property Type Recognition',
    test: 'Basic property type extraction',
    api: '/api/analyze-query',
    payload: { query: 'villa in Malibu' },
    expect: result => result.analysis?.extractedCriteria?.propertyType === 'villa',
    critical: true
  },

  // REQ-1.3: Criteria Extraction
  {
    id: 'CRIT-001',
    category: 'Criteria Extraction',
    test: 'Amenity extraction',
    api: '/api/analyze-query',
    payload: { query: 'house with pool in Austin' },
    expect: result => result.analysis?.extractedCriteria?.amenities?.includes('pool'),
    critical: true
  },
  {
    id: 'CRIT-002',
    category: 'Criteria Extraction',
    test: 'Superhost extraction',
    api: '/api/analyze-query',
    payload: { query: 'superhost property in San Francisco' },
    expect: result => result.analysis?.extractedCriteria?.rating?.superhost === true,
    critical: true
  },

  // REQ-2.1: Real Data Integration
  {
    id: 'DATA-001',
    category: 'Real Data Integration',
    test: 'MCP server integration',
    api: '/api/unified-search',
    payload: { query: 'house in Charleston SC', location: 'Charleston SC' },
    expect: result => result.listings && result.listings.length > 10 && result.sources?.[0]?.platform === 'airbnb',
    critical: true
  },
  {
    id: 'DATA-002',
    category: 'Real Data Integration',
    test: 'Valid property data structure',
    api: '/api/unified-search',
    payload: { query: 'apartment in Tokyo', location: 'Tokyo' },
    expect: result => {
      const listing = result.listings?.[0];
      return listing && listing.name && listing.price && listing.rating && listing.url;
    },
    critical: true
  },

  // REQ-2.2: GPT Filtering
  {
    id: 'FILTER-001',
    category: 'GPT Filtering',
    test: 'GPT semantic filtering',
    api: '/api/gpt-filter',
    payload: {
      query: 'luxury beachfront villa',
      listings: [
        {
          id: 'test1',
          name: 'Luxury Oceanfront Estate',
          roomType: 'Entire villa',
          amenities: ['Ocean view', 'Pool'],
          rating: 4.9,
          reviewsCount: 200,
          price: 500,
          isSuperhost: true
        },
        {
          id: 'test2', 
          name: 'Budget Downtown Hostel',
          roomType: 'Shared room',
          amenities: ['WiFi'],
          rating: 3.5,
          reviewsCount: 50,
          price: 25,
          isSuperhost: false
        }
      ]
    },
    expect: result => result.filteredIds?.includes('test1') && !result.filteredIds?.includes('test2'),
    critical: true
  },

  // REQ-1.4: Complex Query Handling
  {
    id: 'COMPLEX-001',
    category: 'Complex Query Analysis',
    test: 'Multi-criteria extraction',
    api: '/api/analyze-query',
    payload: { query: 'Luxury beachfront villa in Malibu for 6 people with pool, superhost only' },
    expect: result => {
      const criteria = result.analysis?.extractedCriteria;
      return criteria?.propertyType === 'villa' &&
             criteria?.amenities?.includes('pool') &&
             criteria?.rating?.superhost === true &&
             result.analysis?.location === 'Malibu';
    },
    critical: true
  }
];

async function runQuickValidation() {
  console.log('🔍 ChatBnb Quick Requirements Validation');
  console.log('=' .repeat(60));
  console.log(`Testing ${TEST_CASES.length} critical requirements\n`);

  const results = [];
  const baseUrl = 'https://chatbnb-search.vercel.app';

  for (let i = 0; i < TEST_CASES.length; i++) {
    const test = TEST_CASES[i];
    console.log(`[${i + 1}/${TEST_CASES.length}] ${test.category}: ${test.test}`);
    
    try {
      const response = await fetch(`${baseUrl}${test.api}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const passed = test.expect(data);
      
      results.push({
        id: test.id,
        category: test.category,
        test: test.test,
        passed,
        critical: test.critical,
        response: data,
        details: passed ? 'PASS' : 'FAIL'
      });

      console.log(`   ${passed ? '✅' : '❌'} ${passed ? 'PASS' : 'FAIL'}`);
      
    } catch (error) {
      results.push({
        id: test.id,
        category: test.category,
        test: test.test,
        passed: false,
        critical: test.critical,
        error: error.message,
        details: `ERROR: ${error.message}`
      });
      
      console.log(`   ❌ ERROR: ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Generate Summary Report
  console.log('\n' + '='.repeat(60));
  console.log('                    VALIDATION REPORT');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const criticalFailed = results.filter(r => !r.passed && r.critical).length;

  console.log(`\n📊 SUMMARY:`);
  console.log(`✅ Passed: ${passed}/${results.length} (${(passed/results.length*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed}/${results.length} (${(failed/results.length*100).toFixed(1)}%)`);
  console.log(`🚨 Critical Failures: ${criticalFailed}`);

  // Group by category
  const byCategory = results.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = [];
    acc[result.category].push(result);
    return acc;
  }, {});

  console.log(`\n📋 BY CATEGORY:`);
  Object.entries(byCategory).forEach(([category, tests]) => {
    const categoryPassed = tests.filter(t => t.passed).length;
    const status = categoryPassed === tests.length ? '✅' : '⚠️';
    console.log(`${status} ${category}: ${categoryPassed}/${tests.length}`);
  });

  // Failed tests detail
  const failedTests = results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    console.log(`\n❌ FAILURES:`);
    failedTests.forEach(test => {
      console.log(`🚨 ${test.id}: ${test.test}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      } else if (test.response) {
        console.log(`   Response: ${JSON.stringify(test.response, null, 2).substring(0, 200)}...`);
      }
    });
  }

  // Critical Path Assessment
  console.log(`\n🎯 CRITICAL PATH:`);
  if (criticalFailed === 0) {
    console.log('✅ All critical functionality validated');
  } else {
    console.log(`🚨 ${criticalFailed} critical failures - immediate attention required`);
  }

  console.log('\n' + '='.repeat(60));
  return results;
}

if (require.main === module) {
  runQuickValidation().catch(console.error);
}

module.exports = { runQuickValidation };