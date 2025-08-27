import { Box, VStack, Text, Icon, Flex, Button } from '@chakra-ui/react'
import { MessageSquare, RotateCcw } from 'lucide-react'
import { ChatMessages } from './ChatMessages'
import { SearchInput } from './SearchInput'
import type { ChatMessage } from '../types'

interface SidebarProps {
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onSearch: () => void
  onSpeechToggle: () => void
  messages: ChatMessage[]
  onFollowUpClick: (followup: string) => void
  onNewConversation: () => void
  isLoading: boolean
  isListening: boolean
  speechSupported: boolean
}

export const Sidebar = ({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onSpeechToggle,
  messages,
  onFollowUpClick,
  onNewConversation,
  isLoading,
  isListening,
  speechSupported
}: SidebarProps) => {
  return (
    <Box 
      w="400px" 
      h="100vh" 
      bg="gray.50" 
      borderRight="1px" 
      borderColor="gray.200"
      position="fixed"
      left={0}
      top={0}
      zIndex={1000}
    >
      <VStack h="100%" gap={0}>
        {/* Header */}
        <Box w="100%" p={4} bg="white" borderBottom="1px" borderColor="gray.200">
          <Flex align="center" justify="space-between" mb={3}>
            <Flex align="center" gap={2}>
              <Icon as={MessageSquare} w={5} h={5} color="green.600" />
              <Text fontWeight="bold" color="gray.800">Chat</Text>
            </Flex>
            <Button
              size="sm"
              variant="ghost"
              onClick={onNewConversation}
            >
              <Flex align="center" gap={1}>
                <RotateCcw size={14} />
                New
              </Flex>
            </Button>
          </Flex>
          
          <SearchInput
            value={searchQuery}
            onChange={onSearchQueryChange}
            onSubmit={onSearch}
            onSpeechToggle={onSpeechToggle}
            placeholder="Ask about Airbnb rentals..."
            disabled={isLoading}
            isListening={isListening}
            speechSupported={speechSupported}
            size="sm"
          />
        </Box>

        {/* Messages */}
        <Box flex={1} w="100%" p={4} overflowY="auto">
          {messages.length === 0 ? (
            <Box textAlign="center" mt={8}>
              <Text color="gray.500" fontSize="sm">
                Start a conversation about Airbnb rentals!
              </Text>
              <VStack gap={1} mt={2}>
                <Text color="gray.400" fontSize="xs">Try these examples:</Text>
                <Text color="gray.400" fontSize="xs">"Business trip to Austin next week"</Text>
                <Text color="gray.400" fontSize="xs">"Romantic getaway for our anniversary"</Text>
                <Text color="gray.400" fontSize="xs">"Family vacation with kids, need pool"</Text>
              </VStack>
            </Box>
          ) : (
            <ChatMessages messages={messages} onFollowUpClick={onFollowUpClick} />
          )}
        </Box>
      </VStack>
    </Box>
  )
}