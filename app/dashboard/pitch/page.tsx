"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PresentationIcon, Lightbulb, FileText, Download, Clock, ArrowRight } from "lucide-react"
import { ElevatorPitch } from "@/components/pitch/elevator-pitch"
import { FullPitch } from "@/components/pitch/full-pitch"
import { PitchExamples } from "@/components/pitch/pitch-examples"

export default function PitchVaultPage() {
  const [activeTab, setActiveTab] = useState("elevator-pitch")

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <PresentationIcon className="h-8 w-8 text-primary" />
            Pitch Vault
          </h1>
          <p className="text-white/60 mt-1">Craft compelling pitches and learn from successful startup presentations</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-black">
          <Download className="mr-2 h-4 w-4" />
          Download Pitch Template
        </Button>
      </div>

      <Card className="glass-card border-primary/10">
        <CardHeader className="pb-3">
          <CardTitle>Pitch Development Guide</CardTitle>
          <CardDescription>
            Your pitch is your startup's story. It should be clear, compelling and tailored to your audience.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center p-4 bg-black/50 rounded-lg border border-gray-800">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Elevator Pitch</h3>
              <p className="text-sm text-white/60 mb-3">30-second pitch that hooks interest and explains your value</p>
              <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setActiveTab("elevator-pitch")}>
                Start with this <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>

            <div className="flex flex-col items-center text-center p-4 bg-black/50 rounded-lg border border-gray-800">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Full Pitch</h3>
              <p className="text-sm text-white/60 mb-3">Comprehensive pitch that covers all aspects of your business</p>
              <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setActiveTab("full-pitch")}>
                Build your pitch <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>

            <div className="flex flex-col items-center text-center p-4 bg-black/50 rounded-lg border border-gray-800">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Lightbulb className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Pitch Examples</h3>
              <p className="text-sm text-white/60 mb-3">Learn from successful pitch decks that raised millions</p>
              <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setActiveTab("pitch-examples")}>
                View examples <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-black/50 border border-gray-800 rounded-lg h-auto p-1">
          <TabsTrigger
            value="elevator-pitch"
            className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"
          >
            Elevator Pitch
          </TabsTrigger>
          <TabsTrigger
            value="full-pitch"
            className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"
          >
            Full Pitch
          </TabsTrigger>
          <TabsTrigger
            value="pitch-examples"
            className="py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all"
          >
            Pitch Examples
          </TabsTrigger>
        </TabsList>
        <TabsContent value="elevator-pitch" className="mt-6">
          <ElevatorPitch />
        </TabsContent>
        <TabsContent value="full-pitch" className="mt-6">
          <FullPitch />
        </TabsContent>
        <TabsContent value="pitch-examples" className="mt-6">
          <PitchExamples />
        </TabsContent>
      </Tabs>
    </div>
  )
}
