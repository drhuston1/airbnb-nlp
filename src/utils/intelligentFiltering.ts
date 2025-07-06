import type { AirbnbListing, SearchContext } from '../types'
import type { QueryAnalysis } from './nlpAnalysis'

/**
 * Intelligent filtering using NLP analysis instead of hardcoded patterns
 * This replaces all the hardcoded filtering logic with a generalized NLP approach
 */
export const applyIntelligentFilters = (
  listings: AirbnbListing[], 
  analysis: QueryAnalysis,
  _context?: SearchContext | null
): AirbnbListing[] => {
  let filtered = [...listings]

  console.log('Applying intelligent filters based on NLP analysis:', {
    guestInfo: analysis.guestInfo,
    propertyNeeds: analysis.propertyNeeds,
    reviewRequirements: analysis.reviewRequirements,
    keywords: analysis.keywords,
    totalListings: listings.length
  })

  // Apply filters conservatively - each filter must leave at least 1 result
  const originalCount = filtered.length

  // 1. Apply group size filtering based on NLP analysis
  if (analysis.guestInfo.hasGroupInfo && analysis.guestInfo.totalGuests) {
    const groupFiltered = applyGroupSizeFiltering(filtered, analysis.guestInfo)
    if (groupFiltered.length > 0) {
      filtered = groupFiltered
      console.log(`Group size filter applied: ${originalCount} → ${filtered.length}`)
    } else {
      console.log(`Group size filter skipped - would eliminate all results`)
    }
  }

  // 2. Apply property requirements filtering (only if we have enough results)
  if (analysis.propertyNeeds.minBedrooms || analysis.propertyNeeds.amenities.length > 0) {
    const propertyFiltered = applyPropertyFiltering(filtered, analysis.propertyNeeds)
    if (propertyFiltered.length >= Math.max(1, filtered.length * 0.1)) { // Keep at least 10% or 1
      filtered = propertyFiltered
      console.log(`Property filter applied: ${filtered.length} results remain`)
    } else {
      console.log(`Property filter skipped - would leave only ${propertyFiltered.length} results`)
      // Apply sorting instead of filtering
      filtered = applyPropertySorting(filtered, analysis.propertyNeeds)
    }
  }

  // 3. Apply review and rating requirements (very conservative)
  if (analysis.reviewRequirements.minReviews || analysis.reviewRequirements.minRating || analysis.reviewRequirements.qualityKeywords.length > 0) {
    const reviewFiltered = applyReviewFiltering(filtered, analysis.reviewRequirements)
    if (reviewFiltered.length >= Math.max(1, filtered.length * 0.2)) { // Keep at least 20% or 1
      filtered = reviewFiltered
      console.log(`Review filter applied: ${filtered.length} results remain`)
    } else {
      console.log(`Review filter skipped - would leave only ${reviewFiltered.length} results, sorting instead`)
      // Just sort by reviews/rating instead
      filtered = filtered.sort((a, b) => {
        if (analysis.reviewRequirements.minReviews) {
          return b.reviewsCount - a.reviewsCount
        }
        return b.rating - a.rating
      })
    }
  }

  // 4. Skip superhost filtering - too restrictive for most searches

  // 5. Apply sorting based on priorities and keywords
  filtered = applySorting(filtered, analysis)

  console.log('Final intelligent filtering result:', filtered.length)
  return filtered
}

function applyGroupSizeFiltering(listings: AirbnbListing[], guestInfo: any): AirbnbListing[] {
  const { totalGuests } = guestInfo

  if (!totalGuests) return listings

  console.log(`Filtering for ${totalGuests} guests`)

  // For groups of 4+, filter out inadequate properties
  if (totalGuests >= 4) {
    const adequateListings = listings.filter(listing => {
      const roomType = listing.roomType.toLowerCase()
      const name = listing.name.toLowerCase()
      
      // Filter out clearly inadequate options
      const isInadequate = 
        roomType.includes('1 bed') ||
        roomType.includes('studio') ||
        name.includes('studio') ||
        (roomType.includes('private room') && !name.includes('house'))
      
      return !isInadequate
    })

    if (adequateListings.length > 0) {
      console.log(`Filtered out inadequate properties: ${listings.length} → ${adequateListings.length}`)
      return adequateListings
    } else {
      // If no adequate results, sort by estimated capacity
      return listings.sort((a, b) => {
        const aCapacity = estimateCapacity(a.roomType, a.name)
        const bCapacity = estimateCapacity(b.roomType, b.name)
        if (aCapacity !== bCapacity) return bCapacity - aCapacity
        return b.rating - a.rating
      })
    }
  }

  return listings
}

