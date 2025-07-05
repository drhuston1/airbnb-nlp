import { useState } from 'react'
import {
  Box,
  Container,
  Heading,
  Text,
  Input,
  Button,
  SimpleGrid,
  Image,
  Badge,
  HStack,
  Spinner,
  Center,
  Stack,
  Flex,
  Link
} from '@chakra-ui/react'
import { searchAirbnbListings, type AirbnbListing } from './services/airbnbService'

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [listings, setListings] = useState<AirbnbListing[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const searchResults = await searchAirbnbListings(searchQuery)
      setListings(searchResults)
    } catch (error) {
      setError('Search failed. Please try again.')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxW="6xl" py={8}>
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
              onClick={handleSearch}
              loading={loading}
            >
              🔍 Search Listings
            </Button>
            
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
          <Box p={4} bg="red.50" borderLeft="4px" borderColor="red.500" color="red.700">
            {error}
          </Box>
        )}

        {loading && (
          <Center py={8}>
            <Spinner size="xl" color="pink.500" />
          </Center>
        )}

        {listings.length > 0 && !loading && (
          <Box>
            <Heading as="h2" size="lg" mb={6}>
              Found {listings.length} listing{listings.length !== 1 ? 's' : ''}
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
              {listings.map((listing) => (
                <Box key={listing.id} borderWidth="1px" borderRadius="lg" p={4} shadow="md" _hover={{ shadow: 'lg' }}>
                  <Image
                    src={listing.images[0]}
                    alt={listing.name}
                    borderRadius="md"
                    mb={4}
                    h="200px"
                    w="100%"
                    objectFit="cover"
                  />
                  <Stack gap={3} align="stretch">
                    <Heading as="h3" size="md" lineClamp={2}>
                      {listing.name}
                    </Heading>
                    <HStack justify="space-between">
                      <Text fontSize="sm" color="gray.600">
                        {listing.location.city}, {listing.location.country}
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
          </Box>
        )}
      </Stack>
    </Container>
  )
}

export default App
