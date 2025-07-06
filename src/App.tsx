import { useState, useRef, useEffect } from 'react'
import { Box } from '@chakra-ui/react'

// Import types
import type { AirbnbListing, SearchResponse, ChatMessage, SearchHistory, SearchContext } from './types'

// Import utilities
import { extractSearchContext, updateSearchContext } from './utils/searchContext'
import { applyNaturalLanguageFilters } from './utils/filtering'
import { generateFollowUps } from './utils/followUps'
import { analyzeQuery as nlpAnalyzeQuery, extractTripContext, generateConversationalResponse } from './utils/nlpAnalysis'
import { enhanceWithAI, shouldEnhanceWithAI } from './utils/aiEnhancement'

// Import hooks
import { useSpeechRecognition } from './hooks/useSpeechRecognition'

// Import components
import { Sidebar } from './components/Sidebar'
import { ResultsPanel } from './components/ResultsPanel'

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [currentResults, setCurrentResults] = useState<AirbnbListing[]>([])
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null)
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Speech recognition hook
  const { isListening, speechSupported, toggleListening } = useSpeechRecognition()

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Handle speech recognition result
  const handleSpeechResult = (transcript: string) => {
    setSearchQuery(prev => prev + (prev ? ' ' : '') + transcript)
  }

  // Speech toggle with result handler
  const handleSpeechToggle = () => {
    toggleListening(handleSpeechResult)
  }

  // Load search history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('airbnb-search-history')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        setSearchHistory(parsed.map((item: SearchHistory) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })))
      } catch (error) {
        console.error('Error loading search history:', error)
      }
    }
  }, [])

  // Save search history to localStorage whenever it changes
  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem('airbnb-search-history', JSON.stringify(searchHistory))
    }
  }, [searchHistory])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Add search to history
  const addToHistory = (query: string, resultCount: number) => {
    const newHistoryItem: SearchHistory = {
      id: Date.now().toString(),
      query,
      timestamp: new Date(),
      resultCount
    }
    
    setSearchHistory(prev => {
      // Remove duplicate queries and keep only the latest 20
      const filtered = prev.filter(item => item.query !== query)
      return [newHistoryItem, ...filtered].slice(0, 20)
    })
  }


  // Start new chat
  const startNewChat = () => {
    setMessages([])
    setCurrentResults([])
    setSearchQuery('')
    setSearchContext(null)
  }

  // Handle followup clicks
  const handleFollowUpClick = (followup: string) => {
    setSearchQuery(followup)
    setTimeout(() => handleSearch(), 100)
  }

  // Handle listing clicks
  const handleListingClick = (listing: AirbnbListing) => {
    window.open(listing.url, '_blank')
  }

  const handleSearch = async (page = 1) => {
    if (!searchQuery.trim()) return

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: searchQuery,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])

    setLoading(true)
    const query = searchQuery
    setSearchQuery('')

    // Analyze the query using open-source NLP
    const nlpAnalysis = nlpAnalyzeQuery(query, searchContext || undefined)
    const tripContext = extractTripContext(query)
    console.log('NLP Analysis:', nlpAnalysis)
    console.log('Trip Context:', tripContext)

    // If the query is very incomplete, provide clarifying questions instead of searching
    if (nlpAnalysis.completeness.score < 0.3 && !nlpAnalysis.completeness.hasLocation) {
      const clarificationMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I'd love to help you find the perfect place! ${nlpAnalysis.suggestions.join(' ')}`,
        followUps: nlpAnalysis.suggestions.slice(0, 3),
        timestamp: new Date()
      }
      setMessages(prev => [...prev, clarificationMessage])
      setLoading(false)
      return
    }

    try {
      // Prepare search payload with context
      const searchPayload: any = {
        query,
        page
      }

      // If we have existing search context, include it (for followup queries)
      if (searchContext) {
        searchPayload.location = searchContext.location
        searchPayload.adults = searchContext.adults
        searchPayload.children = searchContext.children
        if (searchContext.checkin) searchPayload.checkin = searchContext.checkin
        if (searchContext.checkout) searchPayload.checkout = searchContext.checkout
        if (searchContext.minPrice) searchPayload.minPrice = searchContext.minPrice
        if (searchContext.maxPrice) searchPayload.maxPrice = searchContext.maxPrice
        
        console.log('Sending search with context:', searchPayload)
      }

      const response = await fetch('/api/mcp-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchPayload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Search failed: ${response.statusText}`)
      }

      const data: SearchResponse = await response.json()
      const searchResults = data.listings || []
      
      // Capture search context on first search for followup queries
      if (page === 1) {
        if (!searchContext) {
          // Extract basic context from the initial query
          const extractedContext = extractSearchContext(query)
          setSearchContext(extractedContext)
          console.log('Captured search context:', extractedContext)
        } else {
          // Update context with new parameters from followup query
          const updatedContext = updateSearchContext(searchContext, query)
          setSearchContext(updatedContext)
          console.log('Updated search context for query "' + query + '":', updatedContext)
          console.log('Original context was:', searchContext)
        }
      }
      
      // Apply natural language filters
      let filteredResults = applyNaturalLanguageFilters(searchResults, query, searchContext)
      
      // Generate response using NLP analysis
      let responseContent = generateConversationalResponse(nlpAnalysis, tripContext, filteredResults.length)
      
      // Use AI enhancement for complex queries
      if (shouldEnhanceWithAI(query, nlpAnalysis) && filteredResults.length > 0) {
        try {
          const aiEnhanced = await enhanceWithAI(query, nlpAnalysis, tripContext, filteredResults)
          responseContent = aiEnhanced.personalizedMessage
          
          // Add AI insights if available
          if (aiEnhanced.insights.length > 0) {
            responseContent += `\n\n💡 ${aiEnhanced.insights[0]}`
          }
          
          // Set follow-ups from AI if available
          if (aiEnhanced.clarifyingQuestions.length > 0) {
            responseContent += `\n\n${aiEnhanced.clarifyingQuestions[0]}`
          }
        } catch (error) {
          console.log('AI enhancement failed, using NLP response:', error)
          // Fall back to NLP-only response
        }
      }
      
      // Add navigation hint if we have results
      if (filteredResults.length > 0) {
        responseContent += ` Check the results panel → to explore your options.`
      }
      
      // Add suggestions if query could be more complete
      if (nlpAnalysis.completeness.score < 0.7 && nlpAnalysis.suggestions.length > 0) {
        responseContent += `\n\n${nlpAnalysis.suggestions[0]}`
      }
      
      const followUpSuggestions = generateFollowUps(filteredResults, query)
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseContent,
        followUps: followUpSuggestions,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

      setCurrentResults(filteredResults)
      addToHistory(query, filteredResults.length)

    } catch (error) {
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I had trouble searching for properties. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      console.error(error)
    } finally {
      setLoading(false)
    }
  }


  const hasSearched = messages.length > 0

  return (
    <Box h="100vh" bg="green.25" display="flex" flexDirection="row">
      <Sidebar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearch={handleSearch}
        onSpeechToggle={handleSpeechToggle}
        messages={messages}
        onFollowUpClick={handleFollowUpClick}
        onNewConversation={startNewChat}
        isLoading={loading}
        isListening={isListening}
        speechSupported={speechSupported}
      />
      
      <ResultsPanel
        listings={currentResults}
        isLoading={loading}
        hasSearched={hasSearched}
        onListingClick={handleListingClick}
      />
    </Box>
  )
}

export default App