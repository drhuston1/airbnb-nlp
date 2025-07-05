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

    // Property Type Filters
    if (lowerQuery.includes('entire home') || lowerQuery.includes('entire house') || lowerQuery.includes('whole house') || lowerQuery.includes('entire place')) {
      filtered = filtered.filter(listing => listing.roomType.toLowerCase().includes('entire'))
    }
    
    if (lowerQuery.includes('private room') || lowerQuery.includes('bedroom only') || lowerQuery.includes('just a room')) {
      filtered = filtered.filter(listing => listing.roomType.toLowerCase().includes('private room'))
    }
    
    if (lowerQuery.includes('shared room') || lowerQuery.includes('shared space') || lowerQuery.includes('hostel') || lowerQuery.includes('dorm')) {
      filtered = filtered.filter(listing => listing.roomType.toLowerCase().includes('shared'))
    }

    // Property style filters (based on common keywords in names/descriptions)
    if (lowerQuery.includes('apartment') || lowerQuery.includes('apt') || lowerQuery.includes('condo') || lowerQuery.includes('flat')) {
      filtered = filtered.filter(listing => 
        listing.name.toLowerCase().includes('apartment') || 
        listing.name.toLowerCase().includes('apt') || 
        listing.name.toLowerCase().includes('condo') || 
        listing.name.toLowerCase().includes('flat')
      )
    }
    
    if (lowerQuery.includes('house') || lowerQuery.includes('home') || lowerQuery.includes('villa') || lowerQuery.includes('cottage')) {
      filtered = filtered.filter(listing => 
        listing.name.toLowerCase().includes('house') || 
        listing.name.toLowerCase().includes('home') || 
        listing.name.toLowerCase().includes('villa') || 
        listing.name.toLowerCase().includes('cottage')
      )
    }
    
    if (lowerQuery.includes('cabin') || lowerQuery.includes('chalet') || lowerQuery.includes('lodge')) {
      filtered = filtered.filter(listing => 
        listing.name.toLowerCase().includes('cabin') || 
        listing.name.toLowerCase().includes('chalet') || 
        listing.name.toLowerCase().includes('lodge')
      )
    }
    
    if (lowerQuery.includes('studio') || lowerQuery.includes('loft')) {
      filtered = filtered.filter(listing => 
        listing.name.toLowerCase().includes('studio') || 
        listing.name.toLowerCase().includes('loft')
      )
    }

    // Location-based Sorting and Filtering
    if (lowerQuery.includes('city center') || lowerQuery.includes('downtown') || lowerQuery.includes('central')) {
      // Prioritize listings with city center keywords in name or location
      filtered = filtered.sort((a, b) => {
        const aScore = (
          (a.name.toLowerCase().includes('center') ? 2 : 0) +
          (a.name.toLowerCase().includes('downtown') ? 2 : 0) +
          (a.name.toLowerCase().includes('central') ? 2 : 0) +
          (a.location.city.toLowerCase().includes('center') ? 1 : 0)
        )
        const bScore = (
          (b.name.toLowerCase().includes('center') ? 2 : 0) +
          (b.name.toLowerCase().includes('downtown') ? 2 : 0) +
          (b.name.toLowerCase().includes('central') ? 2 : 0) +
          (b.location.city.toLowerCase().includes('center') ? 1 : 0)
        )
        return bScore - aScore
      })
    }
    
    if (lowerQuery.includes('beach') || lowerQuery.includes('oceanfront') || lowerQuery.includes('seaside') || lowerQuery.includes('waterfront')) {
      // Prioritize beach/ocean properties
      filtered = filtered.sort((a, b) => {
        const aScore = (
          (a.name.toLowerCase().includes('beach') ? 3 : 0) +
          (a.name.toLowerCase().includes('ocean') ? 3 : 0) +
          (a.name.toLowerCase().includes('sea') ? 2 : 0) +
          (a.name.toLowerCase().includes('water') ? 2 : 0) +
          (a.name.toLowerCase().includes('front') ? 1 : 0)
        )
        const bScore = (
          (b.name.toLowerCase().includes('beach') ? 3 : 0) +
          (b.name.toLowerCase().includes('ocean') ? 3 : 0) +
          (b.name.toLowerCase().includes('sea') ? 2 : 0) +
          (b.name.toLowerCase().includes('water') ? 2 : 0) +
          (b.name.toLowerCase().includes('front') ? 1 : 0)
        )
        return bScore - aScore
      })
    }
    
    if (lowerQuery.includes('quiet') || lowerQuery.includes('peaceful') || lowerQuery.includes('secluded') || lowerQuery.includes('private')) {
      // Prioritize quiet/peaceful properties
      filtered = filtered.sort((a, b) => {
        const aScore = (
          (a.name.toLowerCase().includes('quiet') ? 3 : 0) +
          (a.name.toLowerCase().includes('peaceful') ? 3 : 0) +
          (a.name.toLowerCase().includes('secluded') ? 2 : 0) +
          (a.name.toLowerCase().includes('private') ? 2 : 0) +
          (a.name.toLowerCase().includes('tranquil') ? 2 : 0)
        )
        const bScore = (
          (b.name.toLowerCase().includes('quiet') ? 3 : 0) +
          (b.name.toLowerCase().includes('peaceful') ? 3 : 0) +
          (b.name.toLowerCase().includes('secluded') ? 2 : 0) +
          (b.name.toLowerCase().includes('private') ? 2 : 0) +
          (b.name.toLowerCase().includes('tranquil') ? 2 : 0)
        )
        return bScore - aScore
      })
    }

    // Specific neighborhood/area filtering
    const neighborhoodMatch = lowerQuery.match(/in\s+([a-zA-Z\s]+?)(?:\s|$|,|\.|!|\?)/i)
    if (neighborhoodMatch) {
      const neighborhood = neighborhoodMatch[1].trim().toLowerCase()
      if (neighborhood.length > 2) { // Avoid matching single words like "in"
        filtered = filtered.filter(listing => 
          listing.location.city.toLowerCase().includes(neighborhood) ||
          listing.name.toLowerCase().includes(neighborhood)
        )
      }
    }

    // Sort by rating if no other location sorting applied
    if (!lowerQuery.includes('city center') && !lowerQuery.includes('downtown') && !lowerQuery.includes('beach') && !lowerQuery.includes('quiet')) {
      if (lowerQuery.includes('highest rated') || lowerQuery.includes('best rated') || lowerQuery.includes('top rated')) {
        filtered = filtered.sort((a, b) => b.rating - a.rating)
      }
      
      if (lowerQuery.includes('most reviewed') || lowerQuery.includes('popular')) {
        filtered = filtered.sort((a, b) => b.reviewsCount - a.reviewsCount)
      }
      
      if (lowerQuery.includes('cheapest') || lowerQuery.includes('lowest price') || lowerQuery.includes('most affordable')) {
        filtered = filtered.sort((a, b) => a.price.rate - b.price.rate)
      }
      
      if (lowerQuery.includes('most expensive') || lowerQuery.includes('highest price') || lowerQuery.includes('priciest')) {
        filtered = filtered.sort((a, b) => b.price.rate - a.price.rate)
      }
    }

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