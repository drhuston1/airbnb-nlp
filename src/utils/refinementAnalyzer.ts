// Intelligent refinement analysis utilities
import { SEARCH_CONFIG, FILTER_CONFIG } from '../config/constants'
import type { AirbnbListing } from '../types'

interface PriceInsights {
  min: number
  max: number
  median: number
  average: number
  quartiles: {
    q1: number
    q2: number
    q3: number
  }
  suggestedRanges: Array<{
    label: string
    min: number
    max: number
    count: number
  }>
}

interface RatingInsights {
  average: number
  distribution: {
    excellent: number // 4.8+
    veryGood: number // 4.5-4.79
    good: number // 4.0-4.49
    fair: number // below 4.0
  }
  superhostCount: number
  superhostPercentage: number
}

interface AmenityInsights {
  popular: Array<{
    amenity: string
    count: number
    percentage: number
  }>
  categories: {
    essentials: string[]
    comfort: string[]
    convenience: string[]
    outdoor: string[]
    family: string[]
  }
}

interface PropertyTypeInsights {
  types: Array<{
    type: string
    count: number
    percentage: number
    avgPrice: number
    avgRating: number
  }>
}

interface RefinementSuggestion {
  type: 'price' | 'rating' | 'amenity' | 'property_type' | 'host_type'
  label: string
  description: string
  query: string
  count: number
  priority: 'high' | 'medium' | 'low'
}

export class RefinementAnalyzer {
  private listings: AirbnbListing[]
  
  constructor(listings: AirbnbListing[]) {
    this.listings = listings
  }

  // Analyze price distribution and suggest ranges
  analyzePrices(): PriceInsights {
    const prices = this.listings.map(l => l.price.rate).sort((a, b) => a - b)
    
    if (prices.length === 0) {
      return {
        min: 0, max: 0, median: 0, average: 0,
        quartiles: { q1: 0, q2: 0, q3: 0 },
        suggestedRanges: []
      }
    }

    const min = prices[0]
    const max = prices[prices.length - 1]
    const median = this.calculateMedian(prices)
    const average = prices.reduce((sum, p) => sum + p, 0) / prices.length

    const q1Index = Math.floor(prices.length * FILTER_CONFIG.QUARTILE_Q1)
    const q3Index = Math.floor(prices.length * FILTER_CONFIG.QUARTILE_Q3)
    
    const quartiles = {
      q1: prices[q1Index],
      q2: median,
      q3: prices[q3Index]
    }

    // Generate intelligent price range suggestions
    const suggestedRanges = this.generatePriceRanges(prices, min, max, quartiles)

    return {
      min, max, median, average, quartiles, suggestedRanges
    }
  }

  // Analyze ratings and host quality
  analyzeRatings(): RatingInsights {
    const ratings = this.listings.map(l => l.rating)
    const average = ratings.reduce((sum, r) => sum + r, 0) / ratings.length

    const distribution = {
      excellent: ratings.filter(r => r >= 4.8).length,
      veryGood: ratings.filter(r => r >= 4.5 && r < 4.8).length,
      good: ratings.filter(r => r >= 4.0 && r < 4.5).length,
      fair: ratings.filter(r => r < 4.0).length
    }

    const superhostCount = this.listings.filter(l => l.host.isSuperhost).length
    const superhostPercentage = (superhostCount / this.listings.length) * 100

    return {
      average,
      distribution,
      superhostCount,
      superhostPercentage
    }
  }

