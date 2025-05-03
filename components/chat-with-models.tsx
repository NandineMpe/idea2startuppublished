"use client"

import { useState } from "react"
import { useChat } from "ai/react"
import { ModelSelector, type ModelInfo } from "./model-selector"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export function ChatWithModels() {
  const [selectedModel, setSelectedModel] = useState<ModelInfo>({
    value: "openai",
    label: "OpenAI GPT-4",
    apiRoute: "/api/chat/openai",
  })

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: selectedModel.apiRoute,
  })

  const handleModelChange = (model: ModelInfo) => {
    setSelectedModel(model)
  }

  return (
    <Card className="w-full max-w-3xl mx-auto glass-card border-primary/10">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Chat</span>
          <div className="w-48">
            <ModelSelector onModelChange={handleModelChange} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[400px] overflow-y-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg ${
              message.role === "user" ? "bg-primary/10 ml-auto max-w-[80%]" : "bg-gray-800/50 mr-auto max-w-[80%]"
            }`}
          >
            <p className="text-sm font-medium mb-1">{message.role === "user" ? "You" : selectedModel.label}</p>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </CardContent>
      <CardFooter>
        <form onSubmit={handleSubmit} className="w-full flex gap-2">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message..."
            className="flex-1 min-h-[60px] max-h-[120px] bg-black/50 border-gray-800 focus:border-primary"
          />
          <Button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-primary hover:bg-primary/90 text-black self-end h-[60px]"
          >
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
