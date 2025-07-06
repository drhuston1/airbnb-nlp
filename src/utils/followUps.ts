import type { AirbnbListing } from '../types'
import type { QueryAnalysis } from './nlpAnalysis'

// Generate contextual follow-up suggestions based on search results and NLP analysis
export const generateFollowUps = (listings: AirbnbListing[], _originalQuery: string, analysis?: QueryAnalysis): string[] => {
  const followUps: string[] = []

  if (listings.length === 0) {
    return ["Try a different location", "Expand your search criteria", "Search for nearby areas"]
  }

  // Use NLP analysis to generate intelligent follow-ups
  if (analysis) {
    // Price-based suggestions from NLP analysis
    const prices = listings.map(l => l.price.rate)
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
    
    if (!analysis.entities.money.length && avgPrice > 150) {
      followUps.push(`Show options under $${Math.round(avgPrice * 0.8)}`)
    }

    // Property type suggestions based on available amenities
    if (analysis.propertyNeeds.amenities.length === 0) {
      const availableAmenities = ['pool', 'parking', 'kitchen', 'beach']
      availableAmenities.forEach(amenity => {
        if (listings.some(l => l.amenities.some(a => a.toLowerCase().includes(amenity)) || 
                               l.name.toLowerCase().includes(amenity))) {
          followUps.push(`Show only properties with ${amenity}`)
        }
      })
    }

    // Group size suggestions
    if (analysis.guestInfo.totalGuests && analysis.guestInfo.totalGuests >= 4) {
      if (!analysis.propertyNeeds.minBedrooms) {
        followUps.push("Show only 3+ bedroom properties")
      }
    }

    // Quality suggestions
    if (!analysis.keywords.includes('superhost') && listings.some(l => l.host.isSuperhost)) {
      followUps.push("Show only superhosts")
    }

    // Completeness suggestions from NLP
    if (analysis.suggestions.length > 0) {
      followUps.push(...analysis.suggestions.slice(0, 1))
    }
  } else {
    // Fallback to basic suggestions if no NLP analysis
    followUps.push("Show budget options", "Show luxury properties", "Show only superhosts")
  }

  // Remove duplicates and return top suggestions
  return [...new Set(followUps)].slice(0, 4)
}