import { useState, useRef, useEffect } from 'react'
import {
  Box,
  Text,
  Button,
  HStack,
  Spinner,
  Flex,
  Link,
  Icon,
  VStack,
  Textarea
} from '@chakra-ui/react'
import { 
  MapPin, 
  Star, 
  Crown,
  ExternalLink,
  Send,
  Home,
  Clock,
  X,
  Plus,
  Menu
} from 'lucide-react'

// Import types
import type { SearchContext } from './types'

// Import enhanced NLP utilities
import { extractSearchContextFromNLP, updateSearchContextFromNLP } from './utils/searchContext'
import { applyIntelligentFilters } from './utils/intelligentFiltering'
import { generateFollowUps } from './utils/followUps'
import { analyzeQuery as nlpAnalyzeQuery, extractTripContext, generateConversationalResponse } from './utils/nlpAnalysis'
import { enhanceWithAI, shouldEnhanceWithAI } from './utils/aiEnhancement'
interface AirbnbListing {
  id: string
  name: string
  url: string
  images: string[]
  price: {
    total: number
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
}

interface SearchResponse {
  listings: AirbnbListing[]
  hasMore: boolean
  totalResults: number
  page: number
  searchUrl?: string
  source?: string
}

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  followUps?: string[]
  timestamp: Date
}