function applyPropertyFiltering(listings: AirbnbListing[], propertyNeeds: any): AirbnbListing[] {
  let filtered = listings

  // Filter by amenities using the property's actual amenities array (VERY LENIENT)
  if (propertyNeeds.amenities.length > 0) {
    for (const requiredAmenity of propertyNeeds.amenities) {
      const amenityResults = filtered.filter(listing => 
        listing.amenities.some(amenity => 
          amenity.toLowerCase().includes(requiredAmenity.toLowerCase().replace('_', ' '))
        ) ||
        listing.name.toLowerCase().includes(requiredAmenity.toLowerCase().replace('_', ' '))
      )

      // Only apply filter if we get a reasonable number of results (at least 20% or minimum 2)
      if (amenityResults.length >= Math.max(2, filtered.length * 0.2)) {
        filtered = amenityResults
        console.log(`Applied ${requiredAmenity} filter: ${filtered.length} results`)
      } else {
        // Sort by amenity relevance instead of filtering to zero
        filtered = filtered.sort((a, b) => {
          const aHasAmenity = a.amenities.some(amenity => 
            amenity.toLowerCase().includes(requiredAmenity.toLowerCase().replace('_', ' '))
          ) || a.name.toLowerCase().includes(requiredAmenity.toLowerCase().replace('_', ' '))
          const bHasAmenity = b.amenities.some(amenity => 
            amenity.toLowerCase().includes(requiredAmenity.toLowerCase().replace('_', ' '))
          ) || b.name.toLowerCase().includes(requiredAmenity.toLowerCase().replace('_', ' '))
          
          if (aHasAmenity && !bHasAmenity) return -1
          if (!aHasAmenity && bHasAmenity) return 1
          return b.rating - a.rating
        })
        console.log(`Too few exact ${requiredAmenity} matches (${amenityResults.length}), sorted by relevance instead`)
      }
      break // Apply one primary amenity filter
    }
  }

  // Filter by property type if specified
  if (propertyNeeds.propertyType) {
    const typeResults = filtered.filter(listing => {
      const name = listing.name.toLowerCase()
      const roomType = listing.roomType.toLowerCase()
      const type = propertyNeeds.propertyType.toLowerCase()
      
      return name.includes(type) || roomType.includes(type)
    })

    if (typeResults.length > 0) {
      filtered = typeResults
      console.log(`Applied ${propertyNeeds.propertyType} filter: ${filtered.length} results`)
    }
  }

  return filtered
}


function applyPropertySorting(listings: AirbnbListing[], propertyNeeds: QueryAnalysis['propertyNeeds']): AirbnbListing[] {
  return listings.sort((a, b) => {
    // Sort by amenity relevance
    if (propertyNeeds.amenities.length > 0) {
      const aRelevance = propertyNeeds.amenities.reduce((score, amenity) => {
        if (a.amenities.some(listingAmenity => 
          listingAmenity.toLowerCase().includes(amenity.toLowerCase().replace('_', ' '))) ||
          a.name.toLowerCase().includes(amenity.toLowerCase().replace('_', ' '))) {
          return score + 1
        }
        return score
      }, 0)
      
      const bRelevance = propertyNeeds.amenities.reduce((score, amenity) => {
        if (b.amenities.some(listingAmenity => 
          listingAmenity.toLowerCase().includes(amenity.toLowerCase().replace('_', ' '))) ||
          b.name.toLowerCase().includes(amenity.toLowerCase().replace('_', ' '))) {
          return score + 1
        }
        return score
      }, 0)
      
      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance
      }
    }
    
    // Secondary sort by rating
    return b.rating - a.rating
  })
}

