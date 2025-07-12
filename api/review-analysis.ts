// Review analysis API for extracting insights from Airbnb listing reviews
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ReviewAnalysisRequest {
  listingId: string
  listingUrl: string
  rating: number
  reviewsCount: number
}

interface ReviewInsights {
  trustScore: number // 0-100 score based on rating confidence
  reviewSummary: {
    positiveHighlights: string[]
    negativeInsights: string[]
    commonConcerns: string[]
    overallSentiment: 'positive' | 'mixed' | 'negative'
  }
  ratingBreakdown: {
    fiveStars: number
    fourStars: number
    threeStars: number
    twoStars: number
    oneStar: number
  }
  metadata: {
    totalReviews: number
    recentReviews: number
    analysisDate: string
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { listingId, listingUrl, rating, reviewsCount }: ReviewAnalysisRequest = req.body

    if (!listingId || !listingUrl) {
      return res.status(400).json({ error: 'Missing required fields: listingId, listingUrl' })
    }

    console.log(`🔍 Analyzing reviews for listing ${listingId}...`)

    // Calculate trust score (0-100) based on rating and review count
    const trustScore = calculateTrustScore(rating, reviewsCount)

    // Fetch and analyze reviews from Airbnb
    const reviewAnalysis = await analyzeListingReviews(listingUrl, listingId)

    const insights: ReviewInsights = {
      trustScore,
      reviewSummary: reviewAnalysis.summary,
      ratingBreakdown: reviewAnalysis.breakdown,
      metadata: {
        totalReviews: reviewsCount,
        recentReviews: reviewAnalysis.recentReviewsCount,
        analysisDate: new Date().toISOString()
      }
    }

    console.log(`✅ Review analysis complete for ${listingId}: Trust Score ${trustScore}`)

    return res.status(200).json({
      success: true,
      listingId,
      insights
    })

  } catch (error) {
    console.error('Review analysis error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}

// Calculate trust score based on rating and review count
function calculateTrustScore(rating: number, reviewsCount: number): number {
  if (!rating || !reviewsCount || reviewsCount === 0) return 0

  // Base score from rating (0-60 points)
  const ratingScore = Math.min(60, (rating / 5.0) * 60)

  // Review count confidence boost (0-40 points)
  let reviewCountScore = 0
  if (reviewsCount >= 100) {
    reviewCountScore = 40 // Very high confidence
  } else if (reviewsCount >= 50) {
    reviewCountScore = 35 // High confidence  
  } else if (reviewsCount >= 25) {
    reviewCountScore = 30 // Good confidence
  } else if (reviewsCount >= 10) {
    reviewCountScore = 20 // Moderate confidence
  } else if (reviewsCount >= 5) {
    reviewCountScore = 10 // Low confidence
  } else {
    reviewCountScore = 5 // Very low confidence
  }

  const totalScore = Math.round(ratingScore + reviewCountScore)
  return Math.min(100, Math.max(0, totalScore))
}

// Analyze reviews from Airbnb listing page
async function analyzeListingReviews(listingUrl: string, listingId: string) {
  console.log(`📊 Fetching reviews for ${listingId}...`)

  try {
    // Headers to mimic a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.airbnb.com/',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }

    // Fetch the listing page HTML
    const response = await fetch(listingUrl, { headers })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch listing page: ${response.status}`)
    }

    const html = await response.text()
    
    // Extract reviews data from the page
    const reviewsData = extractReviewsFromHTML(html)
    
    // Analyze the extracted reviews
    const analysis = await analyzeReviewsContent(reviewsData.reviews)
    
    return {
      summary: analysis,
      breakdown: reviewsData.ratingBreakdown,
      recentReviewsCount: reviewsData.recentReviewsCount
    }

  } catch (error) {
    console.error('Error fetching/analyzing reviews:', error)
    
    // Return fallback analysis with empty data
    return {
      summary: {
        positiveHighlights: ['Unable to analyze reviews at this time'],
        negativeInsights: ['Review analysis unavailable'],
        commonConcerns: [],
        overallSentiment: 'mixed' as const
      },
      breakdown: {
        fiveStars: 0,
        fourStars: 0,
        threeStars: 0,
        twoStars: 0,
        oneStar: 0
      },
      recentReviewsCount: 0
    }
  }
}

// Extract review data from Airbnb listing HTML
function extractReviewsFromHTML(html: string) {
  const reviews: string[] = []
  let ratingBreakdown = {
    fiveStars: 0,
    fourStars: 0,
    threeStars: 0,
    twoStars: 0,
    oneStar: 0
  }

  try {
    // Look for review text patterns in the HTML
    // Airbnb reviews are usually in specific data structures
    const reviewPatterns = [
      /"reviews":\s*\[(.*?)\]/s,
      /"reviewText":\s*"(.*?)"/g,
      /class="[^"]*review[^"]*"[^>]*>(.*?)<\//g
    ]

    for (const pattern of reviewPatterns) {
      const matches = html.match(pattern)
      if (matches) {
        matches.forEach(match => {
          // Clean and extract review text
          const cleanText = match
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/['"]/g, '') // Remove quotes
            .trim()
          
          if (cleanText.length > 10 && cleanText.length < 2000) {
            reviews.push(cleanText)
          }
        })
      }
    }

    // Extract rating breakdown if available in the HTML
    const ratingMatches = html.match(/rating.*?distribution.*?(\d+).*?(\d+).*?(\d+).*?(\d+).*?(\d+)/i)
    if (ratingMatches) {
      ratingBreakdown = {
        fiveStars: parseInt(ratingMatches[1]) || 0,
        fourStars: parseInt(ratingMatches[2]) || 0,
        threeStars: parseInt(ratingMatches[3]) || 0,
        twoStars: parseInt(ratingMatches[4]) || 0,
        oneStar: parseInt(ratingMatches[5]) || 0
      }
    }

  } catch (error) {
    console.error('Error extracting reviews from HTML:', error)
  }

  return {
    reviews: reviews.slice(0, 50), // Limit to first 50 reviews
    ratingBreakdown,
    recentReviewsCount: Math.min(reviews.length, 20)
  }
}

// Analyze review content to extract insights
async function analyzeReviewsContent(reviews: string[]) {
  const positiveHighlights: string[] = []
  const negativeInsights: string[] = []
  const commonConcerns: string[] = []

  if (reviews.length === 0) {
    return {
      positiveHighlights: ['No reviews available for analysis'],
      negativeInsights: ['Insufficient review data'],
      commonConcerns: [],
      overallSentiment: 'mixed' as const
    }
  }

  try {
    // Simple keyword-based analysis for common concerns
    const concernKeywords = {
      'noise': ['noise', 'noisy', 'loud', 'hear neighbors', 'thin walls', 'sounds'],
      'cleanliness': ['dirty', 'unclean', 'messy', 'stains', 'smell', 'odor'],
      'amenities': ['no towels', 'missing', 'broken', 'not working', 'needs repair'],
      'communication': ['unresponsive', 'no response', 'poor communication', 'rude'],
      'location': ['unsafe', 'bad neighborhood', 'far from', 'difficult to find'],
      'space': ['smaller than expected', 'cramped', 'tight space', 'not as pictured'],
      'wifi': ['no wifi', 'poor internet', 'slow connection', 'wifi problems']
    }

    const positiveKeywords = {
      'location': ['great location', 'perfect location', 'convenient', 'walkable'],
      'host': ['responsive', 'helpful host', 'great communication', 'accommodating'],
      'cleanliness': ['spotless', 'very clean', 'immaculate', 'well maintained'],
      'amenities': ['everything you need', 'well equipped', 'great amenities'],
      'space': ['spacious', 'exactly as pictured', 'beautiful space', 'cozy']
    }

    // Count occurrences of concern and positive keywords
    const concernCounts: Record<string, number> = {}
    const positiveCounts: Record<string, number> = {}

    reviews.forEach(review => {
      const lowerReview = review.toLowerCase()
      
      // Check for concerns
      Object.entries(concernKeywords).forEach(([concern, keywords]) => {
        keywords.forEach(keyword => {
          if (lowerReview.includes(keyword)) {
            concernCounts[concern] = (concernCounts[concern] || 0) + 1
          }
        })
      })

      // Check for positives
      Object.entries(positiveKeywords).forEach(([positive, keywords]) => {
        keywords.forEach(keyword => {
          if (lowerReview.includes(keyword)) {
            positiveCounts[positive] = (positiveCounts[positive] || 0) + 1
          }
        })
      })
    })

    // Generate insights based on patterns
    Object.entries(concernCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([concern, count]) => {
        if (count >= 2) {
          commonConcerns.push(`${concern} issues mentioned in ${count} reviews`)
          negativeInsights.push(generateConcernInsight(concern, count))
        }
      })

    Object.entries(positiveCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .forEach(([positive, count]) => {
        if (count >= 3) {
          positiveHighlights.push(generatePositiveInsight(positive, count))
        }
      })

    // Determine overall sentiment
    const totalConcerns = Object.values(concernCounts).reduce((a, b) => a + b, 0)
    const totalPositives = Object.values(positiveCounts).reduce((a, b) => a + b, 0)
    
    let overallSentiment: 'positive' | 'mixed' | 'negative'
    if (totalPositives > totalConcerns * 1.5) {
      overallSentiment = 'positive'
    } else if (totalConcerns > totalPositives * 1.5) {
      overallSentiment = 'negative'
    } else {
      overallSentiment = 'mixed'
    }

    return {
      positiveHighlights: positiveHighlights.length > 0 ? positiveHighlights : ['Generally positive feedback'],
      negativeInsights: negativeInsights.length > 0 ? negativeInsights : ['No major concerns identified'],
      commonConcerns,
      overallSentiment
    }

  } catch (error) {
    console.error('Error analyzing review content:', error)
    return {
      positiveHighlights: ['Analysis temporarily unavailable'],
      negativeInsights: ['Unable to process reviews'],
      commonConcerns: [],
      overallSentiment: 'mixed' as const
    }
  }
}

function generateConcernInsight(concern: string, count: number): string {
  const insights: Record<string, string> = {
    'noise': `Noise levels may be an issue - mentioned by ${count} guests`,
    'cleanliness': `Cleanliness standards may not meet expectations - ${count} mentions`,
    'amenities': `Some amenities may be missing or broken - reported ${count} times`,
    'communication': `Host communication could be improved - ${count} reviews mention this`,
    'location': `Location safety or convenience concerns - ${count} guests noted issues`,
    'space': `Property may be smaller or different than pictured - ${count} mentions`,
    'wifi': `Internet connectivity issues reported by ${count} guests`
  }
  
  return insights[concern] || `${concern} mentioned ${count} times in reviews`
}

function generatePositiveInsight(positive: string, count: number): string {
  const insights: Record<string, string> = {
    'location': `Excellent location highly praised by ${count} guests`,
    'host': `Outstanding host communication appreciated by ${count} reviews`,
    'cleanliness': `Exceptional cleanliness consistently noted by ${count} guests`,
    'amenities': `Well-equipped space with great amenities - ${count} mentions`,
    'space': `Beautiful and spacious property as pictured - ${count} positive reviews`
  }
  
  return insights[positive] || `${positive} consistently praised by ${count} guests`
}