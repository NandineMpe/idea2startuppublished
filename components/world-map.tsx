"use client"

import { useEffect, useRef } from "react"

interface Coordinate {
  lat: number
  lng: number
  label?: string
}

interface Dot {
  start: Coordinate
  end: Coordinate
}

interface WorldMapProps {
  dots: Dot[]
  lineColor?: string
}

export function WorldMap({ dots, lineColor = "#32CD32" }: WorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Convert lat/lng to x/y coordinates on the map
  const latLngToXY = (lat: number, lng: number, width: number, height: number) => {
    // Simple equirectangular projection
    const x = ((lng + 180) / 360) * width
    const y = ((90 - lat) / 180) * height
    return { x, y }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const width = canvas.width
    const height = canvas.height

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw world map (simplified)
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)"
    ctx.fillRect(0, 0, width, height)

    // Draw continents (simplified)
    ctx.fillStyle = "rgba(50, 50, 50, 0.5)"

    // North America (simplified)
    ctx.beginPath()
    ctx.moveTo(width * 0.05, height * 0.2)
    ctx.lineTo(width * 0.25, height * 0.2)
    ctx.lineTo(width * 0.3, height * 0.5)
    ctx.lineTo(width * 0.15, height * 0.7)
    ctx.lineTo(width * 0.05, height * 0.5)
    ctx.closePath()
    ctx.fill()

    // South America (simplified)
    ctx.beginPath()
    ctx.moveTo(width * 0.2, height * 0.7)
    ctx.lineTo(width * 0.25, height * 0.9)
    ctx.lineTo(width * 0.15, height * 0.95)
    ctx.lineTo(width * 0.1, height * 0.8)
    ctx.closePath()
    ctx.fill()

    // Europe (simplified)
    ctx.beginPath()
    ctx.moveTo(width * 0.4, height * 0.2)
    ctx.lineTo(width * 0.5, height * 0.15)
    ctx.lineTo(width * 0.55, height * 0.3)
    ctx.lineTo(width * 0.45, height * 0.4)
    ctx.closePath()
    ctx.fill()

    // Africa (simplified)
    ctx.beginPath()
    ctx.moveTo(width * 0.45, height * 0.4)
    ctx.lineTo(width * 0.55, height * 0.4)
    ctx.lineTo(width * 0.6, height * 0.7)
    ctx.lineTo(width * 0.5, height * 0.8)
    ctx.lineTo(width * 0.4, height * 0.7)
    ctx.closePath()
    ctx.fill()

    // Asia (simplified)
    ctx.beginPath()
    ctx.moveTo(width * 0.55, height * 0.2)
    ctx.lineTo(width * 0.85, height * 0.2)
    ctx.lineTo(width * 0.9, height * 0.5)
    ctx.lineTo(width * 0.7, height * 0.7)
    ctx.lineTo(width * 0.6, height * 0.6)
    ctx.closePath()
    ctx.fill()

    // Australia (simplified)
    ctx.beginPath()
    ctx.moveTo(width * 0.75, height * 0.7)
    ctx.lineTo(width * 0.85, height * 0.7)
    ctx.lineTo(width * 0.9, height * 0.85)
    ctx.lineTo(width * 0.8, height * 0.9)
    ctx.lineTo(width * 0.75, height * 0.8)
    ctx.closePath()
    ctx.fill()

    // Helper function to calculate the position of the animated dot on a bezier curve
    const calculateBezierPoint = (
      t: number,
      p0: { x: number; y: number },
      p1: { x: number; y: number },
      p2: { x: number; y: number },
      p3: { x: number; y: number },
    ) => {
      const x =
        Math.pow(1 - t, 3) * p0.x +
        3 * Math.pow(1 - t, 2) * t * p1.x +
        3 * (1 - t) * Math.pow(t, 2) * p2.x +
        Math.pow(t, 3) * p3.x

      const y =
        Math.pow(1 - t, 3) * p0.y +
        3 * Math.pow(1 - t, 2) * t * p1.y +
        3 * (1 - t) * Math.pow(t, 2) * p2.y +
        Math.pow(t, 3) * p3.y

      return { x, y }
    }

    // Animation loop for moving dots
    let animationFrame: number
    let t = 0

    const animate = () => {
      t = (t + 0.005) % 1

      // Clear previous dots
      ctx.clearRect(0, 0, width, height)

      // Redraw map
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)"
      ctx.fillRect(0, 0, width, height)

      // Redraw continents
      ctx.fillStyle = "rgba(50, 50, 50, 0.5)"

      // North America
      ctx.beginPath()
      ctx.moveTo(width * 0.05, height * 0.2)
      ctx.lineTo(width * 0.25, height * 0.2)
      ctx.lineTo(width * 0.3, height * 0.5)
      ctx.lineTo(width * 0.15, height * 0.7)
      ctx.lineTo(width * 0.05, height * 0.5)
      ctx.closePath()
      ctx.fill()

      // South America
      ctx.beginPath()
      ctx.moveTo(width * 0.2, height * 0.7)
      ctx.lineTo(width * 0.25, height * 0.9)
      ctx.lineTo(width * 0.15, height * 0.95)
      ctx.lineTo(width * 0.1, height * 0.8)
      ctx.closePath()
      ctx.fill()

      // Europe
      ctx.beginPath()
      ctx.moveTo(width * 0.4, height * 0.2)
      ctx.lineTo(width * 0.5, height * 0.15)
      ctx.lineTo(width * 0.55, height * 0.3)
      ctx.lineTo(width * 0.45, height * 0.4)
      ctx.closePath()
      ctx.fill()

      // Africa
      ctx.beginPath()
      ctx.moveTo(width * 0.45, height * 0.4)
      ctx.lineTo(width * 0.55, height * 0.4)
      ctx.lineTo(width * 0.6, height * 0.7)
      ctx.lineTo(width * 0.5, height * 0.8)
      ctx.lineTo(width * 0.4, height * 0.7)
      ctx.closePath()
      ctx.fill()

      // Asia
      ctx.beginPath()
      ctx.moveTo(width * 0.55, height * 0.2)
      ctx.lineTo(width * 0.85, height * 0.2)
      ctx.lineTo(width * 0.9, height * 0.5)
      ctx.lineTo(width * 0.7, height * 0.7)
      ctx.lineTo(width * 0.6, height * 0.6)
      ctx.closePath()
      ctx.fill()

      // Australia
      ctx.beginPath()
      ctx.moveTo(width * 0.75, height * 0.7)
      ctx.lineTo(width * 0.85, height * 0.7)
      ctx.lineTo(width * 0.9, height * 0.85)
      ctx.lineTo(width * 0.8, height * 0.9)
      ctx.lineTo(width * 0.75, height * 0.8)
      ctx.closePath()
      ctx.fill()

      // Redraw connection lines and animated dots
      dots.forEach((dot) => {
        const start = latLngToXY(dot.start.lat, dot.start.lng, width, height)
        const end = latLngToXY(dot.end.lat, dot.end.lng, width, height)

        // Draw curved line
        ctx.beginPath()
        ctx.strokeStyle = lineColor
        ctx.lineWidth = 1.5

        const cp1x = start.x + (end.x - start.x) / 3
        const cp1y = start.y - Math.abs(end.x - start.x) / 5
        const cp2x = start.x + ((end.x - start.x) * 2) / 3
        const cp2y = end.y - Math.abs(end.x - start.x) / 5

        ctx.moveTo(start.x, start.y)
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, end.x, end.y)
        ctx.stroke()

        // Draw animated dot using the helper function
        const pos = calculateBezierPoint(
          t,
          { x: start.x, y: start.y },
          { x: cp1x, y: cp1y },
          { x: cp2x, y: cp2y },
          { x: end.x, y: end.y },
        )

        ctx.fillStyle = lineColor
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2)
        ctx.fill()

        // Draw start and end points
        ctx.beginPath()
        ctx.arc(start.x, start.y, 4, 0, Math.PI * 2)
        ctx.fill()

        ctx.beginPath()
        ctx.arc(end.x, end.y, 4, 0, Math.PI * 2)
        ctx.fill()

        // Draw labels if provided
        if (dot.start.label) {
          ctx.fillStyle = "white"
          ctx.font = "10px Arial"
          ctx.fillText(dot.start.label, start.x + 8, start.y)
        }

        if (dot.end.label) {
          ctx.fillStyle = "white"
          ctx.font = "10px Arial"
          ctx.fillText(dot.end.label, end.x + 8, end.y)
        }
      })

      animationFrame = requestAnimationFrame(animate)
    }

    animate()

    // Cleanup animation on unmount
    return () => {
      cancelAnimationFrame(animationFrame)
    }
  }, [dots, lineColor])

  return (
    <div className="relative w-full h-[300px] rounded-lg overflow-hidden bg-black/30">
      <canvas ref={canvasRef} width={800} height={400} className="w-full h-full object-cover" />
    </div>
  )
}
