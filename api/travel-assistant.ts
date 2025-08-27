import type { VercelRequest, VercelResponse } from '@vercel/node'

interface TravelAssistantRequest {
  query: string
  conversationHistory?: Array<{
    type: 'user' | 'assistant'
    content: string
  }>
}

interface TravelAssistantResponse {
  response: string
  topic: string
  location?: string
  suggestions?: string[]
  followUpQuestions?: string[]
  isTravel: boolean
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { query, conversationHistory = [] }: TravelAssistantRequest = req.body

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' })
    }

    // Build conversation context
    const contextMessages = conversationHistory
      .slice(-3) // Keep last 3 exchanges for context
      .map(msg => `${msg.type === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n')

    const systemPrompt = `You are a knowledgeable travel assistant specializing in helping people plan trips and find accommodations. You provide helpful, specific, and actionable advice about destinations, neighborhoods, activities, and travel planning.

Key guidelines:
- Focus on practical travel advice and destination information
- When discussing locations, mention specific neighborhoods, towns, or areas
- Provide concrete suggestions and recommendations
- Include local insights, best times to visit, and practical tips
- If asked about property searches, acknowledge but guide them to be more specific about location and requirements
- Always be helpful and informative, drawing on extensive travel knowledge

Current conversation context:
${contextMessages ? contextMessages + '\n\n' : ''}Human: ${query}`

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!openAIResponse.ok) {
      throw new Error(`OpenAI API failed: ${openAIResponse.status}`)
    }

    const openAIData = await openAIResponse.json()
    const response = openAIData.choices[0]?.message?.content || 'I apologize, but I encountered an issue generating a response.'

    // Extract location mentions and topic
    const locationMatch = query.match(/\b(?:in|near|around|at)\s+([^,?!.]+)/i)
    const extractedLocation = locationMatch ? locationMatch[1].trim() : undefined

    // Determine topic based on query content
    let topic = 'general'
    if (query.toLowerCase().includes('best') && (query.toLowerCase().includes('town') || query.toLowerCase().includes('area') || query.toLowerCase().includes('neighborhood'))) {
      topic = 'location_recommendation'
    } else if (query.toLowerCase().includes('when') || query.toLowerCase().includes('time')) {
      topic = 'timing'
    } else if (query.toLowerCase().includes('what') && query.toLowerCase().includes('do')) {
      topic = 'activities'
    }

    // Generate follow-up questions based on the response
    const followUpQuestions: string[] = []
    
    if (topic === 'location_recommendation' && extractedLocation) {
      followUpQuestions.push(`Show me 4 bedroom houses in ${extractedLocation}`)
      followUpQuestions.push(`What are the best activities in ${extractedLocation}?`)
      followUpQuestions.push(`When is the best time to visit ${extractedLocation}?`)
    }

    // Generate actionable suggestions
    const suggestions: string[] = []
    if (extractedLocation) {
      suggestions.push(`Search for properties in ${extractedLocation}`)
      suggestions.push(`Find luxury rentals in ${extractedLocation}`)
      suggestions.push(`Show pet-friendly options in ${extractedLocation}`)
    }

    const result: TravelAssistantResponse = {
      response,
      topic,
      location: extractedLocation,
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : undefined,
      isTravel: true
    }

    res.status(200).json(result)

  } catch (error) {
    console.error('Travel assistant error:', error)
    
    let errorMessage = 'I encountered an issue while processing your request.'
    
    if (error instanceof Error) {
      if (error.message.includes('OpenAI API failed')) {
        errorMessage = 'I\'m having trouble accessing my travel knowledge right now. Please try again in a moment.'
      }
    }

    res.status(500).json({ 
      error: errorMessage,
      isTravel: false,
      response: errorMessage,
      topic: 'error'
    })
  }
}