function applyReviewFiltering(listings: AirbnbListing[], reviewReqs: QueryAnalysis['reviewRequirements']): AirbnbListing[] {
  let filtered = listings

  // Apply minimum review count filter (lenient)
  if (reviewReqs.minReviews) {
    const reviewResults = filtered.filter(listing => listing.reviewsCount >= reviewReqs.minReviews!)
    if (reviewResults.length >= Math.max(1, filtered.length * 0.3)) { // Keep at least 30% of results
      filtered = reviewResults
      console.log(`Applied review count filter (≥${reviewReqs.minReviews} reviews): ${filtered.length} results`)
    } else {
      // Sort by review count instead of hard filtering
      filtered = filtered.sort((a, b) => b.reviewsCount - a.reviewsCount)
      console.log(`Too few results with ≥${reviewReqs.minReviews} reviews, sorted by review count instead`)
    }
  }

  // Apply rating requirements (very lenient for "highest rating")
  if (reviewReqs.qualityKeywords.includes('highest_rating')) {
    // Just sort by rating, don't filter
    filtered = filtered.sort((a, b) => b.rating - a.rating)
    console.log('Applied highest rating sort')
  } else if (reviewReqs.minRating) {
    const ratingResults = filtered.filter(listing => listing.rating >= reviewReqs.minRating!)
    if (ratingResults.length >= Math.max(1, filtered.length * 0.4)) { // Keep at least 40% of results
      filtered = ratingResults
      console.log(`Applied rating filter (≥${reviewReqs.minRating}): ${filtered.length} results`)
    } else {
      filtered = filtered.sort((a, b) => b.rating - a.rating)
      console.log(`Too few results with ≥${reviewReqs.minRating} rating, sorted by rating instead`)
    }
  }

  return filtered
}

function applySorting(listings: AirbnbListing[], analysis: QueryAnalysis): AirbnbListing[] {
  // Determine sorting priority based on keywords and sentiment
  const keywords = analysis.keywords.map(k => k.toLowerCase())
  
  // Price-based sorting
  if (keywords.some(k => ['luxury', 'expensive', 'premium'].includes(k))) {
    return listings.sort((a, b) => {
      const priceSort = b.price.rate - a.price.rate
      const ratingSort = b.rating - a.rating
      return priceSort * 0.7 + ratingSort * 0.3
    })
  }
  
  if (keywords.some(k => ['budget', 'cheap', 'affordable'].includes(k))) {
    return listings.sort((a, b) => a.price.rate - b.price.rate)
  }

  // Quality-based sorting
  if (keywords.some(k => ['rated', 'quality', 'best'].includes(k))) {
    return listings.sort((a, b) => b.rating - a.rating)
  }

  // Default sorting: balance of rating and superhost status
  return listings.sort((a, b) => {
    if (a.host.isSuperhost && !b.host.isSuperhost) return -1
    if (!a.host.isSuperhost && b.host.isSuperhost) return 1
    return b.rating - a.rating
  })
}

function estimateCapacity(roomType: string, name: string): number {
  const text = (roomType + ' ' + name).toLowerCase()
  
  // Extract bed count
  const bedMatch = text.match(/(\d+)\s+(?:king|queen|double|full|twin)?\s*beds?/)
  if (bedMatch) {
    const beds = parseInt(bedMatch[1])
    return beds * 2 // Assume 2 people per bed
  }
  
  // Room type capacity estimates
  if (text.includes('studio')) return 2
  if (text.includes('1 bed')) return 2
  if (text.includes('2 bed')) return 4
  if (text.includes('3 bed')) return 6
  if (text.includes('4 bed')) return 8
  if (text.includes('entire')) return 4 // Default for entire places
  if (text.includes('private room')) return 2
  
  return 3 // Default estimate
}