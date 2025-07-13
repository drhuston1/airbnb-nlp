// Location disambiguation component for handling ambiguous locations
import {
  Box,
  Text,
  Button,
  Stack,
  Icon,
  Badge
} from '@chakra-ui/react'
import { MapPin, Globe, Star, Info } from 'lucide-react'
import type { LocationValidation, GeocodeResult } from '../types'

interface LocationDisambiguationProps {
  validation: LocationValidation
  originalQuery: string
  onLocationSelected: (location: GeocodeResult) => void
  onDismiss: () => void
}

export function LocationDisambiguation({
  validation,
  originalQuery,
  onLocationSelected,
  onDismiss
}: LocationDisambiguationProps) {
  if (!validation.disambiguation) {
    return null
  }

  const { disambiguation } = validation

  const handleLocationSelect = (location: GeocodeResult) => {
    console.log(`📍 User selected location: ${location.displayName}`)
    onLocationSelected(location)
  }

  const getLocationIcon = (type: GeocodeResult['type']) => {
    switch (type) {
      case 'city':
        return MapPin
      case 'neighborhood':
        return MapPin
      case 'landmark':
        return Star
      case 'region':
        return Globe
      case 'country':
        return Globe
      default:
        return MapPin
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'green'
    if (confidence >= 0.6) return 'yellow'
    return 'red'
  }

  const formatLocation = (result: GeocodeResult) => {
    const parts = []
    
    if (result.components.city && result.components.city !== result.location) {
      parts.push(result.components.city)
    }
    
    if (result.components.state) {
      parts.push(result.components.state)
    }
    
    if (result.components.country) {
      parts.push(result.components.country)
    }
    
    return parts.join(', ')
  }

  return (
    <Box
      position="fixed"
      top="0"
      left="0"
      right="0"
      bottom="0"
      bg="blackAlpha.600"
      display="flex"
      alignItems="center"
      justifyContent="center"
      zIndex={1000}
      onClick={onDismiss}
    >
      <Box
        bg="white"
        borderRadius="xl"
        p={6}
        maxW="600px"
        w="90%"
        maxH="80vh"
        overflowY="auto"
        boxShadow="2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Stack gap={4} align="stretch">
          {/* Header */}
          <Box>
            <Stack direction="row" gap={2} mb={2}>
              <Icon as={Info} color="#4ECDC4" w={5} h={5} />
              <Text fontSize="lg" fontWeight="600" color="gray.800">
                {disambiguation.required ? 'Multiple Locations Found' : 'Confirm Location'}
              </Text>
            </Stack>
            <Text fontSize="sm" color="gray.600">
              {disambiguation.message}
            </Text>
          </Box>

          {/* Alert for disambiguation */}
          <Box 
            bg="blue.50" 
            border="1px solid" 
            borderColor="blue.200" 
            borderRadius="md" 
            p={3}
          >
            <Stack direction="row" gap={2}>
              <Icon as={Info} color="blue.500" w={4} h={4} />
              <Text fontSize="sm" color="blue.800">
                {disambiguation.required 
                  ? `We found multiple places named "${originalQuery}". Please select the location you intended:`
                  : `Please confirm this is the location you're looking for:`
                }
              </Text>
            </Stack>
          </Box>

          {/* Location Options */}
          <Stack gap={3} align="stretch">
            {disambiguation.options.map((option, index) => (
              <Button
                key={`${option.coordinates.lat}-${option.coordinates.lng}`}
                variant="outline"
                size="lg"
                onClick={() => handleLocationSelect(option)}
                borderColor={index === 0 ? "#4ECDC4" : "gray.300"}
                color={index === 0 ? "#2E7A73" : "gray.700"}
                bg={index === 0 ? "#F8FDFC" : "white"}
                _hover={{ 
                  borderColor: "#4ECDC4",
                  bg: "#F8FDFC",
                  transform: "translateY(-1px)",
                  boxShadow: "md"
                }}
                p={4}
                h="auto"
                textAlign="left"
                justifyContent="flex-start"
                transition="all 0.2s"
              >
                <Stack direction="row" gap={3} w="full" align="center">
                  {/* Location Icon */}
                  <Box
                    p={2}
                    borderRadius="md"
                    bg={index === 0 ? "#4ECDC4" : "gray.100"}
                    color={index === 0 ? "white" : "gray.600"}
                  >
                    <Icon as={getLocationIcon(option.type)} w={4} h={4} />
                  </Box>

                  {/* Location Details */}
                  <Stack align="start" gap={1} flex="1">
                    <Stack direction="row" gap={2} align="center">
                      <Text fontWeight="600" fontSize="md">
                        {option.location}
                      </Text>
                      {index === 0 && (
                        <Badge colorScheme="teal" size="sm">
                          Recommended
                        </Badge>
                      )}
                    </Stack>
                    
                    <Text fontSize="sm" color="gray.600" lineHeight="1.3">
                      {formatLocation(option)}
                    </Text>
                    
                    <Stack direction="row" gap={2} align="center">
                      <Text fontSize="xs" color="gray.500" textTransform="capitalize">
                        {option.type}
                      </Text>
                      
                      <Box
                        title={`Confidence: ${Math.round(option.confidence * 100)}%`}
                      >
                        <Badge 
                          colorScheme={getConfidenceColor(option.confidence)} 
                          size="sm"
                        >
                          {Math.round(option.confidence * 100)}%
                        </Badge>
                      </Box>
                      
                      {option.components.countryCode && (
                        <Text fontSize="xs" color="gray.400">
                          {option.components.countryCode}
                        </Text>
                      )}
                    </Stack>
                  </Stack>

                  {/* Map Preview Indicator */}
                  <Box color="gray.400">
                    <Icon as={MapPin} w={4} h={4} />
                  </Box>
                </Stack>
              </Button>
            ))}
          </Stack>

          {/* Location Suggestions */}
          {validation.suggestions && validation.suggestions.length > 0 && (
            <Box>
              <Text fontSize="sm" fontWeight="500" color="gray.700" mb={2}>
                Helpful tips:
              </Text>
              <Stack gap={1} align="start">
                {validation.suggestions.slice(0, 3).map((suggestion, index) => (
                  <Text key={index} fontSize="xs" color="gray.600">
                    • {suggestion}
                  </Text>
                ))}
              </Stack>
            </Box>
          )}

          {/* Action Buttons */}
          <Stack direction="row" gap={3} pt={2}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              color="gray.600"
              _hover={{ bg: "gray.100" }}
            >
              {disambiguation.required ? 'Cancel' : 'Skip'}
            </Button>
            
            <Button
              size="sm"
              bg="#4ECDC4"
              color="white"
              _hover={{ bg: "#3FB8B3" }}
              onClick={() => {
                // Use the first (recommended) option
                if (disambiguation.options.length > 0) {
                  handleLocationSelect(disambiguation.options[0])
                }
              }}
            >
              {disambiguation.required ? 'Use Recommended' : 'Confirm & Search'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  )
}