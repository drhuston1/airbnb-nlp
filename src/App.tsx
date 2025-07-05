import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Box,
  Text,
  Input,
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
  Send
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
  
  // Filter states
  const [minRating, setMinRating] = useState(0)
  const [minReviews, setMinReviews] = useState(0)
  
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

  // Filter listings based on client-side criteria
  const filteredListings = useMemo(() => {
    return currentListings.filter(listing => 
      listing.rating >= minRating && listing.reviewsCount >= minReviews
    )
  }, [currentListings, minRating, minReviews])

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

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
      setCurrentPage(page)
      setHasMore(searchResults.length === 18) // Assume more if we got full page
      setCurrentQuery(query)
      
      // Add assistant response with results
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: page === 1 
          ? `I found ${searchResults.length} properties that match "${query}". Here are your options:`
          : `Here are ${searchResults.length} more properties for "${query}" (page ${page}):`,
        listings: searchResults,
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
    <Box h="100vh" bg="white" display="flex" flexDirection="column">
      {/* Chat Header */}
      <Box bg="white" px={4} py={3} borderBottom="1px" borderColor="gray.200">
        <Flex justify="center">
          <Text fontSize="lg" fontWeight="600" color="gray.900">ChatAirbnb</Text>
        </Flex>
      </Box>

      {/* Chat Messages */}
      <Box 
        flex="1" 
        overflow="auto" 
        ref={chatContainerRef}
      >
        <Box maxW="3xl" mx="auto" px={4} py={6}>
          {messages.length === 0 && (
            <Box textAlign="center" py={20}>
              <Text fontSize="xl" color="gray.600" mb={8} maxW="md" mx="auto" lineHeight="1.6">
                Find your perfect Airbnb by describing what you're looking for in plain English.
              </Text>
              
              {/* Example searches */}
              <VStack gap={3} align="stretch" maxW="sm" mx="auto">
                {[
                  "Beachfront villa with pool for family reunion",
                  "Dog-friendly cabin near hiking trails", 
                  "Modern loft in downtown for business trip",
                  "Romantic cottage with hot tub under $200/night"
                ].map((example) => (
                  <Button
                    key={example}
                    variant="ghost"
                    onClick={() => setSearchQuery(example)}
                    py={6}
                    h="auto"
                    whiteSpace="normal"
                    textAlign="left"
                    justifyContent="flex-start"
                    fontWeight="400"
                    color="gray.700"
                    _hover={{ 
                      bg: "gray.50",
                      color: "gray.900"
                    }}
                    borderRadius="lg"
                  >
                    {example}
                  </Button>
                ))}
              </VStack>
            </Box>
          )}

          {/* Chat Messages */}
          {messages.map((message) => (
            <Box key={message.id} mb={8}>
              {message.type === 'user' ? (
                <Flex justify="flex-end">
                  <Box
                    bg="gray.100"
                    px={4}
                    py={3}
                    borderRadius="xl"
                    maxW="80%"
                  >
                    <Text fontSize="md" color="gray.900">{message.content}</Text>
                  </Box>
                </Flex>
              ) : (
                <Box>
                    <Text fontSize="md" color="gray.900" mb={4} lineHeight="1.6">
                      {message.content}
                    </Text>
                        
                    {/* Show listings if present */}
                    {message.listings && (
                      <Box w="full">
                        {/* Quality Filters */}
                        {currentListings.length > 0 && (
                          <Box p={4} bg="gray.50" borderRadius="md" mb={6}>
                            <Text fontSize="sm" fontWeight="500" color="gray.700" mb={3}>
                              Refine Results
                              {(minRating > 0 || minReviews > 0) && (
                                <Text as="span" ml={2} color="gray.500">
                                  • {filteredListings.length} matches
                                </Text>
                              )}
                            </Text>
                            
                            <Flex gap={3} flexWrap="wrap" w="full" align="end">
                              <Box>
                                <Text fontSize="xs" color="gray.600" mb={1}>Min Rating</Text>
                                <Input
                                  type="number"
                                  value={minRating}
                                  onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)}
                                  min={0}
                                  max={5}
                                  step={0.1}
                                  size="sm"
                                  w="20"
                                  bg="white"
                                  border="1px"
                                  borderColor="gray.300"
                                />
                              </Box>
                              
                              <Box>
                                <Text fontSize="xs" color="gray.600" mb={1}>Min Reviews</Text>
                                <Input
                                  type="number"
                                  value={minReviews}
                                  onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
                                  min={0}
                                  size="sm"
                                  w="20"
                                  bg="white"
                                  border="1px"
                                  borderColor="gray.300"
                                />
                              </Box>
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setMinRating(4.9)
                                  setMinReviews(20)
                                }}
                                borderColor="gray.300"
                              >
                                High Quality
                              </Button>
                              
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  setMinRating(0)
                                  setMinReviews(0)
                                }}
                                borderColor="gray.300"
                              >
                                Clear
                              </Button>
                            </Flex>
                          </Box>
                        )}

                        {/* Property Grid */}
                        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                          {filteredListings.map((listing) => (
                            <Box 
                              key={listing.id} 
                              border="1px" 
                              borderColor="gray.200"
                              borderRadius="md"
                              overflow="hidden"
                              _hover={{ 
                                borderColor: 'gray.300'
                              }}
                              transition="border-color 0.2s"
                            >
                              <Box p={4}>
                                <VStack align="start" gap={3}>
                                  <Text fontWeight="600" color="gray.900" lineHeight="1.4" lineClamp={2}>
                                    {listing.name}
                                  </Text>
                                  
                                  <HStack justify="space-between" w="full">
                                    <HStack gap={1}>
                                      <Icon as={MapPin} color="gray.400" w={4} h={4} />
                                      <Text fontSize="sm" color="gray.600">
                                        {listing.location.country ? 
                                          `${listing.location.city}, ${listing.location.country}` : 
                                          listing.location.city
                                        }
                                      </Text>
                                    </HStack>
                                    <HStack gap={1}>
                                      <Icon as={Star} color="gray.400" w={4} h={4} />
                                      <Text fontSize="sm" color="gray.600">
                                        {listing.rating} ({listing.reviewsCount})
                                      </Text>
                                    </HStack>
                                  </HStack>

                                  <HStack justify="space-between" w="full" align="center">
                                    <VStack align="start" gap={1}>
                                      <Text fontSize="sm" color="gray.500">
                                        {listing.roomType}
                                      </Text>
                                      <Text fontWeight="600" color="gray.900">
                                        ${listing.price.rate}/night
                                      </Text>
                                    </VStack>
                                    
                                    <VStack align="end" gap={1}>
                                      {listing.host.isSuperhost && (
                                        <HStack gap={1}>
                                          <Icon as={Crown} w={3} h={3} color="gray.400" />
                                          <Text fontSize="xs" color="gray.500">Superhost</Text>
                                        </HStack>
                                      )}
                                      <Link href={listing.url} target="_blank" rel="noopener noreferrer">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          borderColor="gray.300"
                                          _hover={{ bg: "gray.50" }}
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
                          <Box mt={6} pt={4} borderTop="1px" borderColor="gray.200">
                            <Flex justify="space-between" align="center" flexWrap="wrap" gap={4}>
                              <Text fontSize="sm" color="gray.500">
                                Page {currentPage} • {filteredListings.length} properties
                                {(minRating > 0 || minReviews > 0) && currentListings.length !== filteredListings.length && 
                                  ` (${currentListings.length} total)`
                                }
                              </Text>
                              <HStack>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={handlePrevPage}
                                  disabled={currentPage === 1 || loading}
                                  borderColor="gray.300"
                                  _hover={{ bg: "gray.50" }}
                                >
                                  ← Previous
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={handleNextPage}
                                  disabled={!hasMore || loading}
                                  borderColor="gray.300"
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
                <Spinner size="sm" color="gray.400" />
                <Text fontSize="md" color="gray.600">Searching for properties...</Text>
              </HStack>
            </Box>
          )}

          <div ref={messagesEndRef} />
        </Box>
      </Box>

      {/* Chat Input */}
      <Box bg="white" px={4} py={4} borderTop="1px" borderColor="gray.200">
        <Box maxW="3xl" mx="auto">
          <HStack gap={3}>
            <Textarea
              placeholder="Describe the perfect place for your stay..."
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
                borderColor: "gray.400",
                boxShadow: "none"
              }}
              _hover={{ borderColor: "gray.400" }}
              borderRadius="md"
              py={3}
              px={3}
              fontSize="md"
            />
            <Button
              onClick={() => handleSearch()}
              disabled={!searchQuery.trim() || loading}
              size="md"
              bg="gray.900"
              color="white"
              _hover={{ bg: "gray.800" }}
              _disabled={{ 
                bg: "gray.300",
                color: "gray.500"
              }}
              borderRadius="md"
              px={4}
              minW="auto"
            >
              <Icon as={Send} w={4} h={4} />
            </Button>
          </HStack>
        </Box>
      </Box>
    </Box>
  )
}

export default App