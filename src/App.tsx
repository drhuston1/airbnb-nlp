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
                  "Beachfront villa with pool",
                  "Dog-friendly cabin", 
                  "Modern downtown loft",
                  "Romantic cottage under $200"
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