  // Analyze amenities and suggest popular ones
  analyzeAmenities(): AmenityInsights {
    const amenityCount = new Map<string, number>()
    
    this.listings.forEach(listing => {
      listing.amenities.forEach(amenity => {
        amenityCount.set(amenity, (amenityCount.get(amenity) || 0) + 1)
      })
    })

    const popular = Array.from(amenityCount.entries())
      .map(([amenity, count]) => ({
        amenity,
        count,
        percentage: (count / this.listings.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, FILTER_CONFIG.MAX_POPULAR_AMENITIES)

    // Categorize amenities
    const categories = this.categorizeAmenities(popular.map(p => p.amenity))

    return { popular, categories }
  }

  // Analyze property types
  analyzePropertyTypes(): PropertyTypeInsights {
    const typeMap = new Map<string, AirbnbListing[]>()
    
    this.listings.forEach(listing => {
      const type = listing.roomType
      if (!typeMap.has(type)) {
        typeMap.set(type, [])
      }
      typeMap.get(type)!.push(listing)
    })

    const types = Array.from(typeMap.entries()).map(([type, listings]) => ({
      type,
      count: listings.length,
      percentage: (listings.length / this.listings.length) * 100,
      avgPrice: listings.reduce((sum, l) => sum + l.price.rate, 0) / listings.length,
      avgRating: listings.reduce((sum, l) => sum + l.rating, 0) / listings.length
    }))

    return { types }
  }

  // Generate intelligent refinement suggestions
  generateRefinementSuggestions(originalQuery: string): RefinementSuggestion[] {
    const suggestions: RefinementSuggestion[] = []
    
    const priceInsights = this.analyzePrices()
    const ratingInsights = this.analyzeRatings()
    const amenityInsights = this.analyzeAmenities()
    const propertyInsights = this.analyzePropertyTypes()

    // Price-based suggestions
    priceInsights.suggestedRanges.forEach(range => {
      if (range.count > FILTER_CONFIG.MIN_SUGGESTION_COUNT) { // Only suggest if there are enough properties
        suggestions.push({
          type: 'price',
          label: range.label,
          description: `${range.count} properties in this range`,
          query: `${originalQuery} under $${range.max}/night`,
          count: range.count,
          priority: range.count > this.listings.length * SEARCH_CONFIG.HIGH_PRIORITY_THRESHOLD ? 'high' : 'medium'
        })
      }
    })

    // Rating-based suggestions
    if (ratingInsights.distribution.excellent > 0) {
      suggestions.push({
        type: 'rating',
        label: 'Excellent ratings only',
        description: `${ratingInsights.distribution.excellent} properties with 4.8+ rating`,
        query: `${originalQuery} with excellent reviews`,
        count: ratingInsights.distribution.excellent,
        priority: 'high'
      })
    }

    // Superhost suggestion
    if (ratingInsights.superhostCount > 0) {
      suggestions.push({
        type: 'host_type',
        label: 'Superhosts only',
        description: `${ratingInsights.superhostCount} superhost properties`,
        query: `${originalQuery} superhost only`,
        count: ratingInsights.superhostCount,
        priority: ratingInsights.superhostPercentage > SEARCH_CONFIG.SUPERHOST_HIGH_PRIORITY_THRESHOLD ? 'high' : 'medium'
      })
    }

    // Amenity-based suggestions (top 3 popular amenities)
    amenityInsights.popular.slice(0, FILTER_CONFIG.MAX_AMENITY_SUGGESTIONS).forEach(amenity => {
      if (amenity.percentage > SEARCH_CONFIG.POPULAR_AMENITY_THRESHOLD) { // Only suggest if reasonably common
        suggestions.push({
          type: 'amenity',
          label: `With ${amenity.amenity.toLowerCase()}`,
          description: `${amenity.count} properties have this amenity`,
          query: `${originalQuery} with ${amenity.amenity.toLowerCase()}`,
          count: amenity.count,
          priority: amenity.percentage > SEARCH_CONFIG.POPULAR_AMENITY_THRESHOLD ? 'high' : 'medium'
        })
      }
    })

    // Property type suggestions (if multiple types available)
    if (propertyInsights.types.length > 1) {
      propertyInsights.types
        .filter(type => type.count > FILTER_CONFIG.MIN_SUGGESTION_COUNT)
        .slice(0, FILTER_CONFIG.MAX_PROPERTY_TYPE_SUGGESTIONS)
        .forEach(type => {
          suggestions.push({
            type: 'property_type',
            label: `${type.type} only`,
            description: `${type.count} ${type.type.toLowerCase()} properties`,
            query: `${originalQuery} ${type.type.toLowerCase()} only`,
            count: type.count,
            priority: type.percentage > 40 ? 'high' : 'medium'
          })
        })
    }

    // Sort by priority and count
    return suggestions
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        }
        return b.count - a.count
      })
      .slice(0, SEARCH_CONFIG.MAX_REFINEMENT_SUGGESTIONS) // Return top suggestions
  }

  // Helper methods
  private calculateMedian(sortedNumbers: number[]): number {
    const mid = Math.floor(sortedNumbers.length / 2)
    return sortedNumbers.length % 2 === 0
      ? (sortedNumbers[mid - 1] + sortedNumbers[mid]) / 2
      : sortedNumbers[mid]
  }

  private generatePriceRanges(prices: number[], min: number, max: number, quartiles: any) {
    const ranges = []
    
    // Budget range (bottom 25%)
    if (quartiles.q1 > min) {
      ranges.push({
        label: 'Budget-friendly',
        min: min,
        max: quartiles.q1,
        count: prices.filter(p => p <= quartiles.q1).length
      })
    }

    // Mid-range (25% to 75%)
    if (quartiles.q3 > quartiles.q1) {
      ranges.push({
        label: 'Mid-range',
        min: quartiles.q1,
        max: quartiles.q3,
        count: prices.filter(p => p > quartiles.q1 && p <= quartiles.q3).length
      })
    }

    // Luxury range (top 25%)
    if (max > quartiles.q3) {
      ranges.push({
        label: 'Luxury',
        min: quartiles.q3,
        max: max,
        count: prices.filter(p => p > quartiles.q3).length
      })
    }

    return ranges
  }

  private categorizeAmenities(amenities: string[]): AmenityInsights['categories'] {
    const essentials = amenities.filter(a => 
      ['wifi', 'kitchen', 'air conditioning', 'heating', 'hot water'].some(e => 
        a.toLowerCase().includes(e.toLowerCase())
      )
    )

    const comfort = amenities.filter(a => 
      ['tv', 'fireplace', 'balcony', 'patio', 'hot tub', 'jacuzzi'].some(c => 
        a.toLowerCase().includes(c.toLowerCase())
      )
    )

    const convenience = amenities.filter(a => 
      ['parking', 'laundry', 'washer', 'dryer', 'elevator'].some(c => 
        a.toLowerCase().includes(c.toLowerCase())
      )
    )

    const outdoor = amenities.filter(a => 
      ['pool', 'garden', 'bbq', 'grill', 'beach access', 'lake access'].some(o => 
        a.toLowerCase().includes(o.toLowerCase())
      )
    )

    const family = amenities.filter(a => 
      ['crib', 'high chair', 'baby', 'kid', 'child', 'family'].some(f => 
        a.toLowerCase().includes(f.toLowerCase())
      )
    )

    return { essentials, comfort, convenience, outdoor, family }
  }
}

// Export for use in main app
export type { RefinementSuggestion, PriceInsights, RatingInsights, AmenityInsights, PropertyTypeInsights }