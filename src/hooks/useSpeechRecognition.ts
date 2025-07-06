import { useState, useEffect, useRef } from 'react'

export const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        setSpeechSupported(true)
        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'
        
        recognition.onstart = () => {
          setIsListening(true)
        }
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
        }
        
        recognition.onend = () => {
          setIsListening(false)
        }
        
        recognitionRef.current = recognition
      }
    }
  }, [])

  const startListening = (onResult: (transcript: string) => void) => {
    if (recognitionRef.current && speechSupported) {
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        onResult(transcript)
      }
      recognitionRef.current.start()
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }

  const toggleListening = (onResult: (transcript: string) => void) => {
    if (isListening) {
      stopListening()
    } else {
      startListening(onResult)
    }
  }

  return {
    isListening,
    speechSupported,
    startListening,
    stopListening,
    toggleListening
  }
}