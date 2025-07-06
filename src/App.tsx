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

interface SearchContext {
  location: string
  adults: number
  children: number
  checkin?: string
  checkout?: string
  minPrice?: number
  maxPrice?: number
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

  // Apply natural language filters to listings (more lenient)
  const applyNaturalLanguageFilters = (listings: AirbnbListing[], query: string) => {
    const lowerQuery = query.toLowerCase()
    let filtered = [...listings]

    console.log('Original listings:', listings.length)
    console.log('Query:', query)

    // Rating & Review Filters - only apply superhost filter if "only" is specified
    if ((lowerQuery.includes('superhost') || lowerQuery.includes('super host')) && lowerQuery.includes('only')) {
      const superhostResults = filtered.filter(listing => listing.host.isSuperhost)
      if (superhostResults.length > 0) {
        filtered = superhostResults
        console.log('After superhost only filter:', filtered.length)
      } else {
        console.log('No superhosts found, keeping all results and sorting superhosts first')
        // Sort superhosts to the top instead of filtering
        filtered = filtered.sort((a, b) => {
          if (a.host.isSuperhost && !b.host.isSuperhost) return -1
          if (!a.host.isSuperhost && b.host.isSuperhost) return 1
          return b.rating - a.rating // Then by rating
        })
      }
    } else if (lowerQuery.includes('superhost') || lowerQuery.includes('super host')) {
      // Just sort superhosts to the top without filtering
      filtered = filtered.sort((a, b) => {
        if (a.host.isSuperhost && !b.host.isSuperhost) return -1
        if (!a.host.isSuperhost && b.host.isSuperhost) return 1
        return b.rating - a.rating
      })
      console.log('Sorted superhosts to top without filtering')
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

    // Check for rating thresholds - be very lenient and avoid filtering to zero
    const ratingMatch = lowerQuery.match(/(\d\.?\d?)\+?\s*rating|rating\s*(\d\.?\d?)\+?/)
    if (ratingMatch) {
      const minRating = parseFloat(ratingMatch[1] || ratingMatch[2])
      if (minRating && minRating >= 3 && minRating <= 5) {
        // Be very lenient - subtract 0.5 from the requirement
        const lenientRating = Math.max(3.0, minRating - 0.5)
        const ratingResults = filtered.filter(listing => listing.rating >= lenientRating)
        if (ratingResults.length > 0) {
          filtered = ratingResults
          console.log(`After rating filter (${minRating} -> ${lenientRating}):`, filtered.length)
        } else {
          console.log(`No properties found with ${lenientRating}+ rating, just sorting by rating instead`)
          // If no results, just sort by rating instead of filtering
          filtered = filtered.sort((a, b) => b.rating - a.rating)
        }
      }
    }

    // Price Range Filters - be very lenient and avoid filtering to zero
    const priceUnderMatch = lowerQuery.match(/under\s*\$?(\d+)|below\s*\$?(\d+)/)
    if (priceUnderMatch) {
      const maxPrice = parseInt(priceUnderMatch[1] || priceUnderMatch[2])
      if (maxPrice && maxPrice > 0) {
        // Be very lenient - add 50% to the budget
        const lenientPrice = Math.floor(maxPrice * 1.5)
        const priceResults = filtered.filter(listing => listing.price.rate <= lenientPrice)
        if (priceResults.length > 0) {
          filtered = priceResults
          console.log(`After price filter (under $${maxPrice} -> $${lenientPrice}):`, filtered.length)
        } else {
          console.log(`No properties found under $${lenientPrice}, just sorting by price instead`)
          // If no results, just sort by price instead of filtering
          filtered = filtered.sort((a, b) => a.price.rate - b.price.rate)
        }
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
    } else if (lowerQuery.includes('luxury')) {
      // For luxury searches, sort by price (highest first) and rating
      filtered = filtered.sort((a, b) => {
        const priceSort = b.price.rate - a.price.rate
        const ratingSort = b.rating - a.rating
        return priceSort * 0.7 + ratingSort * 0.3 // Weight price more heavily for luxury
      })
      console.log('Sorted by luxury criteria (price + rating)')
    }

    console.log('Final filtered count:', filtered.length)
    return filtered
  }

  // Extract search context from initial query
  const extractSearchContext = (query: string): SearchContext => {
    const lowerQuery = query.toLowerCase()
    
    // Extract location
    let location = 'Unknown'
    const locationPatterns = [
      /(?:near|in|at|around)\s+([a-zA-Z\s,]+?)(?:\s+for|\s+with|\s*$|\s+\d|\.|,)/i,
      /(?:beachfront|beach|property)\s+(?:in|at|near)\s+([a-zA-Z\s,]+?)(?:\s+for|\s*$|\s+\d)/i,
      /^([a-zA-Z\s,]+?)\s+(?:beachfront|beach|property|villa|house|home)/i,
      /^([a-zA-Z\s,]+?)[\.\,]/i // Simple fallback
    ]
    
    for (const pattern of locationPatterns) {
      const match = query.match(pattern)
      if (match && match[1]) {
        let extractedLocation = match[1].trim()
        extractedLocation = extractedLocation.replace(/\b(for|with|and|the|a|an|property|properties|beachfront|beach|house|home|villa|apartment|condo|looking|front)\b/gi, '')
        extractedLocation = extractedLocation.replace(/\s+/g, ' ').trim()
        
        if (extractedLocation.length >= 2 && !/^\d+$/.test(extractedLocation)) {
          location = extractedLocation
          break
        }
      }
    }
    
    // Extract guest counts
    let adults = 1
    let children = 0
    
    const adultMatches = lowerQuery.match(/(\d+)\s+adults?/i)
    if (adultMatches) {
      adults = parseInt(adultMatches[1])
    }
    
    const peopleMatches = lowerQuery.match(/for\s+(\d+)\s+people/i)
    if (peopleMatches && !adultMatches) {
      adults = parseInt(peopleMatches[1])
    }
    
    const childrenMatches = lowerQuery.match(/(\d+)\s+(?:child|children|toddler|kids?)/i)
    if (childrenMatches) {
      children = parseInt(childrenMatches[1])
    }
    
    // Extract dates and prices if needed
    let minPrice: number | undefined
    let maxPrice: number | undefined
    
    const underPriceMatch = lowerQuery.match(/under\s*\$?(\d+)k?/i)
    if (underPriceMatch) {
      let price = parseInt(underPriceMatch[1])
      if (lowerQuery.includes(underPriceMatch[1] + 'k')) {
        price *= 1000
      }
      maxPrice = price
    }
    
    return {
      location,
      adults,
      children,
      minPrice,
      maxPrice
    }
  }

  // Update existing search context with new parameters from followup query
  const updateSearchContext = (existingContext: SearchContext, followupQuery: string): SearchContext => {
    const lowerQuery = followupQuery.toLowerCase()
    const updated = { ...existingContext }
    
    // Update price constraints
    const pricePatterns = [
      /(?:under|less\s+than|no\s+more\s+than)\s*\$?(\d+)k?/i,
      /(?:max(?:imum)?|limit)\s*\$?(\d+)k?/i,
      /(?:don't|don't|do\s+not)\s+(?:want\s+to\s+)?spend\s+(?:more\s+than\s+)?\$?(\d+)k?/i,
      /\$?(\d+)k?\s+(?:total|max|maximum|limit)/i
    ]
    
    for (const pattern of pricePatterns) {
      const match = followupQuery.match(pattern)
      if (match && match[1]) {
        let price = parseInt(match[1])
        if (followupQuery.toLowerCase().includes(match[1] + 'k')) {
          price *= 1000
        }
        updated.maxPrice = price
        break
      }
    }
    
    // Update guest counts if mentioned
    const adultMatches = lowerQuery.match(/(\d+)\s+adults?/i)
    if (adultMatches) {
      updated.adults = parseInt(adultMatches[1])
    }
    
    const childrenMatches = lowerQuery.match(/(\d+)\s+(?:child|children|toddler|kids?)/i)
    if (childrenMatches) {
      updated.children = parseInt(childrenMatches[1])
    }
    
    return updated
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
          console.log('Updated search context:', updatedContext)
        }
      }
      
      // Apply natural language filters
      const filteredResults = applyNaturalLanguageFilters(searchResults, query)
      
      setCurrentPage(page)
      setHasMore(data.hasMore || false)
      setCurrentQuery(query)
      
      // Create response message based on filtering
      let responseContent = ''
      if (filteredResults.length === searchResults.length) {
        responseContent = page === 1 
          ? `I found ${searchResults.length} properties that match "${query}". Check the results panel →`
          : `Here are ${searchResults.length} more properties for "${query}" (page ${page}). Check the results panel →`
      } else {
        responseContent = page === 1
          ? `I found ${searchResults.length} properties and filtered them to ${filteredResults.length} that best match "${query}". Check the results panel →`
          : `Here are ${filteredResults.length} filtered properties from ${searchResults.length} results for "${query}" (page ${page}). Check the results panel →`
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