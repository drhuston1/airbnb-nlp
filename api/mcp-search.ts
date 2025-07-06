// Real MCP server integration for Airbnb search
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface SearchRequest {
  query: string
  location: string
  checkin?: string
  checkout?: string
  adults?: number
  children?: number
  infants?: number
  pets?: number
  minPrice?: number
  maxPrice?: number
  page?: number
}

interface AirbnbSearchResult {
  id: string
  url: string
  demandStayListing: {
    id: string
    description: {
      name: {
        localizedStringWithTranslationPreference: string
      }
    }
    location: {
      coordinate: {
        latitude: number
        longitude: number
      }
    }
  }
  badges: string
  structuredContent: {
    primaryLine: string
    secondaryLine: string
  }
  avgRatingA11yLabel: string
  structuredDisplayPrice: {
    primaryLine: {
      accessibilityLabel: string
    }
    explanationData: {
      priceDetails: string
    }
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, location, adults = 1, children = 0, infants = 0, checkin, checkout, minPrice, maxPrice, page = 1 }: SearchRequest = req.body

    // Extract parameters from natural language query if needed
    const queryText = query || location
    const extractedParams = extractParametersFromQuery(queryText)
    
    // Use extracted location if found, otherwise fall back to original location
    const finalLocation = extractedParams.location || location || ''
    
    const searchParams = {
      location: finalLocation,
      adults: extractedParams.adults || adults,
      children: (extractedParams.children || children) + infants,
      page,
      ignoreRobotsText: true,
      ...(extractedParams.checkin || checkin ? { checkin: extractedParams.checkin || checkin } : {}),
      ...(extractedParams.checkout || checkout ? { checkout: extractedParams.checkout || checkout } : {}),
      ...(extractedParams.minPrice || minPrice ? { minPrice: extractedParams.minPrice || minPrice } : {}),
      ...(extractedParams.maxPrice || maxPrice ? { maxPrice: extractedParams.maxPrice || maxPrice } : {})
    }

    if (!finalLocation && !query) {
      return res.status(400).json({ error: 'Location is required for search' })
    }

    console.log('Calling MCP server with params:', searchParams)

    // Call the external MCP server
    const mcpResult = await callExternalMCPServer(searchParams)
    
    console.log('MCP Result received:', JSON.stringify(mcpResult, null, 2))
    console.log('MCP searchResults count:', mcpResult.searchResults?.length)
    
    if (!mcpResult) {
      throw new Error('No response from MCP server')
    }
    
    if (!mcpResult.searchResults) {
      console.log('MCP result structure:', Object.keys(mcpResult))
      throw new Error(`MCP server returned data but no searchResults. Got: ${JSON.stringify(Object.keys(mcpResult))}`)
    }

    // Transform MCP results to our format
    const listings = await transformMCPResults(mcpResult.searchResults)

    return res.status(200).json({
      listings,
      searchUrl: mcpResult.searchUrl,
      totalResults: listings.length,
      page: page,
      hasMore: listings.length >= 18, // Assume more pages if we got a full page
      source: 'Real Airbnb MCP Server'
    })

  } catch (error) {
    console.error('MCP search error:', error)
    
    return res.status(500).json({
      error: 'Failed to search Airbnb listings via MCP',
      details: error instanceof Error ? error.message : 'Unknown error',
      suggestion: 'Check MCP server configuration and network connectivity',
      debugging: {
        mcpServerUrl: process.env.MCP_SERVER_URL,
        requestBody: req.body,
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }
    })
  }
}

