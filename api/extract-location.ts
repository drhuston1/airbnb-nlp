// Secure backend endpoint for GPT-4o-mini location extraction
import type { VercelRequest, VercelResponse } from '@vercel/node'

interface LocationExtractionRequest {
  query: string
}

interface LocationExtractionResponse {
  location: string
  success: boolean
  error?: string
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query }: LocationExtractionRequest = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required and must be a string',
        location: 'Unknown'
      })
    }

    // Check for OpenAI API key
    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      console.error('OPENAI_API_KEY not configured')
      return res.status(500).json({ 
        success: false, 
        error: 'OpenAI API key not configured',
        location: 'Unknown'
      })
    }

    console.log('Extracting location with GPT-4o-mini for query:', query)
    
    const location = await extractLocationWithGPT(query, openaiKey)
    
    const response: LocationExtractionResponse = {
      location,
      success: true
    }

    console.log('Location extraction result:', response)
    return res.status(200).json(response)

  } catch (error) {
    console.error('Location extraction error:', error)
    return res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      location: 'Unknown'
    })
  }
}

async function extractLocationWithGPT(query: string, apiKey: string): Promise<string> {
  try {
    const prompt = `Extract the main location from this travel/accommodation query. Return only the city, state, or country name - be specific and accurate.

Query: "${query}"

Examples:
- "Beach house in Malibu" → "Malibu"
- "Cabin in Colorado for Christmas" → "Colorado"  
- "Apartment in San Francisco downtown" → "San Francisco"
- "Villa in Los Angeles" → "Los Angeles"
- "Hotel in New York City" → "New York"
- "Airbnb in Austin Texas" → "Austin"
- "House in Miami Beach" → "Miami"
- "Properties in Yellowstone" → "Yellowstone"
- "Loft in Chicago downtown" → "Chicago"

Return ONLY the location name, nothing else:`

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
            content: 'You are a location extraction expert. Extract only the primary location from travel queries. Be precise and return only the location name.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 50,
        temperature: 0
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const extractedLocation = data.choices[0]?.message?.content?.trim()
    
    if (!extractedLocation || extractedLocation.toLowerCase() === 'unknown') {
      console.log('GPT could not extract location from:', query)
      return 'Unknown'
    }

    console.log(`GPT extracted location: "${extractedLocation}" from query: "${query}"`)
    return extractedLocation

  } catch (error) {
    console.error('GPT location extraction failed:', error)
    throw error
  }
}