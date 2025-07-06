#!/usr/bin/env node

// Comprehensive automated testing suite for ChatBnb search functionality
// Compares app results with MCP server results across various query types

const puppeteer = require('puppeteer');

const TEST_QUERIES = [
  // Basic location queries
  {
    query: "house in Charleston SC",
    type: "basic_location",
    expectMinResults: 5
  },
  {
    query: "apartment in Tokyo Japan", 
    type: "basic_location",
    expectMinResults: 5
  },
  
  // Property type queries
  {
    query: "villa in Malibu",
    type: "property_type", 
    expectMinResults: 2
  },
  {
    query: "cabin in Yellowstone",
    type: "property_type",
    expectMinResults: 1
  },
  {
    query: "loft in Chicago",
    type: "property_type",
    expectMinResults: 1
  },
  
  // Complex multi-criteria queries
  {
    query: "Luxury beachfront villa in Malibu for 6 people with pool, superhost only",
    type: "complex",
    expectMinResults: 1
  },
  {
    query: "Dog-friendly cabin near Yellowstone under $150 with 4.8+ rating",
    type: "complex", 
    expectMinResults: 1
  },
  {
    query: "Modern downtown loft in Chicago with parking, entire home under $200",
    type: "complex",
    expectMinResults: 1
  },
  
  // Amenity-focused queries
  {
    query: "house with pool in Austin",
    type: "amenity",
    expectMinResults: 2
  },
  {
    query: "beachfront property in Miami",
    type: "amenity", 
    expectMinResults: 1
  },
  
  // Rating/quality queries
  {
    query: "superhost property in San Francisco",
    type: "quality",
    expectMinResults: 2
  },
  {
    query: "highly rated apartment in New York",
    type: "quality",
    expectMinResults: 3
  },
  
  // Edge cases
  {
    query: "mansion in Beverly Hills",
    type: "edge_case",
    expectMinResults: 1
  },
  {
    query: "treehouse in Oregon",
    type: "edge_case", 
    expectMinResults: 0 // May not exist
  }
];

class TestResults {
  constructor() {
    this.results = [];
    this.summary = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    };
  }

  addResult(query, mcpCount, appCount, passed, details) {
    const result = {
      query,
      mcpCount,
      appCount,
      passed,
      details,
      ratio: mcpCount > 0 ? (appCount / mcpCount).toFixed(2) : 'N/A',
      timestamp: new Date().toISOString()
    };
    
    this.results.push(result);
    this.summary.total++;
    
    if (passed) {
      this.summary.passed++;
    } else {
      this.summary.failed++;
    }
    
    return result;
  }

  addWarning() {
    this.summary.warnings++;
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('                    CHATBNB AUTOMATED TEST REPORT');
    console.log('='.repeat(80));
    
    console.log('\nSUMMARY:');
    console.log(`Total Tests: ${this.summary.total}`);
    console.log(`Passed: ${this.summary.passed} (${(this.summary.passed/this.summary.total*100).toFixed(1)}%)`);
    console.log(`Failed: ${this.summary.failed} (${(this.summary.failed/this.summary.total*100).toFixed(1)}%)`);
    console.log(`Warnings: ${this.summary.warnings}`);
    
    console.log('\nDETAILED RESULTS:');
    console.log('-'.repeat(120));
    console.log('QUERY'.padEnd(50) + 'MCP'.padEnd(8) + 'APP'.padEnd(8) + 'RATIO'.padEnd(8) + 'STATUS'.padEnd(8) + 'DETAILS');
    console.log('-'.repeat(120));
    
    this.results.forEach(result => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const query = result.query.length > 47 ? result.query.substring(0, 44) + '...' : result.query;
      
      console.log(
        query.padEnd(50) + 
        result.mcpCount.toString().padEnd(8) + 
        result.appCount.toString().padEnd(8) +
        result.ratio.padEnd(8) +
        status.padEnd(8) +
        result.details
      );
    });
    
    console.log('-'.repeat(120));
    
    // Analysis
    console.log('\nANALYSIS:');
    const avgRatio = this.results
      .filter(r => r.ratio !== 'N/A')
      .reduce((sum, r) => sum + parseFloat(r.ratio), 0) / this.results.filter(r => r.ratio !== 'N/A').length;
    
    console.log(`Average App/MCP Ratio: ${avgRatio.toFixed(2)}`);
    
    const zeroResults = this.results.filter(r => r.appCount === 0).length;
    console.log(`Queries with 0 results: ${zeroResults}/${this.summary.total} (${(zeroResults/this.summary.total*100).toFixed(1)}%)`);
    
    const overFiltered = this.results.filter(r => r.mcpCount >= 10 && r.appCount <= 2).length;
    console.log(`Potentially over-filtered: ${overFiltered}/${this.summary.total} (${(overFiltered/this.summary.total*100).toFixed(1)}%)`);
    
    console.log('\n' + '='.repeat(80));
  }
}

