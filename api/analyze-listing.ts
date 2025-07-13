// AI-powered Airbnb listing analysis API
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { API_CONFIG } from './config'

interface ListingAnalysisRequest {
  listing: {
    id: string
    name: string
    price: {
      rate: number
      currency: string
    }
    rating: number
    reviewsCount: number
    location: {
      city: string
      country: string
    }
    host: {
      name: string
      isSuperhost: boolean
    }
    amenities: string[]
    roomType: string
    propertyType?: string
    bedrooms?: number
    bathrooms?: number
    maxGuests?: number
    trustScore?: number
    images?: string[]
  }
  context?: {
    searchQuery?: string
    alternatives?: Array<{
      price: { rate: number }
      rating: number
      trustScore?: number
    }>
  }
}

interface ListingAnalysis {
  overallScore: number
  insights: {
    priceAnalysis: {
      score: number
      assessment: 'excellent' | 'good' | 'fair' | 'expensive'
      details: string
      comparison?: string
    }
    locationAnalysis: {
      score: number
      highlights: string[]
      concerns: string[]
      walkability?: string
    }
    hostAnalysis: {
      score: number
      trustLevel: 'high' | 'medium' | 'low'
      details: string
      experience?: string
    }
    propertyAnalysis: {
      score: number
      highlights: string[]
      amenityScore: number
      spaceAssessment?: string
    }
    reviewAnalysis: {
      score: number
      credibility: 'high' | 'medium' | 'low'
      summary: string
    }
  }
  recommendations: string[]
  redFlags: string[]
  bottomLine: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { listing, context }: ListingAnalysisRequest = req.body

    if (!listing || !listing.id) {
      return res.status(400).json({ 
        error: 'Listing data is required'
      })
    }

