"use client"

import { useState, useEffect } from "react"
import { Brain, Search, Plus, ArrowRight, Loader2, Database, User, Sparkles, Layers } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { addToMemory, queryMemory } from "@/lib/supermemory"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function KnowledgeBank() {
    const { toast } = useToast()
    const [searchQuery, setSearchQuery] = useState("")
    const [inputContent, setInputContent] = useState("")
    const [isAdding, setIsAdding] = useState(false)
    const [memories, setMemories] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)

    // Initial load
    useEffect(() => {
        handleSearch()
    }, [])

    const handleSearch = async () => {
        setIsSearching(true)
        try {
            const query = searchQuery || "startup strategy insights"
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
            toast({ title: "Insight Synced", description: "Added to your neural network." })
            setInputContent("")
            handleSearch()
        } catch (error) {
            toast({ title: "Error", description: "Failed to store memory.", variant: "destructive" })
        } finally {
            setIsAdding(false)
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 min-h-full">
            {/* Header / Brain Status */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                        <Brain className="h-10 w-10 text-primary" />
                        Founder's Super Brain
                    </h1>
                    <p className="text-white/50 max-w-2xl text-lg">
                        The central nervous system of your startup. Connect your identity, uploaded knowledge, and raw insights into one intelligence layer.
                    </p>
                </div>
                <div className="hidden md:block text-right space-y-2">
                    <div className="flex items-center gap-2 justify-end text-sm text-primary font-medium">
                        <Sparkles className="h-4 w-4" />
                        Brain Health: Optimization Active
                    </div>
                    <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[65%]" />
                    </div>
                    <p className="text-xs text-white/30">Based on data density & connectivity</p>
                </div>
            </div>

            {/* Main Action Grid - The "Input Layer" */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* 1. Identity Node */}
                <Link href="/dashboard/knowledge/founders-journey" className="group">
                    <Card className="h-full bg-white/[0.02] border-white/5 group-hover:border-primary/50 group-hover:bg-primary/5 transition-all duration-300">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-white">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <User className="h-6 w-6" />
                                </div>
                                Founder Identity
                            </CardTitle>
                            <CardDescription className="text-white/60">
                                Who you are. Your story, credibility, and unique advantages.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <div className="flex items-center text-sm text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
                                Calibrate Identity <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </CardFooter>
                    </Card>
                </Link>

                {/* 2. Domain Knowledge Node */}
                <Link href="/dashboard/knowledge/domain" className="group">
                    <Card className="h-full bg-white/[0.02] border-white/5 group-hover:border-primary/50 group-hover:bg-primary/5 transition-all duration-300">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-white">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                    <Layers className="h-6 w-6" />
                                </div>
                                Domain Knowledge
                            </CardTitle>
                            <CardDescription className="text-white/60">
                                What you know. Upload industry reports, data, and expert context.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <div className="flex items-center text-sm text-emerald-400 font-medium group-hover:translate-x-1 transition-transform">
                                Ingest Documents <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        </CardFooter>
                    </Card>
                </Link>

                {/* 3. Raw Insight Node (Quick Capture) */}
                <Card className="h-full bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-3 text-white">
                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                                <Sparkles className="h-6 w-6" />
                            </div>
                            Quick Synapse
                        </CardTitle>
                        <CardDescription className="text-white/60">
                            Capture a fleeting thought or strategy right now.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <Input
                                placeholder="E.g. Competitor X just raised prices..."
                                className="bg-black/50 border-purple-500/30 text-white placeholder:text-white/20"
                                value={inputContent}
                                onChange={(e) => setInputContent(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
                            />
                            <Button size="icon" onClick={handleQuickAdd} disabled={isAdding} className="bg-purple-600 hover:bg-purple-500">
                                {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Neural Recall Section */}
            <div className="space-y-6 pt-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary" />
                        Active Neural Pathways
                    </h2>
                    <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                        <Input
                            placeholder="Search across all memories and signals..."
                            className="pl-9 bg-black/20 border-white/10 text-white rounded-full focus:border-primary/50"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                </div>

                <Card className="bg-black/20 border-white/5 backdrop-blur-xl">
                    <CardContent className="p-0">
                        {isSearching ? (
                            <div className="flex justify-center py-24">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 border border-white/5 rounded-lg overflow-hidden">
                                {memories.map((memory, i) => (
                                    <div key={i} className="bg-black/90 p-6 hover:bg-black/80 transition-colors group cursor-pointer space-y-4">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="text-xs border-primary/20 text-primary bg-primary/5">
                                                Memory Node
                                            </Badge>
                                            <span className="text-[10px] text-white/20 font-mono">ID: {Math.random().toString(36).substr(2, 6)}</span>
                                        </div>
                                        <p className="text-white/80 text-sm leading-relaxed line-clamp-4">
                                            {memory.content}
                                        </p>
                                        <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                            <span className="text-[10px] text-white/40">Active Context</span>
                                        </div>
                                    </div>
                                ))}
                                {memories.length === 0 && (
                                    <div className="col-span-full py-20 text-center text-white/30">
                                        No connections found. Try broadening your search.
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
