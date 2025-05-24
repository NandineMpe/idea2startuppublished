"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"

export default function Preloader() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 1
        })
      }, 50) // 5 seconds total (50ms * 100 steps)

      return () => clearInterval(interval)
    }, 300) // Small delay before starting

    return () => clearTimeout(timer)
  }, [])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      animate={{
        opacity: progress === 100 ? 0 : 1,
        pointerEvents: progress === 100 ? "none" : "auto",
      }}
      transition={{ duration: 0.8 }}
    >
      <div className="relative w-24 h-24 mb-8">
        {/* Simplified logo animation instead of using Image component */}
        <div className="w-24 h-24 rounded-full border-4 border-primary flex items-center justify-center">
          <div className="w-12 h-12 bg-primary/20 rounded-full"></div>
        </div>
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.5, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 rounded-full border-2 border-primary opacity-50"></div>
        </motion.div>
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 0.8, opacity: 0.3 }}
          animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.3, 0.7, 0.3] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2, ease: "easeInOut" }}
        >
          <div className="absolute inset-0 rounded-full border border-primary opacity-30"></div>
        </motion.div>
      </div>

      <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: "easeOut" }}
        />
      </div>

      <motion.p
        className="mt-4 text-sm text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Preparing your startup journey...
      </motion.p>
    </motion.div>
  )
}
