import type { AirbnbListing, SearchContext } from '../types'

// Apply natural language filters to listings (more lenient)
export const applyNaturalLanguageFilters = (
  listings: AirbnbListing[], 
  query: string, 
  context?: SearchContext | null
): AirbnbListing[] => {
  const lowerQuery = query.toLowerCase()
  let filtered = [...listings]

  console.log('Original listings:', listings.length)
  console.log('Query:', query)

  // Rating & Review Filters - only apply superhost filter if "only" is specified
  if ((lowerQuery.includes('superhost') || lowerQuery.includes('super host')) && lowerQuery.includes('only')) {
    const superhostResults = filtered.filter(listing => listing.host.isSuperhost)
    if (superhostResults.length > 0) {
      filtered = superhostResults
      console.log('After superhost only filter:', filtered.length)
    } else {
      console.log('No superhosts found, keeping all results and sorting superhosts first')
      // Sort superhosts to the top instead of filtering
      filtered = filtered.sort((a, b) => {
        if (a.host.isSuperhost && !b.host.isSuperhost) return -1
        if (!a.host.isSuperhost && b.host.isSuperhost) return 1
        return b.rating - a.rating // Then by rating
      })
    }
  } else if (lowerQuery.includes('superhost') || lowerQuery.includes('super host')) {
    // Just sort superhosts to the top without filtering
    filtered = filtered.sort((a, b) => {
      if (a.host.isSuperhost && !b.host.isSuperhost) return -1
      if (!a.host.isSuperhost && b.host.isSuperhost) return 1
      return b.rating - a.rating
    })
    console.log('Sorted superhosts to top without filtering')
  }
  
  if (lowerQuery.includes('high rated') || lowerQuery.includes('highly rated')) {
    filtered = filtered.filter(listing => listing.rating >= 4.5)
    console.log('After high rated filter:', filtered.length)
  }
  
  // Review count filters - handle specific numbers and general terms
  const reviewPatterns = [
    /(?:at least|minimum|min)\s+(\d+)\s+reviews?/i,
    /(\d+)\+?\s+reviews?/i,
    /over\s+(\d+)\s+reviews?/i,
    /more than\s+(\d+)\s+reviews?/i
  ]
  
  let reviewFilterApplied = false
  for (const pattern of reviewPatterns) {
    const match = lowerQuery.match(pattern)
    if (match && match[1]) {
      const minReviews = parseInt(match[1])
      const reviewResults = filtered.filter(listing => listing.reviewsCount >= minReviews)
      if (reviewResults.length > 0) {
        filtered = reviewResults
        console.log(`After review count filter (≥${minReviews} reviews):`, filtered.length)
      } else {
        console.log(`No properties found with ≥${minReviews} reviews, sorting by review count instead`)
        filtered = filtered.sort((a, b) => b.reviewsCount - a.reviewsCount)
      }
      reviewFilterApplied = true
      break
    }
  }
  
  // General review filters (only apply if no specific number was found)
  if (!reviewFilterApplied) {
    if (lowerQuery.includes('well reviewed') || lowerQuery.includes('lots of reviews')) {
      filtered = filtered.filter(listing => listing.reviewsCount >= 20)
      console.log('After well reviewed filter:', filtered.length)
    }
    
    if (lowerQuery.includes('new listing') || lowerQuery.includes('recently added')) {
      filtered = filtered.filter(listing => listing.reviewsCount < 5)
      console.log('After new listing filter:', filtered.length)
    }
  }

  // Check for rating thresholds - be very lenient and avoid filtering to zero
  const ratingMatch = lowerQuery.match(/(\d\.?\d?)\+?\s*rating|rating\s*(\d\.?\d?)\+?/)
  if (ratingMatch) {
    const minRating = parseFloat(ratingMatch[1] || ratingMatch[2])
    if (minRating && minRating >= 3 && minRating <= 5) {
      // Be very lenient - subtract 0.5 from the requirement
      const lenientRating = Math.max(3.0, minRating - 0.5)
      const ratingResults = filtered.filter(listing => listing.rating >= lenientRating)
      if (ratingResults.length > 0) {
        filtered = ratingResults
        console.log(`After rating filter (${minRating} -> ${lenientRating}):`, filtered.length)
      } else {
        console.log(`No properties found with ${lenientRating}+ rating, just sorting by rating instead`)
        // If no results, just sort by rating instead of filtering
        filtered = filtered.sort((a, b) => b.rating - a.rating)
      }
    }
  }

  // Price Range Filters - handle both nightly and total budget constraints
  const pricePatterns = [
    // Total budget patterns
    /(?:no\s+more\s+than|under|less\s+than|max(?:imum)?|limit)\s*\$?(\d+)k?\s+total/i,
    /(?:don't|don't|do\s+not)\s+(?:want\s+to\s+)?spend\s+(?:more\s+than\s+)?\$?(\d+)k?(?:\s+total)?/i,
    // Nightly rate patterns  
    /under\s*\$?(\d+)k?\s*(?:per\s+night|\/night|nightly)/i,
    /below\s*\$?(\d+)k?\s*(?:per\s+night|\/night|nightly)/i,
    // Generic under/below (assume nightly unless "total" specified)
    /(?:^|\s)under\s*\$?(\d+)k?(?!\s+total)/i,
    /(?:^|\s)below\s*\$?(\d+)k?(?!\s+total)/i
  ]
  
  for (const pattern of pricePatterns) {
    const match = lowerQuery.match(pattern)
    if (match && match[1]) {
      let maxPrice = parseInt(match[1])
      
      // Handle 'k' suffix (5k = 5000)
      if (lowerQuery.includes(match[1] + 'k')) {
        maxPrice *= 1000
      }
      
      // Determine if this is a total budget or nightly rate constraint
      const isTotal = /total|spend|don't|don't/.test(pattern.source) || lowerQuery.includes('total')
      const isNightly = /night|nightly/.test(pattern.source)
      
      console.log(`Price constraint: $${maxPrice} ${isTotal ? 'total' : isNightly ? 'per night' : 'per night (assumed)'}`)
      
      let priceResults
      if (isTotal) {
        // For total budget, use nights from search context or extract from current query
        let nights = context?.nights || 5 // default to 5 if not found
        
        // Try to get nights from current query first
        const nightsMatch = lowerQuery.match(/(\d+)\s+nights?/i)
        if (nightsMatch) {
          nights = parseInt(nightsMatch[1])
        }
        
        const maxNightlyRate = Math.floor(maxPrice / nights)
        console.log(`Total budget $${maxPrice} / ${nights} nights = max $${maxNightlyRate}/night`)
        priceResults = filtered.filter(listing => listing.price.rate <= maxNightlyRate)
      } else {
        // For nightly rate constraint
        priceResults = filtered.filter(listing => listing.price.rate <= maxPrice)
      }
      
      if (priceResults.length > 0) {
        filtered = priceResults
        console.log(`After price filter (${isTotal ? 'total' : 'nightly'} $${maxPrice}):`, filtered.length)
      } else {
        console.log(`No properties found within budget, sorting by price instead`)
        filtered = filtered.sort((a, b) => a.price.rate - b.price.rate)
      }
      break
    }
  }

  // Property type filters - only apply strong filters, sort for weak ones
  if (lowerQuery.includes('entire house') || lowerQuery.includes('entire home') || lowerQuery.includes('whole house')) {
    const entireResults = filtered.filter(l => l.roomType.toLowerCase().includes('entire'))
    if (entireResults.length > 0) {
      filtered = entireResults
      console.log('After entire house filter:', filtered.length)
    } else {
      console.log('No entire houses found, keeping all results')
    }
  } else if (lowerQuery.includes('private room') || lowerQuery.includes('private bedroom')) {
    const privateResults = filtered.filter(l => l.roomType.toLowerCase().includes('private'))
    if (privateResults.length > 0) {
      filtered = privateResults
      console.log('After private room filter:', filtered.length)
    } else {
      console.log('No private rooms found, keeping all results')
    }
  } else if (lowerQuery.includes('shared room') || lowerQuery.includes('shared space')) {
    const sharedResults = filtered.filter(l => l.roomType.toLowerCase().includes('shared'))
    if (sharedResults.length > 0) {
      filtered = sharedResults
      console.log('After shared room filter:', filtered.length)
    } else {
      console.log('No shared rooms found, keeping all results')
    }
  }

  // For other property types, prefer sorting over filtering
  if (lowerQuery.includes('studio')) {
    const studioResults = filtered.filter(l => /studio/i.test(l.name))
    if (studioResults.length >= filtered.length * 0.1) { // Only filter if at least 10% match
      filtered = studioResults
      console.log('After studio filter:', filtered.length)
    } else {
      // Sort studios to top instead of filtering
      filtered = filtered.sort((a, b) => {
        const aStudio = /studio/i.test(a.name) ? 1 : 0
        const bStudio = /studio/i.test(b.name) ? 1 : 0
        return bStudio - aStudio
      })
      console.log('Sorted studios to top')
    }
  }

  // Simplified filtering - only apply filters that are likely to work well
  // Most other filters will use sorting instead of hard filtering
  
  // Only filter on amenities that are commonly mentioned in titles
  if (lowerQuery.includes('pool') || lowerQuery.includes('swimming pool')) {
    const poolResults = filtered.filter(l => /pool|swimming/i.test(l.name))
    if (poolResults.length >= Math.max(1, filtered.length * 0.1)) { // Only if at least 10% or 1+ results
      filtered = poolResults
      console.log('After pool filter:', filtered.length)
    } else {
      console.log('Not enough pool properties, keeping all results')
    }
  }

  // For most other requests, use smart sorting instead of hard filtering
  const sortingKeywords = [
    { keywords: ['luxury', 'luxurious', 'upscale'], sort: (a: AirbnbListing, b: AirbnbListing) => b.price.rate - a.price.rate },
    { keywords: ['budget', 'cheap', 'affordable'], sort: (a: AirbnbListing, b: AirbnbListing) => a.price.rate - b.price.rate },
    { keywords: ['modern', 'contemporary'], sort: (a: AirbnbListing, b: AirbnbListing) => b.rating - a.rating }, // Sort by rating as proxy
    { keywords: ['cozy', 'charming'], sort: (a: AirbnbListing, b: AirbnbListing) => b.rating - a.rating },
    { keywords: ['beachfront', 'beach', 'oceanfront'], sort: (a: AirbnbListing, b: AirbnbListing) => {
      const aBeach = /beach|ocean/i.test(a.name) ? 1 : 0
      const bBeach = /beach|ocean/i.test(b.name) ? 1 : 0
      return bBeach - aBeach || b.rating - a.rating
    }},
    { keywords: ['downtown', 'city center'], sort: (a: AirbnbListing, b: AirbnbListing) => {
      const aCenter = /downtown|center|central/i.test(a.name) ? 1 : 0
      const bCenter = /downtown|center|central/i.test(b.name) ? 1 : 0
      return bCenter - aCenter || b.rating - a.rating
    }}
  ]

  for (const { keywords, sort } of sortingKeywords) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      filtered = filtered.sort(sort)
      console.log(`Sorted by ${keywords[0]} preference`)
      break
    }
  }

  // Sorting options - comprehensive sorting support
  const sortingPatterns = [
    { keywords: ['cheapest first', 'lowest price first', 'sort by price', 'price low to high'], 
      sort: (a: AirbnbListing, b: AirbnbListing) => a.price.rate - b.price.rate, name: 'price (low to high)' },
    { keywords: ['most expensive first', 'highest price first', 'price high to low'], 
      sort: (a: AirbnbListing, b: AirbnbListing) => b.price.rate - a.price.rate, name: 'price (high to low)' },
    { keywords: ['highest rated', 'best rated', 'top rated', 'sort by rating'], 
      sort: (a: AirbnbListing, b: AirbnbListing) => b.rating - a.rating, name: 'rating (high to low)' },
    { keywords: ['most reviews', 'most reviewed', 'sort by reviews'], 
      sort: (a: AirbnbListing, b: AirbnbListing) => b.reviewsCount - a.reviewsCount, name: 'review count (high to low)' },
    { keywords: ['newest first', 'recently added'], 
      sort: (a: AirbnbListing, b: AirbnbListing) => a.reviewsCount - b.reviewsCount, name: 'newest listings first' },
    { keywords: ['luxury', 'most luxurious'], 
      sort: (a: AirbnbListing, b: AirbnbListing) => {
        const priceSort = b.price.rate - a.price.rate
        const ratingSort = b.rating - a.rating
        return priceSort * 0.7 + ratingSort * 0.3 // Weight price more heavily for luxury
      }, name: 'luxury criteria' }
  ]

  for (const { keywords, sort, name } of sortingPatterns) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      filtered = filtered.sort(sort)
      console.log(`Sorted by ${name}`)
      break
    }
  }

  // Budget/size preferences
  if (lowerQuery.includes('show cheaper') || lowerQuery.includes('budget options') || lowerQuery.includes('cheaper alternatives')) {
    filtered = filtered.sort((a, b) => a.price.rate - b.price.rate)
    console.log('Sorted by budget options (cheapest first)')
  }

  if (lowerQuery.includes('show premium') || lowerQuery.includes('premium only') || lowerQuery.includes('high end only')) {
    filtered = filtered.filter(listing => listing.price.rate > 200).sort((a, b) => b.price.rate - a.price.rate)
    console.log('Filtered and sorted premium options')
  }

  if (lowerQuery.includes('larger places') || lowerQuery.includes('bigger properties') || lowerQuery.includes('more space')) {
    const largerResults = filtered.filter(listing => /\d+\s*bed/i.test(listing.name) && !/1\s*bed/i.test(listing.name))
    if (largerResults.length > 0) {
      filtered = largerResults
      console.log('After larger properties filter:', filtered.length)
    } else {
      console.log('No larger properties found, keeping all results')
    }
  }

  if (lowerQuery.includes('smaller') || lowerQuery.includes('compact') || lowerQuery.includes('cozy size')) {
    const smallerResults = filtered.filter(listing => /studio|1\s*bed|small|compact/i.test(listing.name))
    if (smallerResults.length > 0) {
      filtered = smallerResults
      console.log('After smaller properties filter:', filtered.length)
    } else {
      console.log('No smaller properties found, keeping all results')
    }
  }

  console.log('Final filtered count:', filtered.length)
  return filtered
}