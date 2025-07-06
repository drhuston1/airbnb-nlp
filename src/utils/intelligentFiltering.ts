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
    totalListings: listings.length
  })

  // 1. Apply group size filtering based on NLP analysis
  if (analysis.guestInfo.hasGroupInfo && analysis.guestInfo.totalGuests) {
    filtered = applyGroupSizeFiltering(filtered, analysis.guestInfo)
  }

  // 2. Apply property requirements filtering
  if (analysis.propertyNeeds.minBedrooms || analysis.propertyNeeds.amenities.length > 0) {
    filtered = applyPropertyFiltering(filtered, analysis.propertyNeeds)
  }

  // 3. Apply rating/review preferences from intents
  if (analysis.intents.includes('filter')) {
    filtered = applyQualityFiltering(filtered, analysis)
  }

  // 4. Apply sorting based on priorities and keywords
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

  // Filter by amenities using the property's actual amenities array
  if (propertyNeeds.amenities.length > 0) {
    for (const requiredAmenity of propertyNeeds.amenities) {
      const amenityResults = filtered.filter(listing => 
        listing.amenities.some(amenity => 
          amenity.toLowerCase().includes(requiredAmenity.toLowerCase().replace('_', ' '))
        ) ||
        listing.name.toLowerCase().includes(requiredAmenity.toLowerCase().replace('_', ' '))
      )

      if (amenityResults.length > 0) {
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
        console.log(`No exact ${requiredAmenity} matches, sorted by relevance`)
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

function applyQualityFiltering(listings: AirbnbListing[], analysis: QueryAnalysis): AirbnbListing[] {
  let filtered = listings

  // Apply superhost filtering if detected
  if (analysis.keywords.includes('superhost')) {
    const superhostResults = filtered.filter(listing => listing.host.isSuperhost)
    if (superhostResults.length > 0) {
      filtered = superhostResults
      console.log(`Applied superhost filter: ${filtered.length} results`)
    } else {
      // Sort superhosts to top if no filter results
      filtered = filtered.sort((a, b) => {
        if (a.host.isSuperhost && !b.host.isSuperhost) return -1
        if (!a.host.isSuperhost && b.host.isSuperhost) return 1
        return b.rating - a.rating
      })
    }
  }

  // Apply rating filters if high ratings are mentioned
  if (analysis.keywords.some(k => ['rated', 'rating', 'quality'].includes(k.toLowerCase()))) {
    const highRatedResults = filtered.filter(listing => listing.rating >= 4.5)
    if (highRatedResults.length > 0) {
      filtered = highRatedResults
      console.log(`Applied high rating filter: ${filtered.length} results`)
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