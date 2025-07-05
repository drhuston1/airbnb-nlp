import { useState, useMemo } from 'react'
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
  Center,
  Stack,
  Flex,
  Link,
  ButtonGroup
} from '@chakra-ui/react'
import { searchAirbnbListings, type AirbnbListing } from './services/airbnbService'

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [allListings, setAllListings] = useState<AirbnbListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  
  // Filter states
  const [enableFilters, setEnableFilters] = useState(false)
  const [minRating, setMinRating] = useState(4.0)
  const [minReviews, setMinReviews] = useState(0)

  // Filter listings based on client-side criteria
  const filteredListings = useMemo(() => {
    if (!enableFilters) return allListings
    
    return allListings.filter(listing => 
      listing.rating >= minRating && listing.reviewsCount >= minReviews
    )
  }, [allListings, enableFilters, minRating, minReviews])

  const handleSearch = async (page = 1) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const searchResults = await searchAirbnbListings(searchQuery, page)
      setAllListings(searchResults)
      setCurrentPage(page)
      setHasMore(searchResults.length === 18) // Assume more if we got full page
    } catch (error) {
      setError('Search failed. Please try again.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleNextPage = () => {
    if (hasMore && !loading) {
      handleSearch(currentPage + 1)
    }
  }

  const handlePrevPage = () => {
    if (currentPage > 1 && !loading) {
      handleSearch(currentPage - 1)
    }
  }

  return (
    <Box minH="100vh" bg="gray.50" overflow="hidden">
      <Container maxW="7xl" px={{ base: 4, md: 6 }} py={12}>
        <Stack gap={10} align="stretch">
          <Box textAlign="center" py={8}>
            <Heading as="h1" size="3xl" mb={6} 
              fontWeight="800"
              letterSpacing="-0.02em"
            >
              <Text as="span" color="blue.600">
                StayFinder
              </Text>{" "}
              <Text as="span" color="purple.500">AI</Text>
            </Heading>
            <Text fontSize="xl" color="gray.600" maxW="2xl" mx="auto" lineHeight="1.6">
              Discover amazing stays worldwide using intelligent natural language search
            </Text>
          </Box>

        <Box maxW="4xl" mx="auto">
          <Stack gap={6}>
            <Box bg="white" p={8} borderRadius="xl" shadow="lg" border="1px" borderColor="gray.200">
              <Input
                placeholder="e.g., 'Find me a cozy apartment in Paris with a kitchen for 2 guests'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="lg"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                bg="gray.50"
                border="2px"
                borderColor="gray.200"
                _focus={{
                  borderColor: "blue.400",
                  bg: "white",
                  shadow: "0 0 0 3px rgba(66, 153, 225, 0.1)"
                }}
                _hover={{ borderColor: "gray.300" }}
                fontSize="md"
                py={6}
              />
              <Button
                colorScheme="blue"
                size="lg"
                onClick={() => handleSearch()}
                loading={loading}
                w="full"
                mt={4}
                py={6}
                fontSize="md"
                fontWeight="600"
                _hover={{ transform: "translateY(-1px)", shadow: "lg" }}
                transition="all 0.2s"
              >
🔍 Find Perfect Stays
              </Button>
            </Box>

            {/* Quality Filters */}
            <Box bg="white" p={6} borderRadius="xl" shadow="md" border="1px" borderColor="gray.200">
              <HStack alignItems="center" mb={4}>
                <Text fontSize="md" fontWeight="600" color="gray.700">
                  🎯 Quality Filters
                </Text>
                <input 
                  type="checkbox"
                  checked={enableFilters}
                  onChange={(e) => setEnableFilters(e.target.checked)}
                  style={{ 
                    marginLeft: '12px',
                    transform: 'scale(1.2)',
                    accentColor: '#3182ce'
                  }}
                />
              </HStack>
              
              {enableFilters && (
                <Stack gap={4}>
                  <Flex gap={4} flexWrap="wrap" w="full">
                    <Box flex="1" minW="160px">
                      <Text fontSize="sm" fontWeight="500" color="gray.700" mb={2}>Minimum Rating</Text>
                      <Input
                        type="number"
                        value={minRating}
                        onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)}
                        min={0}
                        max={5}
                        step={0.1}
                        size="sm"
                        bg="gray.50"
                        border="1px"
                        borderColor="gray.300"
                        _focus={{ borderColor: "blue.400", bg: "white" }}
                      />
                    </Box>
                    
                    <Box flex="1" minW="160px">
                      <Text fontSize="sm" fontWeight="500" color="gray.700" mb={2}>Minimum Reviews</Text>
                      <Input
                        type="number"
                        value={minReviews}
                        onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
                        min={0}
                        size="sm"
                        bg="gray.50"
                        border="1px"
                        borderColor="gray.300"
                        _focus={{ borderColor: "blue.400", bg: "white" }}
                      />
                    </Box>
                  </Flex>
                  
                  <Button 
                    size="sm" 
                    colorScheme="purple" 
                    variant="outline"
                    onClick={() => {
                      setMinRating(4.9)
                      setMinReviews(20)
                    }}
                    alignSelf="flex-start"
                    _hover={{ bg: "purple.50" }}
                  >
                    ⭐ 4.9+ stars, 20+ reviews
                  </Button>
                </Stack>
              )}
            </Box>
            
            {/* Example queries */}
            <Box textAlign="center" bg="white" p={6} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.200">
              <Text fontSize="sm" fontWeight="500" color="gray.600" mb={4}>Popular searches:</Text>
              <Flex gap={3} flexWrap="wrap" justify="center">
                {[
                  "Beach house in Malibu for 4 guests",
                  "Studio apartment in Tokyo under $100",
                  "Pet-friendly cabin in Colorado",
                  "Luxury villa in Tuscany with pool"
                ].map((example) => (
                  <Button
                    key={example}
                    size="sm"
                    variant="ghost"
                    colorScheme="gray"
                    onClick={() => setSearchQuery(example)}
                    px={4}
                    py={2}
                    fontSize="xs"
                    fontWeight="500"
                    bg="gray.50"
                    _hover={{ bg: "gray.100", transform: "translateY(-1px)" }}
                    transition="all 0.2s"
                    borderRadius="full"
                  >
                    {example}
                  </Button>
                ))}
              </Flex>
            </Box>
          </Stack>
        </Box>

        {error && (
          <Box maxW="4xl" mx="auto" bg="red.50" p={6} borderRadius="xl" border="1px" borderColor="red.200">
            <HStack mb={3}>
              <Text fontSize="lg">⚠️</Text>
              <Text fontWeight="600" color="red.800">Connection Issue</Text>
            </HStack>
            <Text fontSize="sm" color="red.700" mb={3}>
              Unable to connect to the search service. Please try again in a moment.
            </Text>
            <Text fontSize="xs" color="red.600">
              Error: {error}
            </Text>
          </Box>
        )}

        {loading && (
          <Center py={12}>
            <Stack align="center" gap={4}>
              <Spinner size="xl" color="blue.500" />
              <Text color="gray.600" fontWeight="500">Finding perfect stays...</Text>
            </Stack>
          </Center>
        )}

        {allListings.length > 0 && !loading && (
          <Box maxW="7xl" mx="auto">
            <Box mb={8} bg="white" p={6} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.200">
              <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={4}>
                <Box>
                  <Heading as="h2" size="lg" color="gray.800" mb={2}>
                    {enableFilters ? (
                      <>Showing {filteredListings.length} of {allListings.length} stays</>
                    ) : (
                      <>Found {allListings.length} perfect stays</>
                    )}
                  </Heading>
                  <Text fontSize="sm" color="gray.600">Page {currentPage}</Text>
                </Box>
                <ButtonGroup size="sm" variant="outline" colorScheme="gray">
                  <Button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || loading}
                    _hover={{ bg: "gray.50" }}
                  >
                    ← Previous
                  </Button>
                  <Button 
                    onClick={handleNextPage}
                    disabled={!hasMore || loading}
                    _hover={{ bg: "gray.50" }}
                  >
                    Next →
                  </Button>
                </ButtonGroup>
              </Flex>
              <Box p={4} bg="blue.50" borderRadius="lg" border="1px" borderColor="blue.200">
                <HStack>
                  <Text fontSize="lg">🚀</Text>
                  <Text fontSize="sm" color="blue.800" fontWeight="500">
                    Live data from Airbnb
                  </Text>
                </HStack>
                <Text fontSize="xs" color="blue.700" mt={1}>
                  Real properties with current prices and availability
                  {enableFilters && filteredListings.length < allListings.length && (
                    <Text as="span" ml={2}>
                      • Filtered by {minRating}+ stars, {minReviews}+ reviews
                    </Text>
                  )}
                </Text>
              </Box>
            </Box>

            {enableFilters && filteredListings.length === 0 ? (
              <Box maxW="2xl" mx="auto" p={8} textAlign="center" bg="white" borderRadius="xl" shadow="sm" border="1px" borderColor="gray.200">
                <Text fontSize="4xl" mb={4}>🔍</Text>
                <Text fontSize="xl" fontWeight="600" color="gray.800" mb={3}>
                  No matches found
                </Text>
                <Text fontSize="sm" color="gray.600" mb={6}>
                  Try adjusting your filters. Currently set to {minRating}+ stars with {minReviews}+ reviews.
                </Text>
                <Button 
                  size="md" 
                  colorScheme="blue" 
                  variant="outline"
                  onClick={() => {
                    setMinRating(4.0)
                    setMinReviews(0)
                  }}
                  _hover={{ bg: "blue.50" }}
                >
                  Reset Filters
                </Button>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={8}>
                {filteredListings.map((listing) => (
                <Box 
                  key={listing.id} 
                  bg="white" 
                  borderRadius="xl" 
                  overflow="hidden"
                  shadow="md" 
                  border="1px" 
                  borderColor="gray.200"
                  _hover={{ 
                    shadow: 'xl', 
                    transform: 'translateY(-2px)',
                    borderColor: 'gray.300'
                  }}
                  transition="all 0.2s"
                >
                  <Box p={6}>
                    <Stack gap={4} align="stretch">
                      <Heading as="h3" size="md" lineClamp={2} color="gray.800" lineHeight="1.3">
                        {listing.name}
                      </Heading>
                      <HStack justify="space-between" align="center">
                        <Text fontSize="sm" color="gray.600" fontWeight="500">
                          📍 {listing.location.country ? 
                            `${listing.location.city}, ${listing.location.country}` : 
                            listing.location.city
                          }
                        </Text>
                        <Badge 
                          colorScheme={listing.rating >= 4.8 ? "green" : listing.rating >= 4.5 ? "blue" : "gray"}
                          fontSize="xs"
                          px={2}
                          py={1}
                          borderRadius="full"
                        >
                          ⭐ {listing.rating} ({listing.reviewsCount})
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color="gray.600" bg="gray.50" px={3} py={1} borderRadius="full" alignSelf="flex-start">
                        {listing.roomType}
                      </Text>
                      <HStack justify="space-between" align="center" pt={2}>
                        <Box>
                          <Text fontWeight="700" fontSize="xl" color="gray.800">
                            ${listing.price.rate}
                          </Text>
                          <Text fontSize="xs" color="gray.500">per night</Text>
                        </Box>
                        {listing.host.isSuperhost && (
                          <Badge colorScheme="purple" variant="subtle" px={3} py={1} borderRadius="full">
                            👑 Superhost
                          </Badge>
                        )}
                      </HStack>
                      <Link href={listing.url} target="_blank" rel="noopener noreferrer">
                        <Button
                          colorScheme="blue"
                          size="md"
                          w="full"
                          mt={2}
                          fontWeight="600"
                          _hover={{ transform: "translateY(-1px)" }}
                          transition="all 0.2s"
                        >
                          View on Airbnb
                        </Button>
                      </Link>
                    </Stack>
                  </Box>
                </Box>
                ))}
              </SimpleGrid>
            )}
            
            {/* Pagination controls at bottom */}
            <Center mt={12}>
              <Box bg="white" p={4} borderRadius="xl" shadow="sm" border="1px" borderColor="gray.200">
                <HStack gap={4}>
                  <Button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || loading}
                    variant="outline"
                    colorScheme="gray"
                    _hover={{ bg: "gray.50" }}
                  >
                    ← Previous
                  </Button>
                  <Box px={6} py={2} bg="gray.50" borderRadius="lg">
                    <Text fontWeight="600" color="gray.700">Page {currentPage}</Text>
                  </Box>
                  <Button 
                    onClick={handleNextPage}
                    disabled={!hasMore || loading}
                    variant="outline"
                    colorScheme="gray"
                    _hover={{ bg: "gray.50" }}
                  >
                    Next →
                  </Button>
                </HStack>
              </Box>
            </Center>
          </Box>
        )}
        </Stack>
      </Container>
    </Box>
  )
}

export default App