async function callExternalMCPServer(params: Record<string, unknown>) {
  console.log('Calling external MCP server with params:', params)
  
  // Use environment variable or default to your enhanced MCP server
  const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://airbnb-mcp-production.up.railway.app'
  
  try {
    const response = await fetch(`${mcpServerUrl}/airbnb-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`External MCP server error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    return result
    
  } catch (error) {
    console.error('External MCP server call failed:', error)
    throw error
  }
}

async function transformMCPResults(searchResults: AirbnbSearchResult[]) {
  return Promise.all(searchResults.map(async (listing) => {
    // Extract price from the accessibility label
    const priceMatch = listing.structuredDisplayPrice?.primaryLine?.accessibilityLabel?.match(/\$(\d+(?:,\d+)*)/g)
    const priceNumbers = priceMatch ? priceMatch.map(p => parseInt(p.replace(/[$,]/g, ''))) : [100]
    const totalPrice = priceNumbers[0] || 100
    const nightlyRate = priceNumbers.length > 1 ? Math.round(totalPrice / 5) : totalPrice // Assume 5 nights if total given

    // Extract rating
    const ratingMatch = listing.avgRatingA11yLabel?.match(/([\d.]+)\s+out\s+of\s+5/)
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 4.0

    // Extract review count
    const reviewMatch = listing.avgRatingA11yLabel?.match(/(\d+)\s+review/)
    const reviewsCount = reviewMatch ? parseInt(reviewMatch[1]) : 0

    // Determine if superhost
    const isSuperhost = listing.badges?.toLowerCase().includes('superhost') || false

    // Extract city from coordinates
    const lat = listing.demandStayListing?.location?.coordinate?.latitude
    const lng = listing.demandStayListing?.location?.coordinate?.longitude
    const city = await getCityFromCoordinates(lat, lng)

    return {
      id: listing.id,
      name: listing.demandStayListing?.description?.name?.localizedStringWithTranslationPreference || 'Property',
      url: listing.url,
      images: [],
      price: {
        total: totalPrice,
        rate: nightlyRate,
        currency: 'USD'
      },
      rating,
      reviewsCount,
      location: {
        city: city || 'Unknown',
        country: 'US'
      },
      host: {
        name: 'Host',
        isSuperhost
      },
      amenities: [],
      roomType: listing.structuredContent?.primaryLine || 'Property'
    }
  }))
}

async function getCityFromCoordinates(lat?: number, lng?: number): Promise<string | undefined> {
  if (!lat || !lng) return undefined

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ChatBnb/1.0 (https://chatbnb.vercel.app)'
        }
      }
    )

    if (response.ok) {
      const data = await response.json()
      const address = data.address
      
      const city = address?.city || 
                   address?.town || 
                   address?.village || 
                   address?.municipality ||
                   address?.county
      
      return city
    }
  } catch (error) {
    console.log('Reverse geocoding failed:', error)
  }

  return undefined
}

interface ExtractedParams {
  location: string
  adults?: number
  children?: number
  checkin?: string
  checkout?: string
  minPrice?: number
  maxPrice?: number
}

