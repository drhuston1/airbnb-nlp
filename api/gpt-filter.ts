// GPT-powered semantic filtering for property listings
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { API_CONFIG } from './config'

interface ListingSummary {
  id: string
  name: string
  roomType: string
  amenities: string[]
  rating: number
  reviewsCount: number
  price: number
  isSuperhost: boolean
}

interface GPTFilterRequest {
  query: string
  listings: ListingSummary[]
}

interface GPTFilterResponse {
  filteredIds: string[]
  success: boolean
  error?: string
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
    const { query, listings }: GPTFilterRequest = req.body

    if (!query || !listings || !Array.isArray(listings)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query and listings array are required',
        filteredIds: []
      })
    }

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured',
        filteredIds: []
      })
    }

    console.log(`GPT filtering ${listings.length} listings for query: "${query}"`)
    
    const filteredIds = await filterListingsWithGPT(query, listings, openaiKey)
    
    const response: GPTFilterResponse = {
      filteredIds,
      success: true
    }

    console.log(`GPT filtering result: ${filteredIds.length}/${listings.length} properties matched`)
    return res.status(200).json(response)

  } catch (error) {
    console.error('GPT filtering error:', error)
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      filteredIds: []
    })
  }
}

async function filterListingsWithGPT(
  query: string, 
  listings: ListingSummary[], 
  apiKey: string
): Promise<string[]> {
  try {
    const prompt = `Query: "${query}"

Properties:
${listings.map(listing => 
  `${listing.id}: ${listing.name} | ${listing.roomType} | $${listing.price}/night | ${listing.rating}/5 | Superhost: ${listing.isSuperhost}`
).join('\n')}

Rules:
- If query contains "superhost only" or "superhost" → ONLY return IDs where Superhost: true
- If query contains "luxury" → ONLY return IDs where price ≥ $200 OR rating ≥ 4.8 OR Superhost: true  
- If query contains "villa" → ONLY return IDs where name/type contains "villa" or "estate"
- If query contains "hostel" → ONLY return IDs where name/type contains "hostel" or "shared"

For query "${query}":
Return JSON array of matching property IDs only: ["id1", "id2"]
If no matches, return: []`

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
            content: 'You are a selective travel accommodation matcher. Your job is to filter properties to return only the most relevant matches. Be strict and exclude properties that don\'t genuinely match the user\'s intent. Quality over quantity. Always return valid JSON arrays.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200, // Shorter response for simple filtering
        temperature: 0 // Zero temperature for deterministic filtering
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const gptResponse = data.choices[API_CONFIG.FIRST_CHOICE_INDEX]?.message?.content?.trim()
    
    if (!gptResponse) {
      throw new Error('Empty response from GPT')
    }

    // Parse the JSON response
    let filteredIds: string[]
    try {
      filteredIds = JSON.parse(gptResponse)
      
      // Validate that it's an array of strings
      if (!Array.isArray(filteredIds) || !filteredIds.every(id => typeof id === 'string')) {
        throw new Error('Invalid response format')
      }
      
      // Filter to only include valid IDs that exist in the input
      const validIds = new Set(listings.map(l => l.id))
      filteredIds = filteredIds.filter(id => validIds.has(id))
      
    } catch (parseError) {
      console.error('Failed to parse GPT response:', gptResponse)
      // Fallback: return all IDs if parsing fails
      filteredIds = listings.map(l => l.id)
    }

    console.log(`GPT matched ${filteredIds.length} properties:`, filteredIds.slice(0, 5))
    return filteredIds

  } catch (error) {
    console.error('GPT filtering failed:', error)
    throw error
  }
}