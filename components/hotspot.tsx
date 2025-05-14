"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface FounderInfo {
  id: number
  name: string
  project: string
  product: string
  description: string
  color: string
  opacity: number
  isJuno?: boolean
  position: {
    left: string
    top: string
  }
}

interface HotspotProps {
  position: {
    left: string
    top: string
  }
  founder: FounderInfo
}

export default function Hotspot({ position, founder }: HotspotProps) {
  const [isOpen, setIsOpen] = useState(false)

  const toggleHotspot = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div
      className="absolute z-20"
      style={{
        left: position.left,
        top: position.top,
      }}
    >
      {/* Hotspot button */}
      <motion.button
        className={`relative h-5 w-5 rounded-full ${founder.isJuno ? "bg-cyan-500" : "bg-[#27ae60]"}`}
        style={{ opacity: founder.opacity }}
        onClick={toggleHotspot}
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 1 + founder.id * 0.1,
        }}
      >
        <span className="absolute -inset-1 animate-ping rounded-full bg-[#27ae60] opacity-20"></span>
      </motion.button>

      {/* Founder info popup */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute z-30 w-72 md:w-80 bg-black/90 backdrop-blur-lg border border-[#32CD32]/30 p-4 rounded-md shadow-xl"
            style={{
              top: "calc(100% + 10px)",
              left: "-120px",
              transformOrigin: "top center",
            }}
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <button onClick={() => setIsOpen(false)} className="absolute top-2 right-2 text-white/60 hover:text-white">
              <X size={16} />
            </button>

            <div className="mb-2">
              <h3 className={`text-lg font-medium ${founder.isJuno ? "text-cyan-400" : "text-[#32CD32]"}`}>
                {founder.name}
              </h3>
              <p className="text-white/90 text-sm font-medium">{founder.project}</p>
              <p className="text-white/70 text-xs mt-1">{founder.product}</p>
            </div>

            <div className="mt-3 text-white/80 text-sm whitespace-pre-line leading-relaxed">{founder.description}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
