import type { SearchContext } from '../types'

// Helper function for Labor Day calculation
export const getFirstMondayInSeptember = (year: number): Date => {
  const sept1 = new Date(year, 8, 1) // September 1st
  const dayOfWeek = sept1.getDay()
  const daysToMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  return new Date(year, 8, 1 + daysToMonday)
}

// Helper function for date formatting
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

// Extract search context from initial query
export const extractSearchContext = (query: string): SearchContext => {
  const lowerQuery = query.toLowerCase()
  
  // Extract location
  let location = 'Unknown'
  const locationPatterns = [
    /(?:near|in|at|around)\s+([a-zA-Z\s,]+?)(?:\s+for|\s+with|\s*$|\s+\d|\.|,)/i,
    /(?:beachfront|beach|property)\s+(?:in|at|near)\s+([a-zA-Z\s,]+?)(?:\s+for|\s*$|\s+\d)/i,
    /^([a-zA-Z\s,]+?)\s+(?:beachfront|beach|property|villa|house|home)/i,
    /^([a-zA-Z\s,]+?)[\.\,]/i // Simple fallback
  ]
  
  for (const pattern of locationPatterns) {
    const match = query.match(pattern)
    if (match && match[1]) {
      let extractedLocation = match[1].trim()
      extractedLocation = extractedLocation.replace(/\b(for|with|and|the|a|an|property|properties|beachfront|beach|house|home|villa|apartment|condo|looking|front)\b/gi, '')
      extractedLocation = extractedLocation.replace(/\s+/g, ' ').trim()
      
      if (extractedLocation.length >= 2 && !/^\d+$/.test(extractedLocation)) {
        location = extractedLocation
        break
      }
    }
  }
  
  // Extract guest counts
  let adults = 1
  let children = 0
  
  const adultMatches = lowerQuery.match(/(\d+)\s+adults?/i)
  if (adultMatches) {
    adults = parseInt(adultMatches[1])
  }
  
  const peopleMatches = lowerQuery.match(/for\s+(\d+)\s+people/i)
  if (peopleMatches && !adultMatches) {
    adults = parseInt(peopleMatches[1])
  }
  
  const childrenMatches = lowerQuery.match(/(\d+)\s+(?:child|children|toddler|kids?)/i)
  if (childrenMatches) {
    children = parseInt(childrenMatches[1])
  }
  
  // Extract nights
  let nights: number | undefined
  const nightsMatch = lowerQuery.match(/(\d+)\s+nights?/i)
  if (nightsMatch) {
    nights = parseInt(nightsMatch[1])
  }
  
  // Extract dates
  let checkin: string | undefined
  let checkout: string | undefined
  
  // Labor Day patterns
  const laborDayPatterns = [
    /(?:week after|post) labor day(?:\s+weekend)?/i,
    /after labor day(?:\s+weekend)?/i,
    /labor day(?:\s+weekend)?\s+(?:week|weekend)/i
  ]
  
  for (const pattern of laborDayPatterns) {
    if (pattern.test(query)) {
      const year = new Date().getFullYear()
      const laborDay = getFirstMondayInSeptember(year)
      
      // "Post labor day weekend" = Tuesday after Labor Day weekend
      const startDate = new Date(laborDay)
      startDate.setDate(startDate.getDate() + 1) // Tuesday after Labor Day Monday
      
      checkin = formatDate(startDate)
      
      // Calculate checkout if nights are specified
      if (nights) {
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + nights)
        checkout = formatDate(endDate)
      }
      break
    }
  }
  
  // Extract prices
  let minPrice: number | undefined
  let maxPrice: number | undefined
  
  const underPriceMatch = lowerQuery.match(/under\s*\$?(\d+)k?/i)
  if (underPriceMatch) {
    let price = parseInt(underPriceMatch[1])
    if (lowerQuery.includes(underPriceMatch[1] + 'k')) {
      price *= 1000
    }
    maxPrice = price
  }
  
  return {
    location,
    adults,
    children,
    nights,
    checkin,
    checkout,
    minPrice,
    maxPrice
  }
}

// Update existing search context with new parameters from followup query
export const updateSearchContext = (existingContext: SearchContext, followupQuery: string): SearchContext => {
  const lowerQuery = followupQuery.toLowerCase()
  const updated = { ...existingContext }
  
  // Update price constraints
  const pricePatterns = [
    /(?:under|less\s+than|no\s+more\s+than)\s*\$?(\d+)k?/i,
    /(?:max(?:imum)?|limit)\s*\$?(\d+)k?/i,
    /(?:don't|don't|do\s+not)\s+(?:want\s+to\s+)?spend\s+(?:more\s+than\s+)?\$?(\d+)k?/i,
    /\$?(\d+)k?\s+(?:total|max|maximum|limit)/i,
    /(?:show\s+)?(?:options\s+)?(?:under|below)\s*\$?(\d+)k?/i // NEW: Handle "Show options under $143"
  ]
  
  for (const pattern of pricePatterns) {
    const match = followupQuery.match(pattern)
    if (match && match[1]) {
      let price = parseInt(match[1])
      // Handle 'k' suffix properly - check if k appears right after the number
      if (/\d+k/i.test(match[0])) {
        price *= 1000
      }
      updated.maxPrice = price
      console.log(`Updated maxPrice from "${followupQuery}" to $${price}`)
      break
    }
  }
  
  // Update guest counts if mentioned
  const adultMatches = lowerQuery.match(/(\d+)\s+adults?/i)
  if (adultMatches) {
    updated.adults = parseInt(adultMatches[1])
  }
  
  const childrenMatches = lowerQuery.match(/(\d+)\s+(?:child|children|toddler|kids?)/i)
  if (childrenMatches) {
    updated.children = parseInt(childrenMatches[1])
  }
  
  return updated
}