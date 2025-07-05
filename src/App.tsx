import { useState, useMemo, useRef, useEffect } from 'react'
import {
  Box,
  Container,
  Heading,
  Text,
  Input,
  Button,
  SimpleGrid,
  Badge,
  HStack,
  Spinner,
  Stack,
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
  Settings,
  ExternalLink,
  Send,
  Bot,
  User
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
    const currentQuery = searchQuery
    setSearchQuery('')

    try {
      const searchResults = await searchAirbnbListings(currentQuery, page)
      
      // Add assistant response with results
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I found ${searchResults.length} properties that match "${currentQuery}". Here are your options:`,
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


  return (
    <Box h="100vh" bg="gray.50" display="flex" flexDirection="column">
      {/* Chat Header */}
      <Box bg="white" px={6} py={4} borderBottom="1px" borderColor="gray.200" shadow="sm">
        <HStack>
          <Box bg="blue.500" borderRadius="full" w={8} h={8} display="flex" alignItems="center" justifyContent="center">
            <Icon as={Bot} color="white" w={4} h={4} />
          </Box>
          <VStack align="start" gap={0}>
            <Heading size="md" color="gray.900">ChatAirbnb</Heading>
            <Text fontSize="sm" color="gray.600">Your AI property search assistant</Text>
          </VStack>
        </HStack>
      </Box>

      {/* Chat Messages */}
      <Box 
        flex="1" 
        overflow="auto" 
        ref={chatContainerRef}
        px={{ base: 4, md: 6 }}
        py={6}
      >
        <Container maxW="4xl" mx="auto">
          <VStack gap={6} align="stretch">
            {messages.length === 0 && (
              <Box textAlign="center" py={12}>
                <Box bg="blue.500" borderRadius="full" w={16} h={16} display="flex" alignItems="center" justifyContent="center" mb={4} mx="auto">
                  <Icon as={Bot} color="white" w={8} h={8} />
                </Box>
                <Heading size="lg" mb={3} color="gray.800">
                  Hi! I'm your ChatAirbnb assistant
                </Heading>
                <Text fontSize="lg" color="gray.600" mb={8} maxW="2xl" mx="auto">
                  Tell me what kind of place you're looking for and I'll find the perfect properties for you.
                </Text>
                
                {/* Example searches */}
                <Box>
                  <Text fontSize="sm" fontWeight="500" color="gray.700" mb={4}>
                    Try these searches:
                  </Text>
                  <Flex gap={3} flexWrap="wrap" justify="center" maxW="3xl" mx="auto">
                    {[
                      "Beachfront villa with pool for family reunion",
                      "Dog-friendly cabin near hiking trails", 
                      "Modern loft in downtown for business trip",
                      "Romantic cottage with hot tub under $200/night"
                    ].map((example) => (
                      <Button
                        key={example}
                        size="sm"
                        variant="outline"
                        colorScheme="gray"
                        onClick={() => setSearchQuery(example)}
                        px={4}
                        py={2}
                        fontSize="sm"
                        fontWeight="500"
                        bg="white"
                        borderColor="gray.300"
                        _hover={{ 
                          bg: "blue.50", 
                          borderColor: "blue.300", 
                          color: "blue.700"
                        }}
                        transition="all 0.2s"
                        borderRadius="full"
                        shadow="sm"
                      >
                        {example}
                      </Button>
                    ))}
                  </Flex>
                </Box>
              </Box>
            )}

            {/* Chat Messages */}
            {messages.map((message) => (
              <Box key={message.id} w="full">
                {message.type === 'user' ? (
                  <Flex justify="flex-end" mb={4}>
                    <HStack maxW="80%" align="start" gap={3}>
                      <Box
                        bg="blue.500"
                        color="white"
                        px={4}
                        py={3}
                        borderRadius="2xl"
                        borderBottomRightRadius="md"
                        maxW="full"
                      >
                        <Text fontSize="md">{message.content}</Text>
                      </Box>
                      <Box bg="gray.300" borderRadius="full" w={8} h={8} display="flex" alignItems="center" justifyContent="center">
                        <Icon as={User} color="white" w={4} h={4} />
                      </Box>
                    </HStack>
                  </Flex>
                ) : (
                  <Flex justify="flex-start" mb={6}>
                    <HStack maxW="100%" align="start" gap={3}>
                      <Box bg="blue.500" borderRadius="full" w={8} h={8} display="flex" alignItems="center" justifyContent="center">
                        <Icon as={Bot} color="white" w={4} h={4} />
                      </Box>
                      <VStack align="start" gap={4} flex="1">
                        <Box
                          bg="white"
                          border="1px"
                          borderColor="gray.200"
                          px={4}
                          py={3}
                          borderRadius="2xl"
                          borderBottomLeftRadius="md"
                          shadow="sm"
                        >
                          <Text fontSize="md" color="gray.800">{message.content}</Text>
                        </Box>
                        
                        {/* Show listings if present */}
                        {message.listings && (
                          <Box w="full">
                            {/* Quality Filters */}
                            {currentListings.length > 0 && (
                              <Box p={4} bg="gray.50" borderRadius="lg" border="1px" borderColor="gray.200" mb={4}>
                                <HStack alignItems="center" mb={4}>
                                  <Icon as={Settings} color="gray.600" mr={2} />
                                  <Text fontSize="sm" fontWeight="600" color="gray.700">
                                    Refine Results
                                  </Text>
                                  {(minRating > 0 || minReviews > 0) && (
                                    <Badge colorScheme="purple" variant="subtle" fontSize="xs" px={2} py={1}>
                                      {filteredListings.length} matches
                                    </Badge>
                                  )}
                                </HStack>
                                
                                <Flex gap={3} flexWrap="wrap" w="full" align="end">
                                  <Box flex="1" minW="120px">
                                    <Text fontSize="xs" fontWeight="500" color="gray.600" mb={2}>Min Rating</Text>
                                    <Input
                                      type="number"
                                      value={minRating}
                                      onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)}
                                      min={0}
                                      max={5}
                                      step={0.1}
                                      size="sm"
                                      bg="white"
                                      h="32px"
                                    />
                                  </Box>
                                  
                                  <Box flex="1" minW="120px">
                                    <Text fontSize="xs" fontWeight="500" color="gray.600" mb={2}>Min Reviews</Text>
                                    <Input
                                      type="number"
                                      value={minReviews}
                                      onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
                                      min={0}
                                      size="sm"
                                      bg="white"
                                      h="32px"
                                    />
                                  </Box>
                                  
                                  <Button 
                                    size="sm" 
                                    colorScheme="purple" 
                                    variant="outline"
                                    onClick={() => {
                                      setMinRating(4.9)
                                      setMinReviews(20)
                                    }}
                                    h="32px"
                                    px={3}
                                  >
                                    <Icon as={Star} mr={1} />
                                    High Quality
                                  </Button>
                                  
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    colorScheme="gray"
                                    onClick={() => {
                                      setMinRating(0)
                                      setMinReviews(0)
                                    }}
                                    h="32px"
                                    px={3}
                                  >
                                    Clear
                                  </Button>
                                </Flex>
                              </Box>
                            )}

                            {/* Property Grid */}
                            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
                              {filteredListings.map((listing) => (
                                <Box 
                                  key={listing.id} 
                                  bg="white" 
                                  borderRadius="lg" 
                                  overflow="hidden"
                                  shadow="sm" 
                                  border="1px" 
                                  borderColor="gray.200"
                                  _hover={{ 
                                    shadow: 'md', 
                                    transform: 'translateY(-1px)',
                                    borderColor: 'blue.300'
                                  }}
                                  transition="all 0.2s"
                                >
                                  <Box p={4}>
                                    <Stack gap={2}>
                                      <Heading as="h3" size="sm" color="gray.900" lineHeight="1.3" lineClamp={2}>
                                        {listing.name}
                                      </Heading>
                                      <HStack justify="space-between" align="center">
                                        <HStack gap={1}>
                                          <Icon as={MapPin} color="gray.500" w={3} h={3} />
                                          <Text fontSize="sm" color="gray.600">
                                            {listing.location.country ? 
                                              `${listing.location.city}, ${listing.location.country}` : 
                                              listing.location.city
                                            }
                                          </Text>
                                        </HStack>
                                        <HStack gap={1}>
                                          <Icon as={Star} color="yellow.400" w={3} h={3} />
                                          <Text fontSize="sm" fontWeight="600" color="gray.700">
                                            {listing.rating}
                                          </Text>
                                          <Text fontSize="xs" color="gray.500">
                                            ({listing.reviewsCount})
                                          </Text>
                                        </HStack>
                                      </HStack>

                                      <Text fontSize="xs" color="gray.600" bg="gray.100" px={2} py={1} borderRadius="md" alignSelf="flex-start" fontWeight="500">
                                        {listing.roomType}
                                      </Text>

                                      <HStack justify="space-between" align="end">
                                        <Box>
                                          <HStack align="baseline" gap={1}>
                                            <Text fontWeight="700" fontSize="lg" color="gray.900">
                                              ${listing.price.rate}
                                            </Text>
                                            <Text fontSize="sm" color="gray.500">
                                              /night
                                            </Text>
                                          </HStack>
                                        </Box>
                                        {listing.host.isSuperhost && (
                                          <Badge colorScheme="purple" variant="subtle" fontSize="xs" px={2} py={1}>
                                            <HStack gap={1}>
                                              <Icon as={Crown} w={3} h={3} />
                                              <Text>Superhost</Text>
                                            </HStack>
                                          </Badge>
                                        )}
                                      </HStack>

                                      <Link href={listing.url} target="_blank" rel="noopener noreferrer">
                                        <Button
                                          colorScheme="blue"
                                          size="sm"
                                          w="full"
                                          fontWeight="500"
                                          _hover={{ transform: "translateY(-1px)" }}
                                          transition="all 0.2s"
                                          mt={2}
                                        >
                                          View Details
                                          <Icon as={ExternalLink} ml={2} w={3} h={3} />
                                        </Button>
                                      </Link>
                                    </Stack>
                                  </Box>
                                </Box>
                              ))}
                            </SimpleGrid>
                          </Box>
                        )}
                      </VStack>
                    </HStack>
                  </Flex>
                )}
              </Box>
            ))}

            {/* Loading indicator */}
            {loading && (
              <Flex justify="flex-start" mb={6}>
                <HStack align="start" gap={3}>
                  <Box bg="blue.500" borderRadius="full" w={8} h={8} display="flex" alignItems="center" justifyContent="center">
                    <Icon as={Bot} color="white" w={4} h={4} />
                  </Box>
                  <Box
                    bg="white"
                    border="1px"
                    borderColor="gray.200"
                    px={4}
                    py={3}
                    borderRadius="2xl"
                    borderBottomLeftRadius="md"
                    shadow="sm"
                  >
                    <HStack>
                      <Spinner size="sm" color="blue.500" />
                      <Text fontSize="md" color="gray.600">Searching for properties...</Text>
                    </HStack>
                  </Box>
                </HStack>
              </Flex>
            )}

            <div ref={messagesEndRef} />
          </VStack>
        </Container>
      </Box>

      {/* Chat Input */}
      <Box bg="white" px={6} py={4} borderTop="1px" borderColor="gray.200">
        <Container maxW="4xl" mx="auto">
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
              minH="20px"
              maxH="120px"
              bg="gray.50"
              border="1px"
              borderColor="gray.300"
              _focus={{
                borderColor: "blue.400",
                bg: "white"
              }}
              _hover={{ borderColor: "gray.400" }}
              borderRadius="xl"
              py={3}
              px={4}
            />
            <Button
              colorScheme="blue"
              onClick={() => handleSearch()}
              disabled={!searchQuery.trim() || loading}
              size="lg"
              h="48px"
              px={6}
              borderRadius="xl"
            >
              <Icon as={Send} w={4} h={4} />
            </Button>
          </HStack>
        </Container>
      </Box>
    </Box>
  )
}

export default App