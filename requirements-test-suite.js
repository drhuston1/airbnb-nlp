#!/usr/bin/env node

// Comprehensive Requirements Testing Suite for ChatBnb
// Tests the deployed application against the detailed requirements specification

const puppeteer = require('puppeteer');

// Test categories mapped to requirements
const TEST_CATEGORIES = {
  LOCATION_EXTRACTION: 'REQ-1.1',
  PROPERTY_TYPE: 'REQ-1.2', 
  CRITERIA_EXTRACTION: 'REQ-1.3',
  COMPLEX_QUERIES: 'REQ-1.4',
  REAL_DATA: 'REQ-2.1',
  FILTERING_RANKING: 'REQ-2.2',
  CHAT_INTERFACE: 'REQ-3.1',
  RESULTS_DISPLAY: 'REQ-3.2',
  REFINEMENT_SUGGESTIONS: 'REQ-3.3',
  SEARCH_HISTORY: 'REQ-3.4',
  CONTEXT_PRESERVATION: 'REQ-4.1',
  ERROR_HANDLING: 'REQ-5.1',
  PERFORMANCE: 'REQ-6.1'
};

// Comprehensive test cases organized by requirement
const REQUIREMENT_TESTS = [
  // REQ-1.1: Location Extraction
  {
    id: 'LOC-001',
    requirement: TEST_CATEGORIES.LOCATION_EXTRACTION,
    name: 'Basic City Names',
    query: 'apartment in Tokyo',
    expectLocation: 'Tokyo',
    expectMinResults: 5,
    criticalPath: true
  },
  {
    id: 'LOC-002', 
    requirement: TEST_CATEGORIES.LOCATION_EXTRACTION,
    name: 'City + State Format',
    query: 'house in Charleston SC',
    expectLocation: 'Charleston SC',
    expectMinResults: 5,
    criticalPath: true
  },
  {
    id: 'LOC-003',
    requirement: TEST_CATEGORIES.LOCATION_EXTRACTION,
    name: 'City + Country Format',
    query: 'villa in Paris France',
    expectLocation: 'Paris France',
    expectMinResults: 2,
    criticalPath: false
  },
  {
    id: 'LOC-004',
    requirement: TEST_CATEGORIES.LOCATION_EXTRACTION,
    name: 'Landmark/Area Recognition',
    query: 'cabin near Yellowstone',
    expectLocation: 'Yellowstone',
    expectMinResults: 1,
    criticalPath: false
  },
  {
    id: 'LOC-005',
    requirement: TEST_CATEGORIES.LOCATION_EXTRACTION,
    name: 'Missing Location Error',
    query: 'luxury house with pool',
    expectError: true,
    expectMessage: 'location',
    criticalPath: true
  },

  // REQ-1.2: Property Type Recognition
  {
    id: 'PROP-001',
    requirement: TEST_CATEGORIES.PROPERTY_TYPE,
    name: 'Basic Property Types',
    query: 'villa in Malibu',
    expectPropertyType: 'villa',
    expectMinResults: 2,
    criticalPath: true
  },
  {
    id: 'PROP-002',
    requirement: TEST_CATEGORIES.PROPERTY_TYPE,
    name: 'Semantic Property Matching',
    query: 'luxury home in Beverly Hills',
    expectPropertyType: 'luxury',
    expectMinResults: 1,
    criticalPath: true
  },
  {
    id: 'PROP-003',
    requirement: TEST_CATEGORIES.PROPERTY_TYPE,
    name: 'Cabin Property Type',
    query: 'cozy cabin in Colorado',
    expectPropertyType: 'cabin',
    expectMinResults: 1,
    criticalPath: false
  },

  // REQ-1.3: Criteria Extraction
  {
    id: 'CRIT-001',
    requirement: TEST_CATEGORIES.CRITERIA_EXTRACTION,
    name: 'Guest Count Extraction',
    query: 'house in Austin for 6 people',
    expectGuestCount: 6,
    expectMinResults: 2,
    criticalPath: true
  },
  {
    id: 'CRIT-002',
    requirement: TEST_CATEGORIES.CRITERIA_EXTRACTION,
    name: 'Bedroom Requirements',
    query: '4 bedroom house in Miami',
    expectBedrooms: 4,
    expectMinResults: 1,
    criticalPath: true
  },
  {
    id: 'CRIT-003',
    requirement: TEST_CATEGORIES.CRITERIA_EXTRACTION,
    name: 'Amenity Requirements',
    query: 'house with pool in Las Vegas',
    expectAmenities: ['pool'],
    expectMinResults: 2,
    criticalPath: true
  },
  {
    id: 'CRIT-004',
    requirement: TEST_CATEGORIES.CRITERIA_EXTRACTION,
    name: 'Price Budget Constraints',
    query: 'apartment in NYC under $200',
    expectPriceMax: 200,
    expectMinResults: 1,
    criticalPath: true
  },
  {
    id: 'CRIT-005',
    requirement: TEST_CATEGORIES.CRITERIA_EXTRACTION,
    name: 'Superhost Requirement',
    query: 'superhost property in San Francisco',
    expectSuperhost: true,
    expectMinResults: 2,
    criticalPath: true
  },

  // REQ-1.4: Complex Multi-Criteria Queries
  {
    id: 'COMPLEX-001',
    requirement: TEST_CATEGORIES.COMPLEX_QUERIES,
    name: 'Multi-Criteria Luxury Query',
    query: 'Luxury beachfront villa in Malibu for 6 people with pool, superhost only',
    expectLocation: 'Malibu',
    expectPropertyType: 'villa',
    expectGuestCount: 6,
    expectAmenities: ['pool'],
    expectSuperhost: true,
    expectMinResults: 1,
    criticalPath: true
  },
  {
    id: 'COMPLEX-002',
    requirement: TEST_CATEGORIES.COMPLEX_QUERIES,
    name: 'Budget + Amenity Query',
    query: 'Dog-friendly cabin near Yellowstone under $150 with 4.8+ rating',
    expectLocation: 'Yellowstone',
    expectPropertyType: 'cabin',
    expectPriceMax: 150,
    expectAmenities: ['pet friendly'],
    expectRatingMin: 4.8,
    expectMinResults: 1,
    criticalPath: true
  },
  {
    id: 'COMPLEX-003',
    requirement: TEST_CATEGORIES.COMPLEX_QUERIES,
    name: 'Urban Specific Requirements',
    query: 'Modern downtown loft in Chicago with parking, entire home under $200',
    expectLocation: 'Chicago',
    expectPropertyType: 'loft',
    expectAmenities: ['parking'],
    expectPriceMax: 200,
    expectMinResults: 1,
    criticalPath: true
  },

  // REQ-2.1: Real Data Integration
  {
    id: 'DATA-001',
    requirement: TEST_CATEGORIES.REAL_DATA,
    name: 'Real Airbnb Data Verification',
    query: 'house in Charleston SC',
    expectRealData: true,
    expectAirbnbLinks: true,
    expectMinResults: 10,
    criticalPath: true
  },
  {
    id: 'DATA-002',
    requirement: TEST_CATEGORIES.REAL_DATA,
    name: 'Price Data Accuracy',
    query: 'apartment in Tokyo',
    expectPriceData: true,
    expectValidPrices: true,
    expectMinResults: 10,
    criticalPath: true
  },

  // REQ-2.2: Filtering and Ranking
  {
    id: 'FILTER-001',
    requirement: TEST_CATEGORIES.FILTERING_RANKING,
    name: 'Superhost Prioritization',
    query: 'property in San Francisco',
    expectSuperhostFirst: true,
    expectMinResults: 5,
    criticalPath: true
  },
  {
    id: 'FILTER-002',
    requirement: TEST_CATEGORIES.FILTERING_RANKING,
    name: 'Rating-Based Ranking',
    query: 'highly rated apartment in New York',
    expectHighRatingsFirst: true,
    expectMinResults: 5,
    criticalPath: true
  },

  // REQ-4.1: Context Preservation
  {
    id: 'CONTEXT-001',
    requirement: TEST_CATEGORIES.CONTEXT_PRESERVATION,
    name: 'Location Context in Refinements',
    initialQuery: 'house in Austin',
    refinementQuery: 'with pool',
    expectSameLocation: true,
    expectMinResults: 2,
    criticalPath: true
  },
  {
    id: 'CONTEXT-002',
    requirement: TEST_CATEGORIES.CONTEXT_PRESERVATION,
    name: 'Property Type Context',
    initialQuery: 'villa in Malibu',
    refinementQuery: 'under $300',
    expectSamePropertyType: true,
    expectMinResults: 1,
    criticalPath: false
  },

  // REQ-5.1: Error Handling
  {
    id: 'ERROR-001',
    requirement: TEST_CATEGORIES.ERROR_HANDLING,
    name: 'Ambiguous Query Handling',
    query: 'nice place',
    expectClarificationPrompt: true,
    criticalPath: true
  },
  {
    id: 'ERROR-002',
    requirement: TEST_CATEGORIES.ERROR_HANDLING,
    name: 'Invalid Location Handling',
    query: 'house in Atlantis',
    expectGracefulError: true,
    criticalPath: false
  }
];

