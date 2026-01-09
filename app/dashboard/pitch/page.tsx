"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  PresentationIcon,
  Lightbulb,
  FileText,
  Download,
  Clock,
  ArrowRight,
  Zap,
  Sparkles,
  Trophy,
  Target
} from "lucide-react"
import { ElevatorPitch } from "@/components/pitch/elevator-pitch"
import { FullPitch } from "@/components/pitch/full-pitch"
import { PitchExamples } from "@/components/pitch/pitch-examples"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
}

export default function PitchVaultPage() {
  const [activeTab, setActiveTab] = useState("elevator-pitch")

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="p-8 max-w-7xl mx-auto space-y-12"
    >
      {/* Header Section */}
      <motion.div variants={item} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-medium tracking-widest uppercase text-xs">
            <PresentationIcon className="h-4 w-4" />
            Venture Narrative Engine
          </div>
          <h1 className="text-5xl font-extrabold text-white tracking-tighter">
            Pitch <span className="text-primary italic">Vault</span>
          </h1>
          <p className="text-white/50 max-w-2xl text-lg leading-relaxed">
            Craft narratives that captivate, convince, and conquer. From 30-second hooks to institutional-grade decks.
          </p>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" className="border-white/10 text-white hover:bg-white/5 rounded-full px-6">
            <Download className="mr-2 h-4 w-4" />
            Deck Guidelines
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-black font-bold rounded-full px-8 shadow-[0_0_20px_rgba(39,174,96,0.3)]">
            <Zap className="mr-2 h-4 w-4" />
            Generate with Juno
          </Button>
        </div>
      </motion.div>

      {/* Strategy Selector */}
      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            id: "elevator-pitch",
            title: "Elevator Pitch",
            desc: "The Hook: 30 seconds to win a meeting.",
            icon: Clock,
            color: "text-primary",
            bg: "bg-primary/5"
          },
          {
            id: "full-pitch",
            title: "Full Narrative",
            desc: "The Story: Comprehensive business architecture.",
            icon: FileText,
            color: "text-blue-400",
            bg: "bg-blue-400/5"
          },
          {
            id: "pitch-examples",
            title: "Unicorn Decks",
            desc: "The Blueprint: Learn from the masters.",
            icon: Trophy,
            color: "text-amber-400",
            bg: "bg-amber-400/5"
          }
        ].map((card) => (
          <motion.div
            key={card.id}
            whileHover={{ y: -5 }}
            onClick={() => setActiveTab(card.id)}
            className={`cursor-pointer p-6 rounded-3xl border border-white/5 transition-all duration-300 relative group overflow-hidden ${activeTab === card.id ? "bg-white/[0.05] border-white/20 ring-1 ring-white/10" : "bg-white/[0.02] hover:bg-white/[0.04]"
              }`}
          >
            <div className={`w-12 h-12 rounded-2xl ${card.bg} flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500`}>
              <card.icon className={`h-6 w-6 ${card.color}`} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{card.title}</h3>
            <p className="text-sm text-white/40 mb-4">{card.desc}</p>
            <div className={`inline-flex items-center text-xs font-bold uppercase tracking-widest ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
              Customize <ArrowRight className="ml-2 h-3 w-3" />
            </div>

            {activeTab === card.id && (
              <motion.div
                layoutId="active-pill"
                className="absolute top-4 right-4 h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(39,174,96,1)]"
              />
            )}
          </motion.div>
        ))}
      </motion.div>

      {/* Main Content Area */}
      <motion.div variants={item} className="space-y-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3 }}
            >
              <TabsContent value="elevator-pitch" className="mt-0 ring-0 focus-visible:ring-0 outline-none">
                <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/10 via-transparent to-transparent p-8 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="p-2 rounded-lg bg-primary/20 text-primary">
                        <Sparkles size={16} />
                      </span>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Elevator Pitch Builder</h2>
                    </div>
                    <p className="text-white/40 text-sm">Perfect your high-stakes introduction using proven psychological frameworks.</p>
                  </div>
                  <ElevatorPitch />
                </div>
              </TabsContent>

              <TabsContent value="full-pitch" className="mt-0 ring-0 focus-visible:ring-0 outline-none">
                <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-400/10 via-transparent to-transparent p-8 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="p-2 rounded-lg bg-blue-400/20 text-blue-400">
                        <Target size={16} />
                      </span>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Full Narrative Architect</h2>
                    </div>
                    <p className="text-white/40 text-sm">Construct a multi-dimensional story that covers every facet of your vision.</p>
                  </div>
                  <FullPitch />
                </div>
              </TabsContent>

              <TabsContent value="pitch-examples" className="mt-0 ring-0 focus-visible:ring-0 outline-none">
                <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-400/10 via-transparent to-transparent p-8 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="p-2 rounded-lg bg-amber-400/20 text-amber-400">
                        <Trophy size={16} />
                      </span>
                      <h2 className="text-2xl font-bold text-white tracking-tight">Venture Hall of Fame</h2>
                    </div>
                    <p className="text-white/40 text-sm">Deconstruct the decks that birthed the world's most valuable companies.</p>
                  </div>
                  <PitchExamples />
                </div>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
