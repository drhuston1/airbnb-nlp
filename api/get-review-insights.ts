// On-demand review insights for a specific listing
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface ReviewInsightsRequest {
  listingId: string
  listingUrl: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { listingId, listingUrl }: ReviewInsightsRequest = req.body

    if (!listingId || !listingUrl) {
      return res.status(400).json({ error: 'Missing required fields: listingId, listingUrl' })
    }

    console.log(`🔍 Getting review insights for listing ${listingId}...`)

    // Call the review analysis API internally
    const reviewAnalysisResponse = await fetch(`${req.headers.host}/api/review-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        listingId,
        listingUrl,
        rating: 4.5, // Will be extracted from the page
        reviewsCount: 0 // Will be extracted from the page
      })
    })

    if (!reviewAnalysisResponse.ok) {
      throw new Error(`Review analysis failed: ${reviewAnalysisResponse.status}`)
    }

    const analysisResult = await reviewAnalysisResponse.json()

    if (!analysisResult.success) {
      throw new Error(analysisResult.error || 'Review analysis failed')
    }

    console.log(`✅ Review insights retrieved for ${listingId}`)

    return res.status(200).json({
      success: true,
      listingId,
      reviewInsights: analysisResult.insights.reviewSummary,
      trustScore: analysisResult.insights.trustScore,
      metadata: analysisResult.insights.metadata
    })

  } catch (error) {
    console.error('Get review insights error:', error)
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}