async function getMCPResults(query) {
  try {
    const location = extractLocationFromQuery(query);
    if (!location) {
      console.warn(`Could not extract location from: ${query}`);
      return 0;
    }

    const response = await fetch('https://airbnb-mcp-production.up.railway.app/airbnb-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location,
        adults: 2,
        children: 0,
        page: 1,
        ignoreRobotsText: true
      })
    });

    if (!response.ok) {
      throw new Error(`MCP API error: ${response.status}`);
    }

    const data = await response.json();
    return data.searchResults ? data.searchResults.length : 0;
    
  } catch (error) {
    console.error(`MCP API error for "${query}":`, error.message);
    return -1; // Indicates API error
  }
}

async function getAppResults(browser, query) {
  const page = await browser.newPage();
  
  try {
    // Navigate to app
    await page.goto('https://chatbnb-search.vercel.app/', { waitUntil: 'networkidle0' });
    
    // Enter query
    await page.type('textarea[placeholder*="Beach house"]', query);
    
    // Click search
    await page.click('button[type="submit"], button:has(svg)');
    
    // Wait for results or timeout
    try {
      await page.waitForSelector('text="Properties ("', { timeout: 15000 });
    } catch (timeoutError) {
      // Check if still loading
      const isLoading = await page.$('text="Searching for properties..."');
      if (isLoading) {
        console.warn(`Timeout waiting for results: ${query}`);
        return -1;
      }
    }
    
    // Extract result count
    const resultText = await page.$eval('[text*="Properties ("]', el => el.textContent).catch(() => '');
    const match = resultText.match(/Properties \((\d+)\)/);
    const count = match ? parseInt(match[1]) : 0;
    
    // Get console logs for debugging
    const logs = await page.evaluate(() => {
      return window.console._logs || [];
    });
    
    return { count, logs };
    
  } catch (error) {
    console.error(`App test error for "${query}":`, error.message);
    return { count: -1, logs: [] };
  } finally {
    await page.close();
  }
}

function extractLocationFromQuery(query) {
  // Simple location extraction - could be improved
  const locations = [
    'Charleston SC', 'Charleston', 'Tokyo Japan', 'Tokyo', 'Malibu', 'Yellowstone',
    'Chicago', 'Austin', 'Miami', 'San Francisco', 'New York', 'Beverly Hills', 'Oregon'
  ];
  
  for (const location of locations) {
    if (query.toLowerCase().includes(location.toLowerCase())) {
      return location;
    }
  }
  
  return null;
}

async function runTests() {
  console.log('Starting ChatBnb Automated Test Suite...\n');
  
  const testResults = new TestResults();
  const browser = await puppeteer.launch({ headless: true });
  
  try {
    for (let i = 0; i < TEST_QUERIES.length; i++) {
      const test = TEST_QUERIES[i];
      console.log(`\n[${i + 1}/${TEST_QUERIES.length}] Testing: "${test.query}"`);
      
      // Get MCP results
      console.log('  → Fetching MCP results...');
      const mcpCount = await getMCPResults(test.query);
      
      if (mcpCount === -1) {
        testResults.addResult(test.query, 0, 0, false, 'MCP API Error');
        continue;
      }
      
      console.log(`  → MCP returned: ${mcpCount} results`);
      
      // Get App results  
      console.log('  → Testing app...');
      const appResult = await getAppResults(browser, test.query);
      
      if (appResult.count === -1) {
        testResults.addResult(test.query, mcpCount, 0, false, 'App Error/Timeout');
        continue;
      }
      
      console.log(`  → App returned: ${appResult.count} results`);
      
      // Evaluate results
      let passed = false;
      let details = '';
      
      if (appResult.count === 0 && mcpCount > 0) {
        details = 'No results - possible over-filtering';
        passed = false;
      } else if (appResult.count >= test.expectMinResults) {
        details = 'Meets minimum expectation';
        passed = true;
      } else if (appResult.count > 0) {
        details = 'Some results but below expectation';
        passed = false;
        testResults.addWarning();
      } else {
        details = 'No results found';
        passed = test.expectMinResults === 0;
      }
      
      testResults.addResult(test.query, mcpCount, appResult.count, passed, details);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } finally {
    await browser.close();
  }
  
  // Generate report
  testResults.generateReport();
  
  // Return results for potential CI/CD integration
  return testResults;
}

// Run if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, TEST_QUERIES, TestResults };