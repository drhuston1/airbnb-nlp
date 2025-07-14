import { useState, useEffect } from 'react'
import {
  Box,
  Text,
  VStack,
  HStack,
  Spinner,
  Icon,
  Badge
} from '@chakra-ui/react'
import { 
  MapPin, 
  Search, 
  Star, 
  CheckCircle2, 
  Clock,
  Sparkles
} from 'lucide-react'

interface LoadingStep {
  id: string
  message: string
  duration: number
  completed: boolean
}

interface OptimisticSearchMessageProps {
  location: string
  estimatedResults: number
  loadingSteps: LoadingStep[]
  onStepsComplete?: () => void
}

export function OptimisticSearchMessage({ 
  location, 
  estimatedResults, 
  loadingSteps: initialSteps,
  onStepsComplete 
}: OptimisticSearchMessageProps) {
  const [steps, setSteps] = useState(initialSteps)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  useEffect(() => {
    if (currentStepIndex >= steps.length) {
      onStepsComplete?.()
      return
    }

    const currentStep = steps[currentStepIndex]
    const timer = setTimeout(() => {
      // Mark current step as completed
      setSteps(prev => prev.map((step, index) => 
        index === currentStepIndex 
          ? { ...step, completed: true }
          : step
      ))

      // Move to next step
      setCurrentStepIndex(prev => prev + 1)

    }, currentStep.duration)

    return () => clearTimeout(timer)
  }, [currentStepIndex, steps.length, onStepsComplete])

  const completedSteps = steps.filter(step => step.completed).length
  const progressPercentage = (completedSteps / steps.length) * 100

  return (
    <Box
      bg="white"
      borderRadius="xl"
      p={6}
      boxShadow="sm"
      border="1px solid"
      borderColor="gray.100"
      position="relative"
      overflow="hidden"
    >
      <VStack gap={4} align="stretch">
        {/* Header with location and estimated results */}
        <HStack justify="space-between" align="center">
          <HStack gap={3}>
            <Box
              p={2}
              bg="blue.50"
              borderRadius="lg"
              color="blue.600"
            >
              <Icon as={MapPin} boxSize={5} />
            </Box>
            <VStack align="start" gap={1}>
              <Text fontSize="lg" fontWeight="bold" color="gray.800">
                Searching in {location}
              </Text>
              <Text fontSize="sm" color="gray.600">
                Finding the best properties for you
              </Text>
            </VStack>
          </HStack>
          
          <Badge
            colorScheme="green"
            variant="subtle"
            fontSize="xs"
            px={3}
            py={1}
            borderRadius="full"
          >
            ~{estimatedResults} properties
          </Badge>
        </HStack>

        {/* Overall progress bar */}
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.600" fontWeight="medium">
              Search Progress
            </Text>
            <Text fontSize="sm" color="blue.600" fontWeight="bold">
              {Math.round(progressPercentage)}%
            </Text>
          </HStack>
          <Box
            width="100%"
            height="8px"
            bg="gray.100"
            borderRadius="full"
            overflow="hidden"
          >
            <Box
              width={`${progressPercentage}%`}
              height="100%"
              bg="blue.400"
              borderRadius="full"
              transition="all 0.3s ease"
            />
          </Box>
        </Box>

        {/* Loading steps */}
        <VStack gap={3} align="stretch">
          {steps.map((step, index) => (
            <HStack
              key={step.id}
              gap={3}
              p={3}
              bg={step.completed ? "green.50" : index === currentStepIndex ? "blue.50" : "gray.50"}
              borderRadius="lg"
              transition="all 0.3s ease"
              border={index === currentStepIndex ? "2px solid" : "1px solid"}
              borderColor={
                step.completed 
                  ? "green.200" 
                  : index === currentStepIndex 
                    ? "blue.200" 
                    : "gray.200"
              }
            >
              {/* Step icon */}
              <Box minW="24px">
                {step.completed ? (
                  <Icon 
                    as={CheckCircle2} 
                    boxSize={5} 
                    color="green.600"
                  />
                ) : index === currentStepIndex ? (
                  <Spinner 
                    size="sm" 
                    color="blue.600"
                  />
                ) : (
                  <Icon 
                    as={Clock} 
                    boxSize={5} 
                    color="gray.400"
                  />
                )}
              </Box>

              {/* Step text */}
              <Text
                fontSize="sm"
                color={
                  step.completed 
                    ? "green.700" 
                    : index === currentStepIndex 
                      ? "blue.700" 
                      : "gray.600"
                }
                fontWeight={index === currentStepIndex ? "medium" : "normal"}
                flex={1}
              >
                {step.message}
              </Text>

              {/* Step status indicator */}
              {index === currentStepIndex && !step.completed && (
                <Box
                  w="8px"
                  h="8px"
                  bg="blue.400"
                  borderRadius="full"
                />
              )}
            </HStack>
          ))}
        </VStack>

        {/* Smart predictions footer */}
        <Box
          mt={2}
          p={3}
          bg="purple.50"
          borderRadius="lg"
          border="1px solid"
          borderColor="purple.100"
        >
          <HStack gap={2}>
            <Icon as={Sparkles} boxSize={4} color="purple.600" />
            <Text fontSize="xs" color="purple.700" fontWeight="medium">
              AI is analyzing property features, pricing, and guest reviews to find your perfect match
            </Text>
          </HStack>
        </Box>
      </VStack>
    </Box>
  )
}

// Simplified loading component for quick display
export function QuickSearchIndicator({ location }: { location: string }) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      p={4}
      boxShadow="sm"
      border="1px solid"
      borderColor="gray.100"
    >
      <HStack gap={3}>
        <Spinner size="sm" color="blue.500" />
        <VStack align="start" gap={0}>
          <Text fontSize="md" fontWeight="medium" color="gray.800">
            Searching in {location}...
          </Text>
          <Text fontSize="sm" color="gray.600">
            This will just take a moment
          </Text>
        </VStack>
      </HStack>
    </Box>
  )
}

// Smart results preview component
export function ResultsPreviewMessage({ 
  location, 
  preview, 
  estimatedResults 
}: { 
  location: string
  preview: string
  estimatedResults: number 
}) {
  return (
    <Box
      bg="blue.50"
      borderRadius="xl"
      p={5}
      border="1px solid"
      borderColor="blue.100"
    >
      <VStack gap={3} align="start">
        <HStack gap={3}>
          <Box
            p={2}
            bg="blue.100"
            borderRadius="lg"
            color="blue.700"
          >
            <Icon as={Search} boxSize={4} />
          </Box>
          <Text fontSize="md" fontWeight="semibold" color="gray.800">
            {preview}
          </Text>
        </HStack>

        <HStack gap={4} w="full">
          <HStack gap={2}>
            <Icon as={MapPin} boxSize={3} color="gray.500" />
            <Text fontSize="sm" color="gray.600">
              {location}
            </Text>
          </HStack>
          
          <HStack gap={2}>
            <Icon as={Star} boxSize={3} color="gray.500" />
            <Text fontSize="sm" color="gray.600">
              ~{estimatedResults} properties
            </Text>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  )
}