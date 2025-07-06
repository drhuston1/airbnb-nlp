import type { SearchContext } from '../types'
import type { QueryAnalysis } from './nlpAnalysis'
import { analyzeQuery } from './nlpAnalysis'

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
  // Legacy function - redirect to pure NLP implementation
  const analysis = analyzeQuery(query)
  return extractSearchContextFromNLP(analysis)
}

// Update existing search context with new parameters from followup query
export const updateSearchContext = (existingContext: SearchContext, followupQuery: string): SearchContext => {
  // Legacy function - redirect to pure NLP implementation
  const analysis = analyzeQuery(followupQuery)
  return updateSearchContextFromNLP(existingContext, analysis)
}

// Enhanced context extraction using NLP analysis
export const extractSearchContextFromNLP = (analysis: QueryAnalysis): SearchContext => {
  const context: SearchContext = {
    location: analysis.entities.places[0] || 'Unknown',
    adults: analysis.guestInfo.adults || 1,
    children: analysis.guestInfo.children || 0
  }

  // Handle special date patterns using NLP keywords
  const query = analysis.keywords.join(' ').toLowerCase()
  if (query.includes('labor day') || query.includes('labour day')) {
    const year = new Date().getFullYear()
    const laborDay = getFirstMondayInSeptember(year)
    
    // Check for "week after" or "post" labor day
    if (query.includes('after') || query.includes('post') || query.includes('week')) {
      const startDate = new Date(laborDay)
      startDate.setDate(startDate.getDate() + 1) // Tuesday after Labor Day Monday
      context.checkin = formatDate(startDate)
      
      // If we can extract nights from the query, calculate checkout
      const nightsKeywords = analysis.keywords.filter(k => /\d+/.test(k) && (query.includes(k + ' night') || query.includes(k + ' day')))
      if (nightsKeywords.length > 0) {
        const nights = parseInt(nightsKeywords[0].match(/\d+/)?.[0] || '5')
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + nights)
        context.checkout = formatDate(endDate)
        context.nights = nights
      }
    }
  }

  // Extract budget from money entities
  if (analysis.entities.money.length > 0) {
    const moneyStr = analysis.entities.money[0]
    const priceMatch = moneyStr.match(/\$?(\d+)/)
    if (priceMatch) {
      const price = parseInt(priceMatch[1])
      // Check context to determine if this is max price
      const queryLower = analysis.keywords.join(' ').toLowerCase()
      if (queryLower.includes('under') || queryLower.includes('below') || queryLower.includes('max')) {
        context.maxPrice = price
      } else if (queryLower.includes('over') || queryLower.includes('above') || queryLower.includes('min')) {
        context.minPrice = price
      } else {
        // Default assumption for price mentions
        context.maxPrice = price
      }
    }
  }

  // Debug logging for this specific query issue
  console.log('NLP Analysis Debug:', {
    originalQuery: analysis.keywords.join(' '),
    extractedLocation: analysis.entities.places[0],
    allPlaces: analysis.entities.places,
    context
  })

  return context
}

// Enhanced context update using NLP analysis
export const updateSearchContextFromNLP = (
  existing: SearchContext, 
  analysis: QueryAnalysis
): SearchContext => {
  const updated = { ...existing }

  // Update guest info from NLP
  if (analysis.guestInfo.hasGroupInfo) {
    if (analysis.guestInfo.adults !== null) {
      updated.adults = analysis.guestInfo.adults
    }
    if (analysis.guestInfo.children !== null) {
      updated.children = analysis.guestInfo.children
    }
  }

  // Update location if new one found
  if (analysis.entities.places.length > 0) {
    updated.location = analysis.entities.places[0]
  }

  // Update budget if found
  if (analysis.entities.money.length > 0) {
    const moneyStr = analysis.entities.money[0]
    const priceMatch = moneyStr.match(/\$?(\d+)/)
    if (priceMatch) {
      updated.maxPrice = parseInt(priceMatch[1])
    }
  }

  return updated
}