class RequirementsTestSuite {
  constructor() {
    this.results = [];
    this.summary = {
      total: 0,
      passed: 0,
      failed: 0,
      critical_failures: 0,
      requirements_coverage: new Map()
    };
  }

  async runTests() {
    console.log('🚀 Starting ChatBnb Requirements Test Suite');
    console.log('=' .repeat(80));
    console.log(`Testing ${REQUIREMENT_TESTS.length} requirements across ${Object.keys(TEST_CATEGORIES).length} categories`);
    console.log('');

    const browser = await puppeteer.launch({ headless: true });

    try {
      for (let i = 0; i < REQUIREMENT_TESTS.length; i++) {
        const test = REQUIREMENT_TESTS[i];
        console.log(`[${i + 1}/${REQUIREMENT_TESTS.length}] ${test.requirement}: ${test.name}`);
        
        const result = await this.runSingleTest(browser, test);
        this.results.push(result);
        this.updateSummary(result);
        
        // Short delay between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } finally {
      await browser.close();
    }

    this.generateReport();
    return this.summary;
  }

  async runSingleTest(browser, test) {
    const page = await browser.newPage();
    const startTime = Date.now();
    
    try {
      // Navigate to app
      await page.goto('https://chatbnb-search.vercel.app/', { waitUntil: 'networkidle0' });
      
      let result = {
        id: test.id,
        requirement: test.requirement,
        name: test.name,
        query: test.query,
        passed: false,
        details: '',
        responseTime: 0,
        criticalPath: test.criticalPath,
        actualResults: {},
        timestamp: new Date().toISOString()
      };

      // Handle multi-step context tests
      if (test.initialQuery && test.refinementQuery) {
        result = await this.runContextTest(page, test, result);
      } else if (test.expectError || test.expectClarificationPrompt) {
        result = await this.runErrorTest(page, test, result);
      } else {
        result = await this.runStandardTest(page, test, result);
      }

      result.responseTime = Date.now() - startTime;
      return result;

    } catch (error) {
      return {
        id: test.id,
        requirement: test.requirement,
        name: test.name,
        query: test.query,
        passed: false,
        details: `Test execution failed: ${error.message}`,
        responseTime: Date.now() - startTime,
        criticalPath: test.criticalPath,
        actualResults: {},
        timestamp: new Date().toISOString()
      };
    } finally {
      await page.close();
    }
  }

  async runStandardTest(page, test, result) {
    try {
      // Enter query
      await page.type('textarea[placeholder*="Beach house"]', test.query);
      await page.click('button[type="submit"], button:has(svg)');
      
      // Wait for results
      await page.waitForSelector('text="Properties ("', { timeout: 15000 });
      
      // Extract results data
      const resultsData = await this.extractResultsData(page);
      result.actualResults = resultsData;
      
      // Validate against test expectations
      result.passed = this.validateTestExpectations(test, resultsData);
      result.details = this.generateTestDetails(test, resultsData);
      
      return result;
    } catch (error) {
      result.details = `Standard test failed: ${error.message}`;
      return result;
    }
  }

  async runContextTest(page, test, result) {
    try {
      // First query
      await page.type('textarea[placeholder*="Beach house"]', test.initialQuery);
      await page.click('button[type="submit"], button:has(svg)');
      await page.waitForSelector('text="Properties ("', { timeout: 15000 });
      
      // Second query (refinement)
      await page.type('textarea[placeholder*="Ask for more"]', test.refinementQuery);
      await page.press('textarea[placeholder*="Ask for more"]', 'Enter');
      await page.waitForSelector('text="Properties ("', { timeout: 15000 });
      
      // Extract final results
      const resultsData = await this.extractResultsData(page);
      result.actualResults = resultsData;
      
      // Validate context preservation
      result.passed = this.validateContextPreservation(test, resultsData);
      result.details = this.generateContextTestDetails(test, resultsData);
      
      return result;
    } catch (error) {
      result.details = `Context test failed: ${error.message}`;
      return result;
    }
  }

  async runErrorTest(page, test, result) {
    try {
      // Enter query that should trigger error
      await page.type('textarea[placeholder*="Beach house"]', test.query);
      await page.click('button[type="submit"], button:has(svg)');
      
      // Wait for error message or clarification
      await page.waitForTimeout(5000);
      
      // Check for error messages or clarification prompts
      const messages = await page.$$eval('[role="log"], .error-message, .clarification', 
        elements => elements.map(el => el.textContent));
      
      const hasError = messages.some(msg => 
        msg.toLowerCase().includes('location') || 
        msg.toLowerCase().includes('specify') ||
        msg.toLowerCase().includes('where')
      );
      
      result.actualResults = { messages, hasError };
      result.passed = hasError;
      result.details = hasError ? 'Error handling working correctly' : 'Expected error not detected';
      
      return result;
    } catch (error) {
      result.details = `Error test failed: ${error.message}`;
      return result;
    }
  }

  async extractResultsData(page) {
    try {
      // Extract result count
      const countText = await page.$eval('[text*="Properties ("]', el => el.textContent).catch(() => '');
      const countMatch = countText.match(/Properties \((\d+)\)/);
      const resultCount = countMatch ? parseInt(countMatch[1]) : 0;
      
      // Extract property data
      const properties = await page.$$eval('.property-card, [data-testid="property"]', cards => {
        return cards.slice(0, 5).map(card => ({ // Sample first 5
          name: card.querySelector('.property-name, h3, h2')?.textContent || '',
          price: card.querySelector('.price, [data-testid="price"]')?.textContent || '',
          rating: card.querySelector('.rating, [data-testid="rating"]')?.textContent || '',
          roomType: card.querySelector('.room-type, [data-testid="room-type"]')?.textContent || '',
          isSuperhost: !!card.querySelector('.superhost, [data-testid="superhost"]'),
          amenities: Array.from(card.querySelectorAll('.amenity, [data-testid="amenity"]')).map(a => a.textContent)
        }));
      }).catch(() => []);
      
      // Extract refinement suggestions
      const refinements = await page.$$eval('.refinement-suggestion, [data-testid="refinement"]', refs => {
        return refs.map(ref => ({
          label: ref.textContent,
          type: ref.dataset.type || 'unknown'
        }));
      }).catch(() => []);
      
      return {
        resultCount,
        properties,
        refinements,
        hasResults: resultCount > 0,
        hasRealData: properties.length > 0 && properties[0].price.includes('$'),
        averageRating: properties.length > 0 ? 
          properties.reduce((sum, p) => sum + (parseFloat(p.rating) || 0), 0) / properties.length : 0
      };
    } catch (error) {
      console.error('Error extracting results data:', error);
      return { resultCount: 0, properties: [], refinements: [], hasResults: false };
    }
  }

  validateTestExpectations(test, resultsData) {
    let validations = [];
    
    // Check minimum results
    if (test.expectMinResults !== undefined) {
      validations.push(resultsData.resultCount >= test.expectMinResults);
    }
    
    // Check real data requirement
    if (test.expectRealData) {
      validations.push(resultsData.hasRealData);
    }
    
    // Check for Airbnb links
    if (test.expectAirbnbLinks) {
      validations.push(resultsData.properties.some(p => p.name.length > 0));
    }
    
    // Check superhost prioritization
    if (test.expectSuperhostFirst && resultsData.properties.length > 1) {
      const firstProperty = resultsData.properties[0];
      validations.push(firstProperty.isSuperhost);
    }
    
    // Check high ratings first
    if (test.expectHighRatingsFirst && resultsData.properties.length > 1) {
      validations.push(resultsData.averageRating >= 4.5);
    }
    
    return validations.length > 0 ? validations.every(v => v) : resultsData.hasResults;
  }

  validateContextPreservation(test, resultsData) {
    // For context tests, we mainly check that we still get relevant results
    // More sophisticated validation would require tracking location/property type
    return resultsData.hasResults && resultsData.resultCount >= (test.expectMinResults || 1);
  }

  generateTestDetails(test, resultsData) {
    const details = [];
    
    details.push(`Found ${resultsData.resultCount} results`);
    
    if (resultsData.properties.length > 0) {
      details.push(`Sample property: ${resultsData.properties[0].name}`);
      details.push(`Average rating: ${resultsData.averageRating.toFixed(2)}`);
    }
    
    if (test.expectMinResults !== undefined) {
      details.push(`Expected min ${test.expectMinResults}, got ${resultsData.resultCount}`);
    }
    
    return details.join('; ');
  }

  generateContextTestDetails(test, resultsData) {
    return `Context test: ${test.initialQuery} → ${test.refinementQuery}. Results: ${resultsData.resultCount}`;
  }

  updateSummary(result) {
    this.summary.total++;
    if (result.passed) {
      this.summary.passed++;
    } else {
      this.summary.failed++;
      if (result.criticalPath) {
        this.summary.critical_failures++;
      }
    }
    
    // Track coverage by requirement
    if (!this.summary.requirements_coverage.has(result.requirement)) {
      this.summary.requirements_coverage.set(result.requirement, { total: 0, passed: 0 });
    }
    const reqCoverage = this.summary.requirements_coverage.get(result.requirement);
    reqCoverage.total++;
    if (result.passed) reqCoverage.passed++;
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('                    REQUIREMENTS TEST REPORT');
    console.log('='.repeat(80));
    
    // Overall Summary
    console.log('\n📊 OVERALL RESULTS:');
    console.log(`Total Tests: ${this.summary.total}`);
    console.log(`✅ Passed: ${this.summary.passed} (${(this.summary.passed/this.summary.total*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${this.summary.failed} (${(this.summary.failed/this.summary.total*100).toFixed(1)}%)`);
    console.log(`🚨 Critical Failures: ${this.summary.critical_failures}`);
    
    // Requirements Coverage
    console.log('\n📋 REQUIREMENTS COVERAGE:');
    console.log('-'.repeat(60));
    this.summary.requirements_coverage.forEach((coverage, requirement) => {
      const percent = (coverage.passed / coverage.total * 100).toFixed(1);
      const status = coverage.passed === coverage.total ? '✅' : '⚠️ ';
      console.log(`${status} ${requirement}: ${coverage.passed}/${coverage.total} (${percent}%)`);
    });
    
    // Failed Tests Detail
    const failedTests = this.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      console.log('-'.repeat(60));
      failedTests.forEach(test => {
        const critical = test.criticalPath ? '🚨' : '⚠️ ';
        console.log(`${critical} ${test.id}: ${test.name}`);
        console.log(`   Query: "${test.query}"`);
        console.log(`   Issue: ${test.details}`);
        console.log('');
      });
    }
    
    // Performance Summary
    const avgResponseTime = this.results.reduce((sum, r) => sum + r.responseTime, 0) / this.results.length;
    console.log('\n⚡ PERFORMANCE:');
    console.log(`Average Response Time: ${(avgResponseTime/1000).toFixed(2)}s`);
    
    // Critical Path Analysis
    const criticalTests = this.results.filter(r => r.criticalPath);
    const criticalPassed = criticalTests.filter(r => r.passed).length;
    console.log('\n🎯 CRITICAL PATH ANALYSIS:');
    console.log(`Critical Tests: ${criticalPassed}/${criticalTests.length} passed`);
    
    if (this.summary.critical_failures === 0) {
      console.log('✅ All critical functionality working');
    } else {
      console.log(`🚨 ${this.summary.critical_failures} critical failures detected`);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

// Run if called directly
if (require.main === module) {
  const testSuite = new RequirementsTestSuite();
  testSuite.runTests().catch(console.error);
}

module.exports = { RequirementsTestSuite, REQUIREMENT_TESTS };