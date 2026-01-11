"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Hotspot from "@/components/hotspot"
import { TooltipProvider } from "@/components/ui/tooltip"
import Preloader from "@/components/preloader"
import { useRouter } from "next/navigation"

export default function Home() {
  const [isHovered, setIsHovered] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
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
  ]

  const handleDashboardClick = () => {
    router.push("/dashboard")
  }

  useEffect(() => {
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
            className="bg-black/40 backdrop-blur-md border border-primary/30 text-white hover:bg-primary/20 hover:border-primary transition-all duration-300 rounded-md px-6 py-2 text-sm font-medium"
          >
            Launch Terminal
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
                  className={`relative bg-transparent border-2 border-primary text-white hover:bg-primary/10 px-12 py-6 rounded-none text-lg font-light tracking-wider uppercase transition-all duration-300 overflow-hidden ${isHovered ? "pl-10 pr-14" : "px-12"
                    }`}
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  <span className="relative z-10 flex items-center">
                    {isHovered ? "Yes, Let's Go" : "Hop On?"}
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
