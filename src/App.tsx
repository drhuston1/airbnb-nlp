import { useState, useRef, useEffect } from 'react'
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
  followUps?: string[]
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



  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Apply natural language filters to listings (more lenient)
  const applyNaturalLanguageFilters = (listings: AirbnbListing[], query: string) => {
    const lowerQuery = query.toLowerCase()
    let filtered = [...listings]

    console.log('Original listings:', listings.length)
    console.log('Query:', query)

    // Rating & Review Filters
    if (lowerQuery.includes('superhost') || lowerQuery.includes('super host')) {
      filtered = filtered.filter(listing => listing.host.isSuperhost)
      console.log('After superhost filter:', filtered.length)
    }
    
    if (lowerQuery.includes('high rated') || lowerQuery.includes('highly rated')) {
      filtered = filtered.filter(listing => listing.rating >= 4.5)
      console.log('After high rated filter:', filtered.length)
    }
    
    if (lowerQuery.includes('well reviewed') || lowerQuery.includes('lots of reviews')) {
      filtered = filtered.filter(listing => listing.reviewsCount >= 20)
      console.log('After well reviewed filter:', filtered.length)
    }
    
    if (lowerQuery.includes('new listing') || lowerQuery.includes('recently added')) {
      filtered = filtered.filter(listing => listing.reviewsCount < 5)
      console.log('After new listing filter:', filtered.length)
    }

    // Check for rating thresholds - make more lenient
    const ratingMatch = lowerQuery.match(/(\d\.?\d?)\+?\s*rating|rating\s*(\d\.?\d?)\+?/)
    if (ratingMatch) {
      const minRating = parseFloat(ratingMatch[1] || ratingMatch[2])
      if (minRating && minRating >= 3 && minRating <= 5) {
        // Be more lenient - subtract 0.2 from the requirement
        const lenientRating = Math.max(3.0, minRating - 0.2)
        filtered = filtered.filter(listing => listing.rating >= lenientRating)
        console.log(`After rating filter (${minRating} -> ${lenientRating}):`, filtered.length)
      }
    }

    // Price Range Filters - be more lenient
    const priceUnderMatch = lowerQuery.match(/under\s*\$?(\d+)|below\s*\$?(\d+)/)
    if (priceUnderMatch) {
      const maxPrice = parseInt(priceUnderMatch[1] || priceUnderMatch[2])
      if (maxPrice && maxPrice > 0) {
        // Be more lenient - add 20% to the budget
        const lenientPrice = Math.floor(maxPrice * 1.2)
        filtered = filtered.filter(listing => listing.price.rate <= lenientPrice)
        console.log(`After price filter (under $${maxPrice} -> $${lenientPrice}):`, filtered.length)
      }
    }

    // Property style filters - only filter if we find matches, otherwise skip
    if (lowerQuery.includes('cabin') || lowerQuery.includes('chalet') || lowerQuery.includes('lodge')) {
      const cabinListings = filtered.filter(listing => 
        listing.name.toLowerCase().includes('cabin') || 
        listing.name.toLowerCase().includes('chalet') || 
        listing.name.toLowerCase().includes('lodge')
      )
      if (cabinListings.length > 0) {
        filtered = cabinListings
        console.log('After cabin filter:', filtered.length)
      } else {
        console.log('No cabins found, keeping all results')
      }
    }

    // Don't filter by dog-friendly, Yellowstone, etc. - let the MCP search handle location
    // Just sort instead of filter for these

    // Sorting (instead of hard filtering)
    if (lowerQuery.includes('highest rated') || lowerQuery.includes('best rated') || lowerQuery.includes('top rated')) {
      filtered = filtered.sort((a, b) => b.rating - a.rating)
    }

    console.log('Final filtered count:', filtered.length)
    return filtered
  }

  // Generate contextual follow-up suggestions based on search results
  const generateFollowUps = (listings: AirbnbListing[], originalQuery: string) => {
    const followUps: string[] = []
    const lowerQuery = originalQuery.toLowerCase()

    if (listings.length === 0) {
      return ["Try a different location", "Expand your search criteria", "Search for nearby areas"]
    }

    // Price-based follow-ups
    const prices = listings.map(l => l.price.rate)
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    if (!lowerQuery.includes('under') && !lowerQuery.includes('below') && avgPrice > 150) {
      followUps.push(`Show options under $${Math.round(avgPrice * 0.8)}`)
    }
    if (!lowerQuery.includes('luxury') && maxPrice > 300) {
      followUps.push("Show only luxury properties")
    }
    if (!lowerQuery.includes('budget') && minPrice < 150) {
      followUps.push("Show only budget options")
    }

    // Rating-based follow-ups
    const ratings = listings.map(l => l.rating)
    const avgRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    if (!lowerQuery.includes('superhost') && listings.some(l => l.host.isSuperhost)) {
      followUps.push("Show only superhosts")
    }
    if (!lowerQuery.includes('rated') && avgRating < 4.8) {
      followUps.push("Show only 4.8+ rated properties")
    }

    // Property type follow-ups
    const roomTypes = [...new Set(listings.map(l => l.roomType))]
    if (roomTypes.length > 1) {
      if (!lowerQuery.includes('entire') && roomTypes.some(rt => rt.toLowerCase().includes('entire'))) {
        followUps.push("Show only entire homes")
      }
      if (!lowerQuery.includes('private room') && roomTypes.some(rt => rt.toLowerCase().includes('private'))) {
        followUps.push("Show only private rooms")
      }
    }

    // Location-based follow-ups
    if (!lowerQuery.includes('beach') && listings.some(l => l.name.toLowerCase().includes('beach'))) {
      followUps.push("Show only beachfront properties")
    }
    if (!lowerQuery.includes('downtown') && !lowerQuery.includes('center') && 
        listings.some(l => l.name.toLowerCase().includes('center') || l.name.toLowerCase().includes('downtown'))) {
      followUps.push("Show only city center locations")
    }

    // Sorting follow-ups
    if (!lowerQuery.includes('highest') && !lowerQuery.includes('best rated')) {
      followUps.push("Sort by highest rated first")
    }
    if (!lowerQuery.includes('cheapest') && !lowerQuery.includes('lowest price')) {
      followUps.push("Sort by lowest price first")
    }

    // Review count follow-ups
    const reviewCounts = listings.map(l => l.reviewsCount)
    const avgReviews = reviewCounts.reduce((sum, count) => sum + count, 0) / reviewCounts.length
    if (!lowerQuery.includes('well reviewed') && avgReviews > 20) {
      followUps.push("Show only well-reviewed properties")
    }

    // Return 3-4 most relevant follow-ups
    return followUps.slice(0, 4)
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
      
      // Debug: log the first listing to see its structure
      if (filteredResults.length > 0) {
        console.log('First listing structure:', filteredResults[0])
      }
      
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
      
      // Generate follow-up suggestions
      const followUpSuggestions = generateFollowUps(filteredResults, query)
      
      // Add assistant response with results
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseContent,
        listings: filteredResults,
        followUps: followUpSuggestions,
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
    <Box h="100vh" bg="gray.50" display="flex" flexDirection="column">
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
                  Find your perfect Airbnb
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
                  bg="gray.100"
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
          <Box maxW="3xl" mx="auto" px={4} py={6} w="full" bg="white" borderRadius="lg" my={4} border="1px" borderColor="gray.200">

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
                        
                    {/* Show listings if present */}
                    {message.listings && (
                      <Box w="full">

                        {/* Property Grid */}
                        <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                          {message.listings.map((listing) => (
                            <Box 
                              key={listing.id} 
                              border="1px" 
                              borderColor="gray.200"
                              borderRadius="md"
                              overflow="hidden"
                              bg="white"
                              _hover={{ 
                                borderColor: 'gray.300'
                              }}
                              transition="border-color 0.2s"
                            >
                              <Box p={4}>
                                <VStack align="start" gap={3}>
                                  <Text fontWeight="600" color="gray.900" lineHeight="1.4" lineClamp={2}>
                                    {(listing.name && typeof listing.name === 'string' && listing.name.length < 200) 
                                      ? listing.name 
                                      : 'Property name not available'}
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
                                      <Icon as={Star} color="yellow.400" w={4} h={4} />
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
                                          <Icon as={Crown} w={3} h={3} color="yellow.400" />
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
                        {message.listings.length > 0 && (
                          <Box mt={6} pt={4} borderTop="1px" borderColor="gray.200">
                            <Flex justify="space-between" align="center" flexWrap="wrap" gap={4}>
                              <Text fontSize="sm" color="gray.500">
                                Page {currentPage} • {message.listings.length} properties
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
                          onClick={() => setSearchQuery(followUp)}
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
  )
}

export default App