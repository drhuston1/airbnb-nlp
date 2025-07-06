import type { AirbnbListing } from '../types'

// Generate contextual follow-up suggestions based on search results
export const generateFollowUps = (listings: AirbnbListing[], originalQuery: string): string[] => {
  const followUps: string[] = []
  const lowerQuery = originalQuery.toLowerCase()

  if (listings.length === 0) {
    return ["Try a different location", "Expand your search criteria", "Search for nearby areas"]
  }

  // Price-based follow-ups
  const prices = listings.map(l => l.price.rate)
  const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)

  if (!lowerQuery.includes('under') && !lowerQuery.includes('below') && avgPrice > 150) {
    followUps.push(`Show options under $${Math.round(avgPrice * 0.8)}`)
  }
  if (!lowerQuery.includes('luxury') && maxPrice > 300) {
    followUps.push("Show only luxury properties")
  }
  if (!lowerQuery.includes('budget') && minPrice < 150) {
    followUps.push("Show only budget options")
  }

  // Rating-based follow-ups
  const ratings = listings.map(l => l.rating)
  const avgRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
  if (!lowerQuery.includes('superhost') && listings.some(l => l.host.isSuperhost)) {
    followUps.push("Show only superhosts")
  }
  if (!lowerQuery.includes('rated') && avgRating < 4.8) {
    followUps.push("Show only 4.8+ rated properties")
  }

  // Property type follow-ups
  const roomTypes = [...new Set(listings.map(l => l.roomType))]
  if (roomTypes.length > 1) {
    if (!lowerQuery.includes('entire') && roomTypes.some(rt => rt.toLowerCase().includes('entire'))) {
      followUps.push("Show only entire homes")
    }
    if (!lowerQuery.includes('private room') && roomTypes.some(rt => rt.toLowerCase().includes('private'))) {
      followUps.push("Show only private rooms")
    }
  }

  // Amenity-based follow-ups
  if (!lowerQuery.includes('pool') && listings.some(l => l.name.toLowerCase().includes('pool'))) {
    followUps.push("Show only properties with pool")
  }
  if (!lowerQuery.includes('kitchen') && listings.some(l => l.name.toLowerCase().includes('kitchen'))) {
    followUps.push("Show only properties with kitchen")
  }
  if (!lowerQuery.includes('parking') && listings.some(l => l.name.toLowerCase().includes('parking'))) {
    followUps.push("Show only properties with parking")
  }

  // Location-based follow-ups
  if (!lowerQuery.includes('beach') && listings.some(l => l.name.toLowerCase().includes('beach'))) {
    followUps.push("Show only beachfront properties")
  }
  if (!lowerQuery.includes('downtown') && !lowerQuery.includes('center') && 
      listings.some(l => l.name.toLowerCase().includes('center') || l.name.toLowerCase().includes('downtown'))) {
    followUps.push("Show only city center locations")
  }

  // Sorting follow-ups
  if (!lowerQuery.includes('highest') && !lowerQuery.includes('best rated') && !lowerQuery.includes('sort')) {
    followUps.push("Sort by highest rated first")
  }
  if (!lowerQuery.includes('cheapest') && !lowerQuery.includes('lowest price') && !lowerQuery.includes('sort')) {
    followUps.push("Sort by lowest price first")
  }
  if (!lowerQuery.includes('most reviews') && !lowerQuery.includes('sort')) {
    followUps.push("Sort by most reviewed first")
  }

  // Review count follow-ups
  const reviewCounts = listings.map(l => l.reviewsCount)
  const avgReviews = reviewCounts.reduce((sum, count) => sum + count, 0) / reviewCounts.length
  if (!lowerQuery.includes('well reviewed') && !lowerQuery.includes('reviews') && avgReviews > 20) {
    followUps.push("At least 50 reviews")
  }

  // Style and size follow-ups
  if (!lowerQuery.includes('luxury') && !lowerQuery.includes('premium') && listings.some(l => l.price.rate > 300)) {
    followUps.push("Show only luxury properties")
  }
  if (!lowerQuery.includes('budget') && !lowerQuery.includes('cheaper') && listings.some(l => l.price.rate < 100)) {
    followUps.push("Show budget options")
  }
  if (!lowerQuery.includes('larger') && !lowerQuery.includes('bedroom') && listings.some(l => /\d+\s*bed/i.test(l.name))) {
    followUps.push("Show larger properties")
  }

  // Return 3-4 most relevant follow-ups
  return followUps.slice(0, 4)
}