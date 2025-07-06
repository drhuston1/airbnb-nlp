import { Box, VStack, Text, HStack, Badge, Button, SimpleGrid } from '@chakra-ui/react'
import type { ChatMessage } from '../types'

interface ChatMessagesProps {
  messages: ChatMessage[]
  onFollowUpClick: (followup: string) => void
}

export const ChatMessages = ({ messages, onFollowUpClick }: ChatMessagesProps) => {
  return (
    <VStack gap={6} align="stretch">
      {messages.map((message, index) => (
        <Box key={index}>
          <HStack mb={2}>
            <Badge colorScheme={message.type === 'user' ? 'blue' : 'green'}>
              {message.type === 'user' ? 'You' : 'AI'}
            </Badge>
            <Text fontSize="xs" color="gray.500">
              {new Date(message.timestamp).toLocaleTimeString()}
            </Text>
          </HStack>
          
          <Box 
            bg={message.type === 'user' ? 'blue.50' : 'green.50'} 
            p={3} 
            borderRadius="lg"
            border="1px"
            borderColor={message.type === 'user' ? 'blue.100' : 'green.100'}
          >
            <Text>{message.content}</Text>
          </Box>
          
          {message.type === 'assistant' && message.followUps && message.followUps.length > 0 && (
            <Box mt={3}>
              <Text fontSize="sm" color="gray.600" mb={2}>
                Quick follow-ups:
              </Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                {message.followUps.map((followup, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant="outline"
                    onClick={() => onFollowUpClick(followup)}
                    fontSize="xs"
                    h="auto"
                    py={2}
                    px={3}
                    whiteSpace="normal"
                    textAlign="left"
                  >
                    {followup}
                  </Button>
                ))}
              </SimpleGrid>
            </Box>
          )}
        </Box>
      ))}
    </VStack>
  )
}