    console.log(`🔍 Analyzing listing: ${listing.name} (${listing.id})`)

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return res.status(500).json({ 
        error: 'Analysis service not configured'
      })
    }

    const analysis = await analyzeListingWithAI(listing, context, openaiKey)

    console.log(`✅ Analysis complete for ${listing.name}`)
    
    return res.status(200).json({
      success: true,
      analysis,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Listing analysis error:', error)
    return res.status(500).json({ 
      error: 'Failed to analyze listing',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

async function analyzeListingWithAI(
  listing: ListingAnalysisRequest['listing'],
  context: ListingAnalysisRequest['context'],
  apiKey: string
): Promise<ListingAnalysis> {
  
  // First try to fetch detailed listing info including reviews
  let reviewText = ''
  let detailedInfo = null
  
  try {
    console.log(`🔍 Fetching detailed listing info for review analysis...`)
    
    // Extract listing ID from URL if available
    const listingId = extractListingId(listing.id)
    if (listingId) {
      console.log(`📝 Attempting to fetch reviews for listing ID: ${listingId}`)
      
      const reviewsResponse = await fetch('/api/get-review-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId })
      })
      
      if (reviewsResponse.ok) {
        const reviewData = await reviewsResponse.json()
        if (reviewData.reviews && reviewData.reviews.length > 0) {
          reviewText = reviewData.reviews.slice(0, 10).map((review: any) => review.text || review.comment).join('\n\n')
          console.log(`✅ Fetched ${reviewData.reviews.length} reviews for analysis`)
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️ Failed to fetch detailed reviews:`, error instanceof Error ? error.message : error)
  }
  
  // Prepare context for analysis
  const averagePrice = context?.alternatives?.length 
    ? context.alternatives.reduce((sum, alt) => sum + alt.price.rate, 0) / context.alternatives.length
    : null

  const averageRating = context?.alternatives?.length
    ? context.alternatives.reduce((sum, alt) => sum + alt.rating, 0) / context.alternatives.length
    : null

  const prompt = `Analyze this Airbnb listing and provide a comprehensive assessment for a traveler.

LISTING DETAILS:
- Name: ${listing.name}
- Price: ${listing.price.currency}${listing.price.rate}/night
- Rating: ${listing.rating}/5 (${listing.reviewsCount} reviews)
- Location: ${listing.location.city}, ${listing.location.country}
- Host: ${listing.host.name} ${listing.host.isSuperhost ? '(Superhost)' : ''}
- Room Type: ${listing.roomType}
- Property Type: ${listing.propertyType || 'Unknown'}
- Capacity: ${listing.maxGuests || 'Unknown'} guests, ${listing.bedrooms || 'Unknown'} bedrooms, ${listing.bathrooms || 'Unknown'} bathrooms
- Amenities: ${listing.amenities.join(', ') || 'None listed'}
- Trust Score: ${listing.trustScore || 'Not available'}/100

CONTEXT:
- Search Query: ${context?.searchQuery || 'Not provided'}
- Average Price of Alternatives: ${averagePrice ? `${listing.price.currency}${averagePrice.toFixed(0)}/night` : 'Not available'}
- Average Rating of Alternatives: ${averageRating ? `${averageRating.toFixed(1)}/5` : 'Not available'}

${reviewText ? `RECENT GUEST REVIEWS:
${reviewText}

Please analyze these actual guest reviews to provide insights into:
- Common praise and complaints
- Specific issues mentioned by guests
- Patterns in guest experiences
- Property-specific feedback (cleanliness, amenities, host communication, etc.)
- Any red flags or concerns that frequently appear` : 'REVIEWS: Only basic rating/count available - no review text for analysis'}

Provide a JSON analysis with this exact structure:

{
  "overallScore": number (0-100),
  "insights": {
    "priceAnalysis": {
      "score": number (0-100),
      "assessment": "excellent|good|fair|expensive",
      "details": "Detailed price assessment including value for money",
      "comparison": "How price compares to alternatives if available"
    },
    "locationAnalysis": {
      "score": number (0-100),
      "highlights": ["Location advantages"],
      "concerns": ["Location concerns if any"],
      "walkability": "Assessment of walkability and transportation"
    },
    "hostAnalysis": {
      "score": number (0-100),
      "trustLevel": "high|medium|low",
      "details": "Host experience and reliability assessment",
      "experience": "Assessment of host's experience level"
    },
    "propertyAnalysis": {
      "score": number (0-100),
      "highlights": ["Property strengths"],
      "amenityScore": number (0-100),
      "spaceAssessment": "Assessment of space and layout"
    },
    "reviewAnalysis": {
      "score": number (0-100),
      "credibility": "high|medium|low", 
      "summary": "Comprehensive analysis of guest experiences based on review text and ratings",
      "commonPraise": ["Specific things guests commonly praise"],
      "frequentComplaints": ["Specific issues guests frequently mention"],
      "hostCommunication": "Assessment of host responsiveness and communication quality",
      "cleanlinessScore": number (0-100),
      "accuracyScore": number (0-100),
      "valueScore": number (0-100),
      "guestInsights": "Key patterns and insights from actual guest experiences"
    }
  },
  "recommendations": ["Key recommendations for this booking"],
  "redFlags": ["Any concerns or red flags"],
  "bottomLine": "One-sentence summary recommendation"
}

Focus on practical travel advice. Consider:
- Price competitiveness and value
- Location convenience for travelers
- Host reliability and communication
- Property amenities and condition
- Review credibility and patterns
- Overall booking confidence

${reviewText ? `IMPORTANT: Since you have access to actual guest reviews, analyze them thoroughly to extract:
- Specific recurring themes in guest feedback
- Concrete examples of praise and complaints
- Patterns that indicate property quality and host performance
- Any discrepancies between listing description and guest experiences
- Red flags that could impact traveler satisfaction` : ''}

Be honest about both positives and concerns. Provide actionable insights based on available data.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert travel advisor and Airbnb analyst. Provide comprehensive, honest, and practical listing assessments to help travelers make informed decisions. Always return valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: API_CONFIG.GPT_MAX_TOKENS,
        temperature: 0.3 // Lower temperature for more consistent analysis
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const analysisText = data.choices[API_CONFIG.FIRST_CHOICE_INDEX]?.message?.content?.trim()
    
    if (!analysisText) {
      throw new Error('Empty response from AI analysis')
    }

    // Parse the JSON response
    let analysis: ListingAnalysis
    try {
      analysis = JSON.parse(analysisText)
    } catch (parseError) {
      console.error('Failed to parse AI analysis response:', analysisText)
      // Provide fallback analysis
      analysis = generateFallbackAnalysis(listing, context)
    }

    // Validate and ensure all required fields exist
    analysis = validateAndCleanAnalysis(analysis, listing)

    return analysis

  } catch (error) {
    console.error('AI analysis failed:', error)
    // Return fallback analysis instead of failing completely
    return generateFallbackAnalysis(listing, context)
  }
}

// Helper function to extract listing ID from various ID formats
function extractListingId(id: string): string | null {
  if (!id) return null
  
  // Handle various ID formats
  if (id.includes('/rooms/')) {
    const match = id.match(/\/rooms\/(\d+)/)
    return match ? match[1] : null
  }
  
  // Direct numeric ID
  if (/^\d+$/.test(id)) {
    return id
  }
  
  // Extract numeric ID from complex formats
  const numericMatch = id.match(/(\d{8,})/)
  return numericMatch ? numericMatch[1] : null
}

function generateFallbackAnalysis(
  listing: ListingAnalysisRequest['listing'],
  context: ListingAnalysisRequest['context']
): ListingAnalysis {
  // Generate basic analysis without AI
  const priceScore = listing.price.rate < 100 ? 80 : listing.price.rate < 200 ? 60 : 40
  const ratingScore = Math.min(100, listing.rating * 20)
  const hostScore = listing.host.isSuperhost ? 90 : 70
  const reviewScore = listing.reviewsCount > 50 ? 90 : listing.reviewsCount > 10 ? 70 : 50
  
  const overallScore = Math.round((priceScore + ratingScore + hostScore + reviewScore) / 4)

  return {
    overallScore,
    insights: {
      priceAnalysis: {
        score: priceScore,
        assessment: priceScore > 70 ? 'good' : priceScore > 50 ? 'fair' : 'expensive',
        details: `Price of ${listing.price.currency}${listing.price.rate}/night analyzed based on location and amenities.`,
        comparison: context?.alternatives?.length ? 'Compared to similar properties in search results.' : undefined
      },
      locationAnalysis: {
        score: 75,
        highlights: [`Located in ${listing.location.city}`],
        concerns: [],
        walkability: 'Location assessment not available without AI analysis'
      },
      hostAnalysis: {
        score: hostScore,
        trustLevel: listing.host.isSuperhost ? 'high' : 'medium',
        details: listing.host.isSuperhost 
          ? `${listing.host.name} is a Superhost, indicating excellent hosting standards.`
          : `Host ${listing.host.name} appears reliable based on available information.`,
        experience: listing.host.isSuperhost ? 'Experienced' : 'Standard'
      },
      propertyAnalysis: {
        score: 70,
        highlights: listing.amenities.slice(0, 3),
        amenityScore: Math.min(100, listing.amenities.length * 10),
        spaceAssessment: `${listing.bedrooms || 'Unknown'} bedrooms, ${listing.maxGuests || 'Unknown'} guests capacity`
      },
      reviewAnalysis: {
        score: reviewScore,
        credibility: listing.reviewsCount > 50 ? 'high' : listing.reviewsCount > 10 ? 'medium' : 'low',
        summary: `${listing.reviewsCount} reviews with ${listing.rating}/5 rating suggests ${listing.rating > 4.5 ? 'excellent' : listing.rating > 4 ? 'good' : 'average'} guest satisfaction.`,
        commonPraise: listing.rating > 4.5 ? ['High overall rating indicates positive guest experiences'] : [],
        frequentComplaints: listing.rating < 4 ? ['Lower rating may indicate some guest concerns'] : [],
        hostCommunication: listing.host.isSuperhost ? 'Superhost status indicates excellent communication' : 'Communication quality not assessed without review text',
        cleanlinessScore: Math.min(100, listing.rating * 20),
        accuracyScore: Math.min(100, listing.rating * 20),
        valueScore: Math.min(100, listing.rating * 20),
        guestInsights: 'Detailed guest insights require review text analysis'
      }
    },
    recommendations: [
      `Property rated ${listing.rating}/5 based on ${listing.reviewsCount} reviews`,
      listing.host.isSuperhost ? 'Superhost provides added confidence' : 'Verify host responsiveness before booking'
    ],
    redFlags: listing.reviewsCount < 5 ? ['Limited review history'] : [],
    bottomLine: `${overallScore > 80 ? 'Excellent' : overallScore > 60 ? 'Good' : 'Fair'} choice for ${listing.location.city} at ${listing.price.currency}${listing.price.rate}/night.`
  }
}

function validateAndCleanAnalysis(
  analysis: any,
  listing: ListingAnalysisRequest['listing']
): ListingAnalysis {
  // Ensure all required fields exist with defaults
  return {
    overallScore: Math.max(0, Math.min(100, analysis.overallScore || 50)),
    insights: {
      priceAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.priceAnalysis?.score || 50)),
        assessment: analysis.insights?.priceAnalysis?.assessment || 'fair',
        details: analysis.insights?.priceAnalysis?.details || 'Price analysis unavailable',
        comparison: analysis.insights?.priceAnalysis?.comparison
      },
      locationAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.locationAnalysis?.score || 50)),
        highlights: Array.isArray(analysis.insights?.locationAnalysis?.highlights) 
          ? analysis.insights.locationAnalysis.highlights 
          : [`Located in ${listing.location.city}`],
        concerns: Array.isArray(analysis.insights?.locationAnalysis?.concerns)
          ? analysis.insights.locationAnalysis.concerns
          : [],
        walkability: analysis.insights?.locationAnalysis?.walkability
      },
      hostAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.hostAnalysis?.score || 50)),
        trustLevel: analysis.insights?.hostAnalysis?.trustLevel || (listing.host.isSuperhost ? 'high' : 'medium'),
        details: analysis.insights?.hostAnalysis?.details || `Host: ${listing.host.name}`,
        experience: analysis.insights?.hostAnalysis?.experience
      },
      propertyAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.propertyAnalysis?.score || 50)),
        highlights: Array.isArray(analysis.insights?.propertyAnalysis?.highlights)
          ? analysis.insights.propertyAnalysis.highlights
          : listing.amenities.slice(0, 3),
        amenityScore: Math.max(0, Math.min(100, analysis.insights?.propertyAnalysis?.amenityScore || 50)),
        spaceAssessment: analysis.insights?.propertyAnalysis?.spaceAssessment
      },
      reviewAnalysis: {
        score: Math.max(0, Math.min(100, analysis.insights?.reviewAnalysis?.score || 50)),
        credibility: analysis.insights?.reviewAnalysis?.credibility || 'medium',
        summary: analysis.insights?.reviewAnalysis?.summary || `${listing.reviewsCount} reviews available`,
        commonPraise: Array.isArray(analysis.insights?.reviewAnalysis?.commonPraise) ? analysis.insights.reviewAnalysis.commonPraise : [],
        frequentComplaints: Array.isArray(analysis.insights?.reviewAnalysis?.frequentComplaints) ? analysis.insights.reviewAnalysis.frequentComplaints : [],
        hostCommunication: analysis.insights?.reviewAnalysis?.hostCommunication,
        cleanlinessScore: analysis.insights?.reviewAnalysis?.cleanlinessScore ? Math.max(0, Math.min(100, analysis.insights.reviewAnalysis.cleanlinessScore)) : undefined,
        accuracyScore: analysis.insights?.reviewAnalysis?.accuracyScore ? Math.max(0, Math.min(100, analysis.insights.reviewAnalysis.accuracyScore)) : undefined,
        valueScore: analysis.insights?.reviewAnalysis?.valueScore ? Math.max(0, Math.min(100, analysis.insights.reviewAnalysis.valueScore)) : undefined,
        guestInsights: analysis.insights?.reviewAnalysis?.guestInsights
      }
    },
    recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : ['Analysis recommendations unavailable'],
    redFlags: Array.isArray(analysis.redFlags) ? analysis.redFlags : [],
    bottomLine: analysis.bottomLine || `Property analysis for ${listing.name}`
  }
}