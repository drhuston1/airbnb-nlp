import { Box, Button, HStack, Icon, Textarea } from '@chakra-ui/react'
import { Send, Mic, MicOff } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onSpeechToggle: () => void
  placeholder: string
  disabled?: boolean
  isListening?: boolean
  speechSupported?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const SearchInput = ({
  value,
  onChange,
  onSubmit,
  onSpeechToggle,
  placeholder,
  disabled = false,
  isListening = false,
  speechSupported = false,
  size = 'md'
}: SearchInputProps) => {
  const heights = {
    sm: '44px',
    md: '52px',
    lg: '52px'
  }

  const micSizes = {
    sm: { w: '28px', h: '28px', iconSize: 3 },
    md: { w: '32px', h: '32px', iconSize: 4 },
    lg: { w: '32px', h: '32px', iconSize: 4 }
  }

  const height = heights[size]
  const micSize = micSizes[size]

  return (
    <HStack gap={3}>
      <Box position="relative" flex="1">
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSubmit()
            }
          }}
          resize="none"
          minH={height}
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
          py={size === 'sm' ? 3 : 4}
          px={4}
          pr={speechSupported ? (size === 'sm' ? "44px" : "48px") : "16px"}
          fontSize={size === 'sm' ? 'sm' : 'md'}
        />
        {speechSupported && (
          <Button
            position="absolute"
            right={size === 'sm' ? "6px" : "8px"}
            top="50%"
            transform="translateY(-50%)"
            size="sm"
            variant="ghost"
            onClick={onSpeechToggle}
            bg={isListening ? "red.100" : "gray.100"}
            color={isListening ? "red.600" : "gray.600"}
            _hover={{ 
              bg: isListening ? "red.200" : "gray.200" 
            }}
            borderRadius="lg"
            w={micSize.w}
            h={micSize.h}
            minW={micSize.w}
          >
            <Icon as={isListening ? MicOff : Mic} w={micSize.iconSize} h={micSize.iconSize} />
          </Button>
        )}
      </Box>
      <Button
        onClick={onSubmit}
        disabled={!value.trim() || disabled}
        size={size}
        bg="green.600"
        color="white"
        _hover={{ bg: "green.700" }}
        _disabled={{ 
          bg: "gray.300",
          color: "gray.500"
        }}
        borderRadius="xl"
        px={size === 'sm' ? 4 : 6}
        h={height}
      >
        <Icon as={Send} w={4} h={4} />
      </Button>
    </HStack>
  )
}