function extractParametersFromQuery(queryText: string): ExtractedParams {
  if (!queryText) return { location: '' }
  
  const result: ExtractedParams = { location: '' }
  
  // First check if this is a price-only or filter-only query (no location)
  const isPriceOnlyQuery = /^(?:i\s+)?(?:don't|don't|do\s+not)\s+(?:want\s+to\s+)?spend\s+(?:more\s+than\s+)?\$?\d+k?(?:\s+total)?$/i.test(queryText.trim())
  const isFilterOnlyQuery = /^(?:under|less\s+than|max|maximum|limit)\s*\$?\d+k?(?:\s+total)?$/i.test(queryText.trim())
  
  if (isPriceOnlyQuery || isFilterOnlyQuery) {
    // This is a followup query with no location - leave location empty
    result.location = ''
  } else {
    // Try to extract location
    const locationPatterns = [
      /(?:near|in|at|around)\s+([a-zA-Z\s,]+?)(?:\s+for|\s+with|\s*$|\s+\d|\.|,)/i,
      /(?:beachfront|beach|property)\s+(?:in|at|near)\s+([a-zA-Z\s,]+?)(?:\s+for|\s*$|\s+\d)/i,
      /^([a-zA-Z\s,]+?)\s+(?:beachfront|beach|property|villa|house|home)/i,
      // Fallback: if no specific patterns match and it looks like a location
      /^([a-zA-Z\s,]+?)(?:\s*\.|\s*$)/i
    ]
    
    for (const pattern of locationPatterns) {
      const match = queryText.match(pattern)
      if (match && match[1]) {
        let location = match[1].trim()
        location = location.replace(/\b(for|with|and|the|a|an|property|properties|beachfront|beach|house|home|villa|apartment|condo|looking|front)\b/gi, '')
        location = location.replace(/\s+/g, ' ').trim()
        
        // Exclude obvious non-locations
        const nonLocationTerms = /^(i|don't|don't|do|not|want|spend|more|than|under|less|max|maximum|limit|total|nights|adults|children|toddler|highly|rated|reviews)$/i
        
        if (location.length >= 2 && !/^\d+$/.test(location) && !nonLocationTerms.test(location)) {
          result.location = location
          break
        }
      }
    }
  }
  
  // Extract guest counts
  const adultMatches = queryText.match(/(\d+)\s+adults?/i)
  if (adultMatches) {
    result.adults = parseInt(adultMatches[1])
  }
  
  const peopleMatches = queryText.match(/for\s+(\d+)\s+people/i)
  if (peopleMatches && !result.adults) {
    result.adults = parseInt(peopleMatches[1])
  }
  
  const childrenMatches = queryText.match(/(\d+)\s+(?:child|children|toddler|kids?)/i)
  if (childrenMatches) {
    result.children = parseInt(childrenMatches[1])
  }
  
  // Extract price constraints
  const pricePatterns = [
    /(?:under|less\s+than|no\s+more\s+than)\s*\$?(\d+)k?/i,
    /(?:max(?:imum)?|limit)\s*\$?(\d+)k?/i,
    /(?:don't|don't|do\s+not)\s+(?:want\s+to\s+)?spend\s+(?:more\s+than\s+)?\$?(\d+)k?/i,
    /\$?(\d+)k?\s+(?:total|max|maximum|limit)/i
  ]
  
  for (const pattern of pricePatterns) {
    const match = queryText.match(pattern)
    if (match && match[1]) {
      let price = parseInt(match[1])
      // Handle 'k' suffix (5k = 5000)
      if (queryText.toLowerCase().includes(match[1] + 'k')) {
        price *= 1000
      }
      result.maxPrice = price
      break
    }
  }
  
  // Extract dates (basic patterns)
  const dateRangeMatch = queryText.match(/from\s+([a-zA-Z]+\s+\d+)(?:st|nd|rd|th)?\s+to\s+([a-zA-Z]+\s+\d+)/i)
  if (dateRangeMatch) {
    // Convert to YYYY-MM-DD format (basic implementation)
    const startDate = parseNaturalDate(dateRangeMatch[1])
    const endDate = parseNaturalDate(dateRangeMatch[2])
    if (startDate) result.checkin = startDate
    if (endDate) result.checkout = endDate
  }
  
  // Week after Labor Day (first Monday in September)
  if (queryText.toLowerCase().includes('week after labor day')) {
    const year = new Date().getFullYear()
    const laborDay = getFirstMondayInSeptember(year)
    const weekAfter = new Date(laborDay)
    weekAfter.setDate(weekAfter.getDate() + 7)
    
    result.checkin = formatDate(weekAfter)
    
    // If they mention "5 days"
    if (queryText.includes('5 days')) {
      const checkout = new Date(weekAfter)
      checkout.setDate(checkout.getDate() + 5)
      result.checkout = formatDate(checkout)
    }
  }
  
  console.log(`Extracted params from "${queryText}":`, result)
  return result
}

function parseNaturalDate(dateStr: string): string | undefined {
  // Basic date parsing - convert "September 9" to "2024-09-09"
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12'
  }
  
  const match = dateStr.match(/([a-zA-Z]+)\s+(\d+)/i)
  if (match) {
    const month = months[match[1].toLowerCase()]
    if (month) {
      const day = match[2].padStart(2, '0')
      const year = new Date().getFullYear()
      return `${year}-${month}-${day}`
    }
  }
  return undefined
}

function getFirstMondayInSeptember(year: number): Date {
  const sept1 = new Date(year, 8, 1) // September 1st
  const dayOfWeek = sept1.getDay()
  const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  return new Date(year, 8, 1 + daysToMonday)
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}