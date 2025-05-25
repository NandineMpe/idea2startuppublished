"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Hotspot from "@/components/hotspot"
import { TooltipProvider } from "@/components/ui/tooltip"
import Preloader from "@/components/preloader"
import { useAuth } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

export default function Home() {
  const [isHovered, setIsHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const { isSignedIn, isLoaded } = useAuth()
  const router = useRouter()

  // Founder information for hotspots with non-linear positioning
  const founders = [
    // Juno hotspot - moved 10% to the left
    {
      id: 0,
      position: { left: "75.47%", top: "39.84%" }, // Moved 10% to the left from 85.47%
      name: "Juno",
      project: "Your Startup Sidekick",
      product: "Personal startup companion.",
      description: `I'm Juno.
Think of me as your personal startup sidekick. But I'm not here to cheerlead. I'm here to challenge your thinking, sharpen your direction, and help you build something that actually matters.

Because average doesn't get funded.
It doesn't get shipped.
And it sure as hell doesn't change the world.`,
      color: "cyan",
      opacity: 1,
      isJuno: true,
    },
    // Green dots - positions unchanged
    {
      id: 1,
      position: { left: "14.38%", top: "39.84%" },
      name: "Alex Chen",
      project: "Healthcare Platform",
      product: "A platform that helps doctors diagnose rare diseases faster using patient symptom history.",
      description: `"I was struggling to explain why our platform mattered beyond the buzzwords. I fed our clinical concept into the Pitch Vault, and it rewrote our entire investor pitch—framing it as a way to reduce diagnostic delays by 47% in rare disease cases. That stat came from the Deep Consumer Insights module, which sourced NIH data I hadn't even thought to reference. Within 2 weeks, that version of the deck landed us our first angel meeting."`,
      color: "emerald",
      opacity: 0.5,
    },
    {
      id: 2,
      position: { left: "20.63%", top: "37.89%" },
      name: "Maya Rodriguez",
      project: "Sustainable Supply Chain Analytics",
      product: "A B2B dashboard that helps manufacturing companies optimize for carbon emissions.",
      description: `"We kept pitching ourselves as a 'sustainability tool,' and no one cared. But the Competitor Analysis tool revealed that players like Ecochain and Planetly were focusing heavily on ESG reporting—not real-time tracking. So we repositioned. We now lead with: 'We cut Scope 3 emissions by 22% in the first 90 days of use.' That line came straight from the Value Proposition Generator. It changed how customers and investors heard us."`,
      color: "emerald",
      opacity: 0.6,
    },
    {
      id: 3,
      position: { left: "26.88%", top: "41.80%" },
      name: "Daniel Kim",
      project: "On-Demand Lab Testing Platform",
      product: "A consumer service for booking and managing lab tests from home.",
      description: `"Our pricing model was off. We were charging $80 per test. After running a go-to-market plan with TAM/SAM/SOM, it showed that our SOM at $80 was just 6,000 customers nationwide. I reran it using a $35 loss-leader entry test model, and the SOM jumped to 42,000. That one pricing pivot is why we closed our first 3 enterprise clients—because now we had scale."`,
      color: "emerald",
      opacity: 0.7,
    },
    {
      id: 4,
      position: { left: "5.5%", top: "39.06%" },
      name: "Leila Ahmed",
      project: "Remote Team Culture Toolkit",
      product: "Interactive tools for remote teams to build better culture asynchronously.",
      description: `"My founder story was too soft. I thought my 'why' wasn't interesting. But the Founder Story Builder helped me draw a line from managing PTSD in remote teams at my last job to why this platform had to exist. That emotional hook—the 'aha moment'—was turned into a VC-ready narrative. I used it in my YC application and got a first-round interview."`,
      color: "emerald",
      opacity: 0.8,
    },
    {
      id: 5,
      position: { left: "9.5%", top: "41.02%" },
      name: "James Okafor",
      project: "Smart Microgrid Solutions",
      product: "Modular energy infrastructure for rural African villages.",
      description: `"I knew the need, but not the market. The Go-To-Market Planner pulled demand data reports to show that our SAM in Sub-Saharan Africa wasn't 10M people—it was 2.6M with the infrastructure to pay today. That changed our hardware distribution plan. Instead of 14 countries, we started in 3 with the highest mobile money adoption—and just landed a partnership with a telecom provider in Ghana."`,
      color: "emerald",
      opacity: 0.75,
    },
  ]

  const handleDashboardClick = () => {
    if (!isLoaded) return // Wait for auth to load

    if (isSignedIn) {
      router.push("/dashboard")
    } else {
      // Use Clerk's standard sign-in route
      router.push("/sign-in")
    }
  }

  useEffect(() => {
    // Fixed image preloading approach
    try {
      const bgImage = new Image()
      bgImage.src =
        "https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Website%20backgrounds/upscalemedia-transformed-ojypcL68F0lDklQoXOOWH8FcZ92dro.png"

      bgImage.onload = () => {
        console.log("Background image loaded successfully")
      }

      bgImage.onerror = (error) => {
        console.error("Failed to load background image", error)
      }
    } catch (error) {
      console.error("Error in image preloading:", error)
    }

    // Set a minimum display time for the preloader (5 seconds)
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black">
      {isLoading && <Preloader />}

      {/* Dashboard Navigation */}
      <div className="absolute top-0 right-0 z-40 p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.5 }}
        >
          <Button
            onClick={handleDashboardClick}
            disabled={!isLoaded}
            className="bg-black/40 backdrop-blur-md border border-primary/30 text-white hover:bg-primary/20 hover:border-primary transition-all duration-300 rounded-md px-6 py-2 text-sm font-medium"
          >
            {!isLoaded ? "Loading..." : isSignedIn ? "My Dashboard" : "Sign In"}
          </Button>
        </motion.div>
      </div>

      {/* Hero Section with Train */}
      <section className="relative h-screen overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="https://cvjdrblhcif4qupj.public.blob.vercel-storage.com/Website%20backgrounds/upscalemedia-transformed-ojypcL68F0lDklQoXOOWH8FcZ92dro.png"
            alt="Startup Train with entrepreneur"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Interactive Hotspots */}
        <TooltipProvider>
          {founders.map((founder) => (
            <Hotspot key={founder.id} position={founder.position} founder={founder} />
          ))}
        </TooltipProvider>

        {/* Main Content */}
        <motion.div
          className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          <motion.div
            className="max-w-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            <h1 className="text-4xl md:text-6xl font-light text-white mb-6 tracking-tight leading-tight">
              Hey, <span className="text-primary font-normal">Founder Extraordinaire</span>.
              <br />
              We've Been Expecting You.
            </h1>

            <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-12 font-light leading-relaxed">
              Your idea is the ticket and it deserves to be in motion. Hop on and join other founders enroute to
              building the future — with the right intelligence, at the right time.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
              >
                <Button
                  onClick={handleDashboardClick}
                  disabled={!isLoaded}
                  className={`relative bg-transparent border-2 border-primary text-white hover:bg-primary/10 px-12 py-6 rounded-none text-lg font-light tracking-wider uppercase transition-all duration-300 overflow-hidden ${
                    isHovered ? "pl-10 pr-14" : "px-12"
                  }`}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  <span className="relative z-10 flex items-center">
                    {!isLoaded ? "Loading..." : isHovered ? "Yes, Let's Go" : "Hop On?"}
                    {isHovered && (
                      <motion.span
                        className="ml-2 text-primary"
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      >
                        →
                      </motion.span>
                    )}
                  </span>
                </Button>
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            className="absolute bottom-8 flex flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
          >
            <p className="text-white/60 text-sm mb-3">
              Click on the founders on the train, and Juno, to learn more about their stories.
            </p>
          </motion.div>
        </motion.div>
      </section>
    </div>
  )
}
