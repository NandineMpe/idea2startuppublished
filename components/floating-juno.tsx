"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, X, Send, Sparkles, Loader2, Minimize2, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface Message {
    role: "user" | "assistant"
    content: string
}

export default function FloatingJuno() {
    const [isOpen, setIsOpen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [input, setInput] = useState("")
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hey Founder! I'm Juno, your startup sidekick. How can I help you build today?",
        },
    ])
    const [isLoading, setIsLoading] = useState(false)

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMessage: Message = { role: "user", content: input }
        setMessages((prev) => [...prev, userMessage])
        setInput("")
        setIsLoading(true)

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: [...messages, userMessage] }),
            })

            if (!response.ok) throw new Error("Failed to get response")

            const data = await response.json()
            setMessages((prev) => [...prev, { role: "assistant", content: data.text }])
        } catch (error) {
            console.error("Chat error:", error)
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, I hit a snag. Let's try that again?" },
            ])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className={`mb-4 w-80 md:w-96 glass-card overflow-hidden flex flex-col shadow-2xl rounded-2xl border-primary/20 ${isMinimized ? 'h-16' : 'h-[500px]'}`}
                    >
                        {/* Header */}
                        <div className="p-4 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Avatar className="h-8 w-8 border border-primary/50">
                                        <AvatarImage src="/juno-avatar.png" alt="Juno" />
                                        <AvatarFallback className="bg-primary text-black font-bold text-xs">JU</AvatarFallback>
                                    </Avatar>
                                    <span className="absolute bottom-0 right-0 h-2 w-2 bg-green-500 rounded-full border border-black animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.8)]"></span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                                        Juno <Sparkles className="h-3 w-3 text-primary" />
                                    </h3>
                                    <p className="text-[10px] text-white/50 leading-none">Your AI Sidekick • Online</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5"
                                    onClick={() => setIsMinimized(!isMinimized)}
                                >
                                    {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X size={16} />
                                </Button>
                            </div>
                        </div>

                        {!isMinimized && (
                            <>
                                {/* Chat Area */}
                                <ScrollArea className="flex-1 p-4 space-y-4">
                                    {messages.map((msg, i) => (
                                        <div
                                            key={i}
                                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}
                                        >
                                            <div
                                                className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === "user"
                                                        ? "bg-primary text-black rounded-tr-none"
                                                        : "bg-white/10 text-white rounded-tl-none border border-white/5"
                                                    }`}
                                            >
                                                {msg.content}
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-white/10 p-3 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                <span className="text-xs text-white/50">Juno is thinking...</span>
                                            </div>
                                        </div>
                                    )}
                                </ScrollArea>

                                {/* Input Area */}
                                <div className="p-4 bg-white/5 border-t border-white/10">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Ask Juno anything..."
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                            className="bg-black/50 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50 rounded-full h-10"
                                        />
                                        <Button
                                            onClick={handleSend}
                                            disabled={isLoading || !input.trim()}
                                            className="rounded-full h-10 w-10 p-0 bg-primary hover:bg-primary/90 text-black shadow-[0_0_15px_rgba(39,174,96,0.3)] transition-all duration-300"
                                        >
                                            <Send size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.1, rotate: 5 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className="h-14 w-14 rounded-full bg-primary text-black flex items-center justify-center shadow-[0_0_20px_rgba(39,174,96,0.4)] hover:shadow-[0_0_30px_rgba(39,174,96,0.6)] transition-all duration-300 relative group overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </motion.button>
        </div>
    )
}
