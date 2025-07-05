import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Box,
  Text,
  Button,
  SimpleGrid,
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
  Home
} from 'lucide-react'
import { searchAirbnbListings, type AirbnbListing } from './services/airbnbService'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant'
  content: string
  listings?: AirbnbListing[]
  timestamp: Date
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [currentQuery, setCurrentQuery] = useState('')
  
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Get current listings from the latest assistant message
  const currentListings = useMemo(() => {
    const latestAssistantMessage = messages
      .filter(m => m.type === 'assistant' && m.listings)
      .slice(-1)[0]
    return latestAssistantMessage?.listings || []
  }, [messages])


  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Apply natural language filters to listings
  const applyNaturalLanguageFilters = (listings: AirbnbListing[], query: string) => {
    const lowerQuery = query.toLowerCase()
    let filtered = [...listings]

    // Rating & Review Filters
    if (lowerQuery.includes('superhost') || lowerQuery.includes('super host')) {
      filtered = filtered.filter(listing => listing.host.isSuperhost)
    }
    
    if (lowerQuery.includes('high rated') || lowerQuery.includes('highly rated')) {
      filtered = filtered.filter(listing => listing.rating >= 4.5)
    }
    
    if (lowerQuery.includes('well reviewed') || lowerQuery.includes('lots of reviews')) {
      filtered = filtered.filter(listing => listing.reviewsCount >= 20)
    }
    
    if (lowerQuery.includes('new listing') || lowerQuery.includes('recently added')) {
      filtered = filtered.filter(listing => listing.reviewsCount < 5)
    }

    // Check for rating thresholds
    const ratingMatch = lowerQuery.match(/(\d\.?\d?)\+?\s*rating|rating\s*(\d\.?\d?)\+?|above\s*(\d\.?\d?)|over\s*(\d\.?\d?)/)
    if (ratingMatch) {
      const minRating = parseFloat(ratingMatch[1] || ratingMatch[2] || ratingMatch[3] || ratingMatch[4])
      if (minRating && minRating >= 3 && minRating <= 5) {
        filtered = filtered.filter(listing => listing.rating >= minRating)
      }
    }

    // Check for review count thresholds
    const reviewMatch = lowerQuery.match(/(\d+)\+?\s*reviews?|reviews?\s*(\d+)\+?|above\s*(\d+)\s*reviews?|over\s*(\d+)\s*reviews?/)
    if (reviewMatch) {
      const minReviews = parseInt(reviewMatch[1] || reviewMatch[2] || reviewMatch[3] || reviewMatch[4])
      if (minReviews && minReviews > 0) {
        filtered = filtered.filter(listing => listing.reviewsCount >= minReviews)
      }
    }

    // Price Range Filters
    if (lowerQuery.includes('budget') || lowerQuery.includes('cheap') || lowerQuery.includes('affordable')) {
      filtered = filtered.filter(listing => listing.price.rate <= 150)
    }
    
    if (lowerQuery.includes('luxury') || lowerQuery.includes('high-end') || lowerQuery.includes('upscale')) {
      filtered = filtered.filter(listing => listing.price.rate >= 300)
    }
    
    if (lowerQuery.includes('mid-range') || lowerQuery.includes('moderate')) {
      filtered = filtered.filter(listing => listing.price.rate >= 100 && listing.price.rate <= 250)
    }

    // Check for price under/below thresholds
    const priceUnderMatch = lowerQuery.match(/under\s*\$?(\d+)|below\s*\$?(\d+)|less\s*than\s*\$?(\d+)|cheaper\s*than\s*\$?(\d+)/)
    if (priceUnderMatch) {
      const maxPrice = parseInt(priceUnderMatch[1] || priceUnderMatch[2] || priceUnderMatch[3] || priceUnderMatch[4])
      if (maxPrice && maxPrice > 0) {
        filtered = filtered.filter(listing => listing.price.rate <= maxPrice)
      }
    }

    // Check for price over/above thresholds
    const priceOverMatch = lowerQuery.match(/over\s*\$?(\d+)|above\s*\$?(\d+)|more\s*than\s*\$?(\d+)|expensive\s*than\s*\$?(\d+)/)
    if (priceOverMatch) {
      const minPrice = parseInt(priceOverMatch[1] || priceOverMatch[2] || priceOverMatch[3] || priceOverMatch[4])
      if (minPrice && minPrice > 0) {
        filtered = filtered.filter(listing => listing.price.rate >= minPrice)
      }
    }

    // Check for price range (e.g., "$100-200", "between $150 and $300")
    const priceRangeMatch = lowerQuery.match(/\$?(\d+)\s*[-–—]\s*\$?(\d+)|between\s*\$?(\d+)\s*and\s*\$?(\d+)/)
    if (priceRangeMatch) {
      const minPrice = parseInt(priceRangeMatch[1] || priceRangeMatch[3])
      const maxPrice = parseInt(priceRangeMatch[2] || priceRangeMatch[4])
      if (minPrice && maxPrice && minPrice < maxPrice) {
        filtered = filtered.filter(listing => listing.price.rate >= minPrice && listing.price.rate <= maxPrice)
      }
    }

    return filtered
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

    try {
      const searchResults = await searchAirbnbListings(query, page)
      
      // Apply natural language filters
      const filteredResults = applyNaturalLanguageFilters(searchResults, query)
      
      setCurrentPage(page)
      setHasMore(searchResults.length === 18) // Assume more if we got full page
      setCurrentQuery(query)
      
      // Create response message based on filtering
      let responseContent = ''
      if (filteredResults.length === searchResults.length) {
        responseContent = page === 1 
          ? `I found ${searchResults.length} properties that match "${query}". Here are your options:`
          : `Here are ${searchResults.length} more properties for "${query}" (page ${page}):`
      } else {
        responseContent = page === 1
          ? `I found ${searchResults.length} properties and filtered them to ${filteredResults.length} that best match "${query}". Here are your options:`
          : `Here are ${filteredResults.length} filtered properties from ${searchResults.length} results for "${query}" (page ${page}):`
      }
      
      // Add assistant response with results
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseContent,
        listings: filteredResults,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])

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
    <Box h="100vh" bg="slate.50" display="flex" flexDirection="column">
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
                <Icon as={Home} w={8} h={8} color="slate.600" />
                <Text fontSize="3xl" color="slate.800" fontWeight="500">
                  Find your perfect Airbnb
                </Text>
              </HStack>
              <Text fontSize="lg" color="slate.500" mb={12} maxW="md" mx="auto" lineHeight="1.6">
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
                  bg="slate.25"
                  border="1px"
                  borderColor="slate.300"
                  _focus={{
                    borderColor: "emerald.500",
                    boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.1)"
                  }}
                  _hover={{ borderColor: "slate.400" }}
                  borderRadius="xl"
                  py={4}
                  px={4}
                  fontSize="md"
                />
                <Button
                  onClick={() => handleSearch()}
                  disabled={!searchQuery.trim() || loading}
                  size="md"
                  bg="emerald.600"
                  color="white"
                  _hover={{ bg: "emerald.700" }}
                  _disabled={{ 
                    bg: "slate.300",
                    color: "slate.500"
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
              <Text fontSize="sm" color="slate.500" mb={4}>Try asking for:</Text>
              <Flex gap={3} flexWrap="wrap" justify="center" maxW="lg">
                {[
                  "Budget beachfront under $150",
                  "Luxury villa superhost above $300", 
                  "Mid-range loft $100-250",
                  "Affordable cabin well reviewed"
                ].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery(example)}
                    borderColor="slate.300"
                    color="slate.700"
                    _hover={{ 
                      bg: "slate.50",
                      borderColor: "slate.400"
                    }}
                    borderRadius="full"
                    px={4}
                  >
                    {example}
                  </Button>
                ))}
              </Flex>
            </Box>
          </Flex>
        ) : (
          <Box maxW="3xl" mx="auto" px={4} py={6} w="full" bg="white" borderRadius="lg" my={4} border="1px" borderColor="slate.200">

          {/* Chat Messages */}
          {messages.map((message) => (
            <Box key={message.id} mb={8}>
              {message.type === 'user' ? (
                <Flex justify="flex-end">
                  <Box
                    bg="emerald.500"
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
                    <Text fontSize="md" color="slate.800" mb={4} lineHeight="1.6">
                      {message.content}
                    </Text>
                        
                    {/* Show listings if present */}
                    {message.listings && (
                      <Box w="full">

                        {/* Property Grid */}
                        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                          {currentListings.map((listing) => (
                            <Box 
                              key={listing.id} 
                              border="1px" 
                              borderColor="slate.200"
                              borderRadius="md"
                              overflow="hidden"
                              bg="white"
                              _hover={{ 
                                borderColor: 'slate.300'
                              }}
                              transition="border-color 0.2s"
                            >
                              <Box p={4}>
                                <VStack align="start" gap={3}>
                                  <Text fontWeight="600" color="slate.900" lineHeight="1.4" lineClamp={2}>
                                    {listing.name}
                                  </Text>
                                  
                                  <HStack justify="space-between" w="full">
                                    <HStack gap={1}>
                                      <Icon as={MapPin} color="slate.400" w={4} h={4} />
                                      <Text fontSize="sm" color="slate.600">
                                        {listing.location.country ? 
                                          `${listing.location.city}, ${listing.location.country}` : 
                                          listing.location.city
                                        }
                                      </Text>
                                    </HStack>
                                    <HStack gap={1}>
                                      <Icon as={Star} color="amber.400" w={4} h={4} />
                                      <Text fontSize="sm" color="slate.600">
                                        {listing.rating} ({listing.reviewsCount})
                                      </Text>
                                    </HStack>
                                  </HStack>

                                  <HStack justify="space-between" w="full" align="center">
                                    <VStack align="start" gap={1}>
                                      <Text fontSize="sm" color="slate.500">
                                        {listing.roomType}
                                      </Text>
                                      <Text fontWeight="600" color="slate.900">
                                        ${listing.price.rate}/night
                                      </Text>
                                    </VStack>
                                    
                                    <VStack align="end" gap={1}>
                                      {listing.host.isSuperhost && (
                                        <HStack gap={1}>
                                          <Icon as={Crown} w={3} h={3} color="amber.400" />
                                          <Text fontSize="xs" color="slate.500">Superhost</Text>
                                        </HStack>
                                      )}
                                      <Link href={listing.url} target="_blank" rel="noopener noreferrer">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          borderColor="slate.300"
                                          _hover={{ bg: "slate.50" }}
                                        >
                                          View
                                          <Icon as={ExternalLink} ml={1} w={3} h={3} />
                                        </Button>
                                      </Link>
                                    </VStack>
                                  </HStack>
                                </VStack>
                              </Box>
                            </Box>
                          ))}
                        </SimpleGrid>

                        {/* Pagination Controls */}
                        {currentListings.length > 0 && (
                          <Box mt={6} pt={4} borderTop="1px" borderColor="slate.200">
                            <Flex justify="space-between" align="center" flexWrap="wrap" gap={4}>
                              <Text fontSize="sm" color="slate.500">
                                Page {currentPage} • {currentListings.length} properties
                              </Text>
                              <HStack>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={handlePrevPage}
                                  disabled={currentPage === 1 || loading}
                                  borderColor="slate.300"
                                  _hover={{ bg: "gray.50" }}
                                >
                                  ← Previous
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={handleNextPage}
                                  disabled={!hasMore || loading}
                                  borderColor="slate.300"
                                  _hover={{ bg: "gray.50" }}
                                >
                                  Next →
                                </Button>
                              </HStack>
                            </Flex>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
          ))}

          {/* Loading indicator */}
          {loading && (
            <Box mb={8}>
              <HStack>
                <Spinner size="sm" color="emerald.500" />
                <Text fontSize="md" color="slate.600">Searching for properties...</Text>
              </HStack>
            </Box>
          )}

            <div ref={messagesEndRef} />
          </Box>
        )}
      </Box>

      {/* Chat Input - Only show when there are messages */}
      {messages.length > 0 && (
        <Box bg="white" px={4} py={4} borderTop="1px" borderColor="slate.200">
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
                borderColor="slate.300"
                _focus={{
                  borderColor: "emerald.500",
                  boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.1)"
                }}
                _hover={{ borderColor: "slate.400" }}
                borderRadius="xl"
                py={3}
                px={4}
                fontSize="md"
              />
              <Button
                onClick={() => handleSearch()}
                disabled={!searchQuery.trim() || loading}
                size="md"
                bg="emerald.600"
                color="white"
                _hover={{ bg: "emerald.700" }}
                _disabled={{ 
                  bg: "slate.300",
                  color: "slate.500"
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
  )
}

export default App