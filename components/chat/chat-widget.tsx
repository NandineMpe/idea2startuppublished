"use client"

import { useState, useEffect, useRef } from "react"
import { MessageCircle, X, Send, Loader2 } from "lucide-react"
import { getChatHistory, saveChatMessage, trackSectionVisit } from "@/app/actions/user-data"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: number
}

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat history
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        setIsLoading(true)
        const history = await getChatHistory()

        if (history && history.length > 0) {
          setMessages(history)
        } else {
          // Set default welcome message if no chat history
          const welcomeMessage: ChatMessage = {
            role: "assistant",
            content: "👋 Hi there! I'm Juno, your startup assistant. How can I help you today?",
            timestamp: Date.now(),
          }
          setMessages([welcomeMessage])
          await saveChatMessage(welcomeMessage)
        }
      } catch (error) {
        console.error("Error loading chat history:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadChatHistory()
  }, [])

  // Track when chat is opened
  useEffect(() => {
    if (isOpen) {
      trackSectionVisit("chat")
    }
  }, [isOpen])

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current && isOpen) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen])

  const handleSendMessage = async () => {
    if (!message.trim() || isSending) return

    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: Date.now(),
    }

    // Update local state immediately for better UX
    setMessages((prev) => [...prev, userMessage])
    setMessage("")
    setIsSending(true)

    try {
      // Save to KV
      await saveChatMessage(userMessage)

      // Simulate assistant response
      setTimeout(async () => {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: getAssistantResponse(message),
          timestamp: Date.now(),
        }

        // Update local state
        setMessages((prev) => [...prev, assistantMessage])

        // Save to KV
        await saveChatMessage(assistantMessage)
        setIsSending(false)
      }, 1000)
    } catch (error) {
      console.error("Error sending message:", error)
      setIsSending(false)
    }
  }

  const getAssistantResponse = (userMessage: string) => {
    const lowerCaseMessage = userMessage.toLowerCase()

    if (lowerCaseMessage.includes("hello") || lowerCaseMessage.includes("hi")) {
      return "Hello! How can I help with your startup journey today?"
    } else if (lowerCaseMessage.includes("business") && lowerCaseMessage.includes("idea")) {
      return "I'd be happy to help with your business idea! You can use our Business Idea Analyzer in the dashboard to get detailed feedback."
    } else if (lowerCaseMessage.includes("pitch") || lowerCaseMessage.includes("investor")) {
      return "Creating a compelling pitch is crucial. Check out our Pitch section in the dashboard for templates and guidance."
    } else if (lowerCaseMessage.includes("market") || lowerCaseMessage.includes("competitor")) {
      return "Understanding your market and competitors is essential. Our Market Analysis tools can help you gain valuable insights."
    } else if (lowerCaseMessage.includes("thank")) {
      return "You're welcome! I'm here to help whenever you need assistance with your startup."
    } else if (
      lowerCaseMessage.includes("save") ||
      lowerCaseMessage.includes("data") ||
      lowerCaseMessage.includes("remember")
    ) {
      return "Don't worry! I remember everything you do on the platform. Your data is automatically saved as you work, so you can pick up right where you left off."
    } else {
      return "I'm here to help with your startup journey. Feel free to ask about business ideas, market analysis, pitch creation, or any other startup-related questions!"
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="flex flex-col w-80 h-96 bg-black border border-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
            <div className="flex items-center space-x-2">
              <div className="relative w-8 h-8 rounded-full overflow-hidden">
                <img src="/juno-avatar.png" alt="Juno" className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-medium text-white">Juno</h3>
                <p className="text-xs text-gray-400">Startup Assistant</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-gray-950">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 text-primary animate-spin mr-2" />
                <span className="text-gray-400">Loading messages...</span>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className={`mb-4 ${msg.role === "user" ? "ml-auto" : "mr-auto"} max-w-[80%]`}>
                  <div
                    className={`p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-primary text-black rounded-br-none"
                        : "bg-gray-800 text-white rounded-bl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {isSending && (
              <div className="mb-4 mr-auto">
                <div className="p-3 rounded-lg bg-gray-800 text-white flex items-center">
                  <Loader2 className="h-4 w-4 text-gray-400 animate-spin mr-2" />
                  <span className="text-gray-400">Juno is typing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-800 bg-gray-900">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 p-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isSending}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || isSending}
                className="p-2 bg-primary text-black rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center w-12 h-12 bg-primary rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        >
          <MessageCircle size={24} className="text-black" />
        </button>
      )}
    </div>
  )
}
