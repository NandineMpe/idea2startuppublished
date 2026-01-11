"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, Search, Plus, FileText, Hash, Link as LinkIcon, Calendar, ArrowRight, Loader2, Database } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { addToMemory, queryMemory } from "@/lib/supermemory"
import { useToast } from "@/hooks/use-toast"

export default function KnowledgeBank() {
    const { toast } = useToast()
    const [searchQuery, setSearchQuery] = useState("")
    const [activeTab, setActiveTab] = useState("all")
    const [inputContent, setInputContent] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [memories, setMemories] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Simulated initial fetch or search effect
    useEffect(() => {
        handleSearch()
    }, [])

    const handleSearch = async () => {
        setIsSearching(true)
        try {
            // If query is empty, maybe show recent? Supermemory might not support "all" query easily without vector search details
            // We'll search for "startup" or generic term if empty to populate something, or just wait for user input
            const query = searchQuery || "startup founder notes"
            const results = await queryMemory(query)
            if (results) {
                setMemories(results)
            }
        } catch (error) {
            console.error("Failed to fetch memories", error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleQuickAdd = async () => {
        if (!inputContent.trim()) return

        setIsAdding(true)
        try {
            await addToMemory(inputContent)
            toast({
                title: "Memory Stored",
                description: "Your insight has been added to your second brain.",
            })
            setInputContent("")
            handleSearch() // Refresh list
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to store memory.",
                variant: "destructive",
            })
        } finally {
            setIsAdding(false)
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 h-full flex flex-col">
            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6"
            >
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                        <Brain className="h-8 w-8 text-primary" />
                        Founder's Super Brain
                    </h1>
                    <p className="text-white/50 max-w-xl">
                        Your centralized neural network. Capture insights, strategies, and meetings in one place.
                        Juno recalls everything so you don't have to.
                    </p>
                </div>
            </motion.div>

            {/* Quick Add Interface */}
            <Card className="bg-gradient-to-br from-primary/5 via-black to-black border-primary/20 shadow-lg shadow-primary/5">
                <CardContent className="p-6">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <textarea
                                placeholder="What's on your mind? Capture a strategy, meeting note, or random insight..."
                                className="w-full bg-transparent border-none text-lg text-white placeholder:text-white/30 resize-none focus:outline-none min-h-[80px]"
                                value={inputContent}
                                onChange={(e) => setInputContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleQuickAdd();
                                    }
                                }}
                            />
                        </div>
                        <div className="flex flex-col justify-end">
                            <Button
                                onClick={handleQuickAdd}
                                disabled={isAdding || !inputContent.trim()}
                                className="rounded-full h-12 w-12 bg-primary text-black hover:bg-primary/90 shadow-[0_0_15px_rgba(39,174,96,0.3)] transition-all"
                            >
                                {isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}
                            </Button>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4 text-xs text-white/40">
                        <Badge variant="outline" className="border-white/10 hover:border-primary/50 cursor-pointer transition-colors">
                            <Hash className="h-3 w-3 mr-1" /> Strategy
                        </Badge>
                        <Badge variant="outline" className="border-white/10 hover:border-primary/50 cursor-pointer transition-colors">
                            <Calendar className="h-3 w-3 mr-1" /> Meeting
                        </Badge>
                        <Badge variant="outline" className="border-white/10 hover:border-primary/50 cursor-pointer transition-colors">
                            <LinkIcon className="h-3 w-3 mr-1" /> Resource
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Knowledge Base Navigation & Grid */}
            <div className="flex-1 space-y-6">
                <div className="flex justify-between items-center">
                    <Tabs defaultValue="all" className="w-[400px]" onValueChange={setActiveTab}>
                        <TabsList className="bg-white/5 border border-white/5">
                            <TabsTrigger value="all">Recent</TabsTrigger>
                            <TabsTrigger value="ideas">Ideas</TabsTrigger>
                            <TabsTrigger value="docs">Strategies</TabsTrigger>
                            <TabsTrigger value="meetings">External</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <Input
                            placeholder="Search your brain..."
                            className="pl-9 bg-black border-white/10 text-white rounded-full focus:border-primary/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                </div>

                {isSearching ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <ScrollArea className="h-[500px] w-full pr-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {memories.length > 0 ? (
                                memories.map((memory, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <Card className="bg-white/[0.02] border-white/5 hover:border-primary/20 hover:bg-white/[0.05] transition-all cursor-pointer group h-full flex flex-col">
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start">
                                                    <Database className="h-4 w-4 text-primary/50 group-hover:text-primary transition-colors" />
                                                    {/* Assuming memory object has some metadata or timestamp, otherwise mock */}
                                                    <span className="text-[10px] text-white/30 uppercase tracking-wider">Synced</span>
                                                </div>
                                                <CardDescription className="text-white/80 line-clamp-4 pt-2">
                                                    {memory.content}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent className="mt-auto pt-4 flex gap-2">
                                                <Badge variant="secondary" className="text-[10px] bg-white/5 text-white/50">insight</Badge>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                ))
                            ) : (
                                <div className="col-span-full flex flex-col items-center justify-center h-64 text-white/30 italic">
                                    <Database className="h-12 w-12 mb-4 opacity-20" />
                                    Your centralized brain is empty. Start adding insights above.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </div>
        </div>
    )
}
