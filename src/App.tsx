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
    <Container maxW="full" px={8} py={8}>
      <Stack gap={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="2xl" mb={4} color="pink.500">
            Airbnb Search
          </Heading>
          <Text fontSize="lg" color="gray.600">
            Find your perfect stay using natural language
          </Text>
        </Box>

        <Box>
          <Stack gap={4}>
            <Input
              placeholder="e.g., 'Find me a cozy apartment in Paris with a kitchen for 2 guests'"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="lg"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button
              colorScheme="pink"
              size="lg"
              onClick={() => handleSearch()}
              loading={loading}
            >
              🔍 Search Listings
            </Button>

            {/* Quality Filters */}
            <Box p={4} bg="blue.50" borderRadius="md" borderLeft="4px" borderColor="blue.400">
              <HStack alignItems="center" mb={3}>
                <Text fontSize="sm" fontWeight="medium">
                  🎯 Enable Quality Filters
                </Text>
                <input 
                  type="checkbox"
                  checked={enableFilters}
                  onChange={(e) => setEnableFilters(e.target.checked)}
                  style={{ marginLeft: '8px' }}
                />
              </HStack>
              
              {enableFilters && (
                <HStack gap={4} flexWrap="wrap">
                  <Box maxW="200px">
                    <Text fontSize="xs" color="gray.600" mb={1}>Minimum Rating</Text>
                    <Input
                      type="number"
                      value={minRating}
                      onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)}
                      min={0}
                      max={5}
                      step={0.1}
                      size="sm"
                    />
                  </Box>
                  
                  <Box maxW="200px">
                    <Text fontSize="xs" color="gray.600" mb={1}>Minimum Reviews</Text>
                    <Input
                      type="number"
                      value={minReviews}
                      onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
                      min={0}
                      size="sm"
                    />
                  </Box>
                  
                  <Button 
                    size="sm" 
                    colorScheme="blue" 
                    variant="outline"
                    onClick={() => {
                      setMinRating(4.9)
                      setMinReviews(20)
                    }}
                    mt={4}
                  >
                    4.9+ stars, 20+ reviews
                  </Button>
                </HStack>
              )}
            </Box>
            
            {/* Example queries */}
            <Box textAlign="center">
              <Text fontSize="sm" color="gray.500" mb={2}>Try these examples:</Text>
              <Flex gap={2} flexWrap="wrap" justify="center">
                {[
                  "Beach house in Malibu for 4 guests",
                  "Studio apartment in Tokyo under $100",
                  "Pet-friendly cabin in Colorado",
                  "Luxury villa in Tuscany with pool"
                ].map((example) => (
                  <Button
                    key={example}
                    size="xs"
                    variant="outline"
                    colorScheme="gray"
                    onClick={() => setSearchQuery(example)}
                  >
                    {example}
                  </Button>
                ))}
              </Flex>
            </Box>
          </Stack>
        </Box>

        {error && (
          <Box p={4} bg="orange.50" borderLeft="4px" borderColor="orange.500" color="orange.700">
            <Text fontWeight="semibold" mb={2}>🔧 MCP Server Setup Required</Text>
            <Text fontSize="sm" mb={2}>
              To get real Airbnb data, deploy the included MCP server to Railway or Fly.io.
            </Text>
            <Text fontSize="xs" color="orange.600">
              See README for step-by-step instructions. Current error: {error}
            </Text>
          </Box>
        )}

        {loading && (
          <Center py={8}>
            <Spinner size="xl" color="pink.500" />
          </Center>
        )}

        {allListings.length > 0 && !loading && (
          <Box>
            <Box mb={4}>
              <HStack justify="space-between" align="center" mb={2}>
                <Heading as="h2" size="lg">
                  {enableFilters ? (
                    <>Showing {filteredListings.length} of {allListings.length} listing{allListings.length !== 1 ? 's' : ''} (Page {currentPage})</>
                  ) : (
                    <>Found {allListings.length} listing{allListings.length !== 1 ? 's' : ''} (Page {currentPage})</>
                  )}
                </Heading>
                <ButtonGroup size="sm" attached variant="outline">
                  <Button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1 || loading}
                  >
                    Previous
                  </Button>
                  <Button 
                    onClick={handleNextPage}
                    disabled={!hasMore || loading}
                  >
                    Next
                  </Button>
                </ButtonGroup>
              </HStack>
              <Box p={3} bg="green.50" borderLeft="4px" borderColor="green.400" borderRadius="md">
                <Text fontSize="sm" color="green.700">
                  <Text as="span" fontWeight="semibold">🔥 Real Airbnb Data:</Text> Showing actual listings from Airbnb via MCP server. 
                  These are real properties with real prices and availability.
                  {enableFilters && filteredListings.length < allListings.length && (
                    <Text as="span" ml={2} fontWeight="normal">
                      (Filtered by {minRating}+ stars, {minReviews}+ reviews)
                    </Text>
                  )}
                </Text>
              </Box>
            </Box>

            {enableFilters && filteredListings.length === 0 ? (
              <Box p={6} textAlign="center" bg="yellow.50" borderRadius="md" borderLeft="4px" borderColor="yellow.400">
                <Text fontSize="lg" fontWeight="medium" color="yellow.800" mb={2}>
                  🔍 No listings match your quality filters
                </Text>
                <Text fontSize="sm" color="yellow.700" mb={3}>
                  Try lowering your minimum rating ({minRating}) or review count ({minReviews}) requirements.
                </Text>
                <Button 
                  size="sm" 
                  colorScheme="yellow" 
                  variant="outline"
                  onClick={() => {
                    setMinRating(4.0)
                    setMinReviews(0)
                  }}
                >
                  Reset Filters
                </Button>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
                {filteredListings.map((listing) => (
                <Box key={listing.id} borderWidth="1px" borderRadius="lg" p={4} shadow="md" _hover={{ shadow: 'lg' }}>
                  <Stack gap={3} align="stretch">
                    <Heading as="h3" size="md" lineClamp={2}>
                      {listing.name}
                    </Heading>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.600">
                        {listing.location.country ? 
                          `${listing.location.city}, ${listing.location.country}` : 
                          listing.location.city
                        }
                      </Text>
                      <Badge colorScheme="pink">
                        ★ {listing.rating} ({listing.reviewsCount})
                      </Badge>
                    </HStack>
                    <Text fontSize="sm" color="gray.600">
                      {listing.roomType}
                    </Text>
                    <HStack justify="space-between" align="center">
                      <Text fontWeight="bold" fontSize="lg">
                        ${listing.price.rate}/night
                      </Text>
                      {listing.host.isSuperhost && (
                        <Badge colorScheme="yellow">Superhost</Badge>
                      )}
                    </HStack>
                    <Link href={listing.url} target="_blank" rel="noopener noreferrer">
                      <Button
                        colorScheme="pink"
                        variant="outline"
                        size="sm"
                        w="full"
                      >
                        View on Airbnb
                      </Button>
                    </Link>
                  </Stack>
                </Box>
                ))}
              </SimpleGrid>
            )}
            
            {/* Pagination controls at bottom */}
            <Center mt={8}>
              <ButtonGroup size="md" variant="outline" colorScheme="pink">
                <Button 
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || loading}
                >
                  ← Previous Page
                </Button>
                <Box px={4} py={2} display="flex" alignItems="center">
                  <Text fontWeight="medium">Page {currentPage}</Text>
                </Box>
                <Button 
                  onClick={handleNextPage}
                  disabled={!hasMore || loading}
                >
                  Next Page →
                </Button>
              </ButtonGroup>
            </Center>
          </Box>
        )}
      </Stack>
    </Container>
  )
}

export default App