interface SearchHistory {
  id: string
  query: string
  timestamp: Date
  resultCount: number
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([])
  const [showResults, setShowResults] = useState(false)
  const [currentResults, setCurrentResults] = useState<AirbnbListing[]>([])
  const [showSidebar, setShowSidebar] = useState(false)
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null)
  
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)



  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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

  // Clear search history
  const clearHistory = () => {
    setSearchHistory([])
    localStorage.removeItem('airbnb-search-history')
  }

  // Start new chat
  const startNewChat = () => {
    setMessages([])
    setCurrentResults([])
    setShowResults(false)
    setCurrentPage(1)
    setHasMore(false)
    setCurrentQuery('')
    setSearchQuery('')
    setSearchContext(null)
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

    // Enhanced NLP Analysis
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
      const searchPayload: Record<string, unknown> = {
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
      
      // Capture search context on first search for followup queries using NLP
      if (page === 1) {
        if (!searchContext) {
          // Extract context using NLP analysis instead of hardcoded patterns
          const extractedContext = extractSearchContextFromNLP(nlpAnalysis)
          setSearchContext(extractedContext)
          console.log('Captured search context using NLP:', extractedContext)
        } else {
          // Update context with new parameters from followup query using NLP
          const updatedContext = updateSearchContextFromNLP(searchContext, nlpAnalysis)
          setSearchContext(updatedContext)
          console.log('Updated search context using NLP for query "' + query + '":', updatedContext)
          console.log('Original context was:', searchContext)
        }
      }
      
      // Apply intelligent NLP-based filtering
      const filteredResults = applyIntelligentFilters(searchResults, nlpAnalysis, searchContext)
      
      setCurrentPage(page)
      setHasMore(data.hasMore || false)
      setCurrentQuery(query)
      
      // Generate intelligent response using NLP analysis
      let responseContent = ''
      
      // Use AI enhancement for complex queries (if available)
      if (shouldEnhanceWithAI(query, nlpAnalysis) && filteredResults.length > 0) {
        try {
          const aiEnhanced = await enhanceWithAI(query, nlpAnalysis, tripContext, filteredResults)
          responseContent = aiEnhanced.personalizedMessage
          
          // Add AI insights if available
          if (aiEnhanced.insights.length > 0) {
            responseContent += `\n\n💡 ${aiEnhanced.insights[0]}`
          }
        } catch (error) {
          console.log('AI enhancement failed, using fallback response:', error)
          // Fall back to standard response with NLP enhancement
          responseContent = generateConversationalResponse(nlpAnalysis, tripContext, filteredResults.length)
        }
      } else {
        // Use NLP-enhanced conversational response
        responseContent = generateConversationalResponse(nlpAnalysis, tripContext, filteredResults.length)
      }
      
      // Add standard navigation hint
      if (filteredResults.length > 0) {
        responseContent += ' Check the results panel →'  
      }
      
      // Add suggestions if query could be more complete
      if (nlpAnalysis.completeness.score < 0.7 && nlpAnalysis.suggestions.length > 0) {
        responseContent += `\n\n${nlpAnalysis.suggestions[0]}`
      }
      
      const followUpSuggestions = generateFollowUps(filteredResults, query, nlpAnalysis)
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseContent,
        followUps: followUpSuggestions,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

      setCurrentResults(filteredResults)
      setShowResults(true)
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

  const handleNextPage = () => {
    if (hasMore && !loading && currentQuery) {
      handleSearch(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1 && !loading && currentQuery) {
      handleSearch(currentPage - 1)
    }
  }


  return (
    <Box h="100vh" bg="green.25" display="flex" flexDirection="row">
      {/* Main Sidebar */}
      <Box 
        w={showSidebar ? "300px" : "60px"} 
        bg="white" 
        borderRight="1px" 
        borderColor="gray.200"
        transition="width 0.3s ease"
        display="flex"
        flexDirection="column"
      >
        {/* Sidebar Header */}
        <Box p={3} borderBottom="1px" borderColor="gray.200">
          {showSidebar ? (
            <VStack align="stretch" gap={3}>
              <HStack justify="space-between" align="center">
                <HStack gap={2}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowSidebar(!showSidebar)}
                    color="gray.600"
                    _hover={{ bg: "gray.50" }}
                    px={2}
                  >
                    <Icon as={Menu} w={4} h={4} />
                  </Button>
                  
                  <Text 
                    fontSize="lg" 
                    fontWeight="600" 
                    color="gray.800"
                    cursor="pointer"
                    onClick={() => window.location.reload()}
                  >
                    ChatBnb
                  </Text>
                </HStack>
              </HStack>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={startNewChat}
                color="gray.600"
                _hover={{ bg: "gray.50" }}
                px={3}
                w="full"
                justifyContent="flex-start"
              >
                <Icon as={Plus} w={4} h={4} mr={2} />
                New chat
              </Button>
            </VStack>
          ) : (
            <VStack gap={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSidebar(!showSidebar)}
                color="gray.600"
                _hover={{ bg: "gray.50" }}
                px={2}
                w="full"
              >
                <Icon as={Menu} w={4} h={4} />
              </Button>
              
              <Button
                size="sm"
                variant="ghost"
                onClick={startNewChat}
                color="gray.600"
                _hover={{ bg: "gray.50" }}
                px={2}
                w="full"
              >
                <Icon as={Plus} w={4} h={4} />
              </Button>
            </VStack>
          )}
        </Box>

        {/* Sidebar Content */}
        {showSidebar && (
          <>
            <Box flex="1" overflow="auto" p={3}>
              <VStack align="stretch" gap={2}>
                <Text fontSize="xs" fontWeight="500" color="gray.500" textTransform="uppercase" mb={2}>
                  Recent Searches
                </Text>
                
                {searchHistory.length === 0 ? (
                  <Text fontSize="sm" color="gray.500" textAlign="center" mt={4}>
                    No searches yet
                  </Text>
                ) : (
                  searchHistory.map((item) => (
                    <Box
                      key={item.id}
                      p={3}
                      bg="gray.50"
                      borderRadius="md"
                      cursor="pointer"
                      _hover={{ bg: "gray.100" }}
                      onClick={() => {
                        setSearchQuery(item.query)
                        setShowSidebar(false)
                      }}
                    >
                      <Text fontSize="sm" color="gray.800" lineHeight="1.4" lineClamp={2}>
                        {item.query}
                      </Text>
                      <HStack justify="space-between" mt={2}>
                        <HStack gap={1}>
                          <Icon as={Clock} w={3} h={3} color="gray.400" />
                          <Text fontSize="xs" color="gray.500">
                            {item.timestamp.toLocaleDateString()}
                          </Text>
                        </HStack>
                        <Text fontSize="xs" color="gray.500">
                          {item.resultCount} results
                        </Text>
                      </HStack>
                    </Box>
                  ))
                )}
              </VStack>
            </Box>
            
            {searchHistory.length > 0 && (
              <Box p={3} borderTop="1px" borderColor="gray.200">
                <Button
                  size="sm"
                  variant="outline"
                  w="full"
                  onClick={clearHistory}
                  borderColor="gray.300"
                  color="gray.600"
                  _hover={{ bg: "gray.50" }}
                >
                  Clear History
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Main Chat Content */}
      <Box flex="1" display="flex" flexDirection="column" minW="0">
        {/* Header with controls */}
        <Box p={3} borderBottom="1px" borderColor="gray.200" bg="white">
          <HStack justify="space-between" align="center">
            <HStack gap={3} align="center">
              {currentQuery && (
                <Text fontSize="sm" color="gray.600" maxW="2xl" lineClamp={1}>
                  {currentQuery}
                </Text>
              )}
            </HStack>
            
            {showResults && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResults(!showResults)}
                borderColor="gray.300"
                color="gray.600"
                _hover={{ bg: "gray.50" }}
              >
                <Icon as={Home} w={4} h={4} mr={2} />
                {showResults ? 'Hide Results' : 'Show Results'} ({currentResults.length})
              </Button>
            )}
          </HStack>
        </Box>

        {/* Chat Messages */}
        <Box 
          flex="1" 
          overflow="auto" 
          ref={chatContainerRef}
          display="flex"
          flexDirection="column"
        >
        {messages.length === 0 ? (
          <Flex flex="1" align="center" justify="center" direction="column" px={4}>
            <Box textAlign="center" mb={12}>
              <HStack justify="center" mb={4}>
                <Icon as={Home} w={8} h={8} color="gray.600" />
                <Text fontSize="3xl" color="gray.800" fontWeight="500">
                  ChatBnb
                </Text>
              </HStack>
              <Text fontSize="lg" color="gray.500" mb={12} maxW="md" mx="auto" lineHeight="1.6">
                Describe what you're looking for in plain English
              </Text>
            </Box>

            {/* Chat Input - Centered */}
            <Box w="full" maxW="2xl" mb={8}>
              <HStack gap={3}>
                <Textarea
                  placeholder="Beach house in Malibu, dog-friendly cabin, modern loft downtown..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSearch()
                    }
                  }}
                  resize="none"
                  minH="52px"
                  maxH="120px"
                  bg="white"
                  border="1px"
                  borderColor="gray.300"
                  _focus={{
                    borderColor: "green.500",
                    boxShadow: "0 0 0 3px rgba(72, 187, 120, 0.1)"
                  }}
                  _hover={{ borderColor: "gray.400" }}
                  borderRadius="xl"
                  py={4}
                  px={4}
                  fontSize="md"
                />
                <Button
                  onClick={() => handleSearch()}
                  disabled={!searchQuery.trim() || loading}
                  size="md"
                  bg="green.600"
                  color="white"
                  _hover={{ bg: "green.700" }}
                  _disabled={{ 
                    bg: "gray.300",
                    color: "gray.500"
                  }}
                  borderRadius="xl"
                  px={6}
                  h="52px"
                >
                  <Icon as={Send} w={4} h={4} />
                </Button>
              </HStack>
            </Box>

            {/* Example searches */}
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.500" mb={4}>Ask complex questions in plain English:</Text>
              <Flex gap={3} flexWrap="wrap" justify="center" maxW="4xl">
                {[
                  "Luxury beachfront villa in Malibu for 6 people with pool, superhost only",
                  "Dog-friendly cabin near Yellowstone under $150 with 4.8+ rating", 
                  "Modern downtown loft in Chicago with parking, entire home under $200",
                  "Family cottage near Disney World with kitchen, well-reviewed, quiet area",
                  "Romantic getaway in Napa Valley, private hot tub, superhost, luxury only",
                  "Group house in Austin for 10 people, pool table, close to downtown"
                ].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery(example)}
                    borderColor="gray.300"
                    color="gray.700"
                    _hover={{ 
                      bg: "gray.50",
                      borderColor: "gray.400"
                    }}
                    borderRadius="md"
                    px={4}
                    py={3}
                    h="auto"
                    whiteSpace="normal"
                    textAlign="left"
                    maxW="300px"
                  >
                    {example}
                  </Button>
                ))}
              </Flex>
            </Box>
          </Flex>
        ) : (
          <Box maxW="3xl" mx="auto" px={4} py={6} w="full">
            {/* Chat Messages */}
            {messages.map((message) => (
              <Box key={message.id} mb={8}>
              {message.type === 'user' ? (
                <Flex justify="flex-end">
                  <Box
                    bg="green.500"
                    px={4}
                    py={3}
                    borderRadius="xl"
                    maxW="80%"
                  >
                    <Text fontSize="md" color="white">{message.content}</Text>
                  </Box>
                </Flex>
              ) : (
                <Box>
                  <Text fontSize="md" color="gray.800" mb={4} lineHeight="1.6">
                    {message.content}
                  </Text>
                </Box>
                )}

                {/* Follow-up Suggestions - Outside the main content */}
                {message.type === 'assistant' && message.followUps && message.followUps.length > 0 && (
                  <Box mt={4}>
                    <Text fontSize="sm" color="gray.600" mb={3}>You might also want to:</Text>
                    <Flex gap={2} flexWrap="wrap">
                      {message.followUps.map((followUp, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery(followUp)
                            // Automatically trigger search after setting query
                            setTimeout(() => handleSearch(), 100)
                          }}
                          borderColor="green.200"
                          color="green.700"
                          _hover={{ 
                            bg: "green.50",
                            borderColor: "green.300"
                          }}
                          borderRadius="full"
                          px={3}
                          fontSize="xs"
                        >
                          {followUp}
                        </Button>
                      ))}
                    </Flex>
                  </Box>
                )}
              </Box>
          ))}

          {/* Loading indicator */}
          {loading && (
            <Box mb={8}>
              <HStack>
                <Spinner size="sm" color="green.500" />
                <Text fontSize="md" color="gray.600">Searching for properties...</Text>
              </HStack>
            </Box>
          )}

            <div ref={messagesEndRef} />
          </Box>
        )}
      </Box>

        {/* Chat Input - Only show when there are messages */}
        {messages.length > 0 && (
        <Box bg="white" px={4} py={4} borderTop="1px" borderColor="gray.200">
          <Box maxW="3xl" mx="auto">
            <HStack gap={3}>
              <Textarea
                placeholder="Ask for more properties or refine your search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                resize="none"
                minH="44px"
                maxH="120px"
                bg="white"
                border="1px"
                borderColor="gray.300"
                _focus={{
                  borderColor: "green.500",
                  boxShadow: "0 0 0 3px rgba(72, 187, 120, 0.1)"
                }}
                _hover={{ borderColor: "gray.400" }}
                borderRadius="xl"
                py={3}
                px={4}
                fontSize="md"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={!searchQuery.trim() || loading}
                size="md"
                bg="green.600"
                color="white"
                _hover={{ bg: "green.700" }}
                _disabled={{ 
                  bg: "gray.300",
                  color: "gray.500"
                }}
                borderRadius="xl"
                px={4}
                h="44px"
              >
                <Icon as={Send} w={4} h={4} />
              </Button>
            </HStack>
          </Box>
        </Box>
      )}
      </Box>

      {/* Results Panel */}
      <Box 
        w={showResults ? "400px" : "0"} 
        bg="white" 
        borderLeft="1px" 
        borderColor="gray.200"
        transition="width 0.3s ease"
        overflow="hidden"
        display="flex"
        flexDirection="column"
      >
        {showResults && (
          <>
            <Box p={4} borderBottom="1px" borderColor="gray.200">
              <HStack justify="space-between" align="center">
                <HStack gap={2}>
                  <Icon as={Home} w={4} h={4} color="gray.600" />
                  <Text fontSize="sm" fontWeight="500" color="gray.700">
                    Properties ({currentResults.length})
                  </Text>
                </HStack>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowResults(false)}
                >
                  <Icon as={X} w={3} h={3} />
                </Button>
              </HStack>
            </Box>
            
            <Box flex="1" overflow="auto" p={4}>
              {currentResults.length === 0 ? (
                <Text fontSize="sm" color="gray.500" textAlign="center" mt={4}>
                  No properties to display
                </Text>
              ) : (
                <VStack gap={4} align="stretch">
                  {currentResults.map((listing) => (
                    <Box
                      key={listing.id}
                      border="1px"
                      borderColor="gray.200"
                      borderRadius="md"
                      overflow="hidden"
                      bg="gray.50"
                      _hover={{ 
                        borderColor: 'gray.300',
                        bg: 'white'
                      }}
                      transition="all 0.2s"
                    >
                      <Box p={3}>
                        <VStack align="start" gap={2}>
                          <Text fontWeight="600" color="gray.900" lineHeight="1.3" fontSize="sm" lineClamp={2}>
                            {listing.name}
                          </Text>
                          
                          <HStack justify="space-between" w="full">
                            <HStack gap={1}>
                              <Icon as={MapPin} color="gray.400" w={3} h={3} />
                              <Text fontSize="xs" color="gray.600" lineClamp={1}>
                                {listing.location.city}
                              </Text>
                            </HStack>
                            <HStack gap={1}>
                              <Icon as={Star} color="yellow.400" w={3} h={3} />
                              <Text fontSize="xs" color="gray.600">
                                {listing.rating}
                              </Text>
                            </HStack>
                          </HStack>


                          <HStack justify="space-between" w="full" align="center">
                            <VStack align="start" gap={0}>
                              <Text fontSize="xs" color="gray.500">
                                {listing.roomType}
                              </Text>
                              <Text fontWeight="600" color="gray.900" fontSize="sm">
                                ${listing.price.rate}/night
                              </Text>
                            </VStack>
                            
                            <VStack align="end" gap={1}>
                              {listing.host.isSuperhost && (
                                <HStack gap={1}>
                                  <Icon as={Crown} w={2} h={2} color="yellow.400" />
                                  <Text fontSize="xs" color="gray.500">Host</Text>
                                </HStack>
                              )}
                              <Link href={listing.url} target="_blank" rel="noopener noreferrer">
                                <Button
                                  size="xs"
                                  variant="outline"
                                  borderColor="gray.300"
                                  _hover={{ bg: "gray.50" }}
                                >
                                  View
                                  <Icon as={ExternalLink} ml={1} w={2} h={2} />
                                </Button>
                              </Link>
                            </VStack>
                          </HStack>
                        </VStack>
                      </Box>
                    </Box>
                  ))}
                </VStack>
              )}
            </Box>
            
            {/* Pagination in results panel */}
            {currentResults.length > 0 && (
              <Box p={3} borderTop="1px" borderColor="gray.200">
                <Flex justify="space-between" align="center">
                  <Text fontSize="xs" color="gray.500">
                    Page {currentPage}
                  </Text>
                  <HStack gap={1}>
                    <Button 
                      size="xs" 
                      variant="outline"
                      onClick={handlePrevPage}
                      disabled={currentPage === 1 || loading}
                      borderColor="gray.300"
                      _hover={{ bg: "gray.50" }}
                    >
                      ←
                    </Button>
                    <Button 
                      size="xs" 
                      variant="outline"
                      onClick={handleNextPage}
                      disabled={!hasMore || loading}
                      borderColor="gray.300"
                      _hover={{ bg: "gray.50" }}
                    >
                      →
                    </Button>
                  </HStack>
                </Flex>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}

export default App