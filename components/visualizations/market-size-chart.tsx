"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

interface MarketSizeChartProps {
  tam: {
    value: string
    customers: string
  }
  sam: {
    value: string
    customers: string
  }
  som: {
    value: string
    customers: string
  }
}

export function MarketSizeChart({ tam, sam, som }: MarketSizeChartProps) {
  // Extract numeric values from the strings (removing $ and "million"/"billion" text)
  const extractValue = (valueStr: string) => {
    if (!valueStr) return 0

    try {
      // First try to extract just the number
      const numericPart = valueStr.replace(/[^0-9.]/g, "")
      return numericPart ? Number.parseFloat(numericPart) : 0
    } catch (error) {
      console.error("Error extracting value:", error)
      return 0
    }
  }

  // Determine if values are in millions or billions
  const getMultiplier = (valueStr: string) => {
    if (!valueStr) return 1

    try {
      if (valueStr.toLowerCase().includes("billion")) return 1000
      if (valueStr.toLowerCase().includes("million")) return 1
      return 1
    } catch (error) {
      console.error("Error getting multiplier:", error)
      return 1
    }
  }

  // Calculate normalized values for the chart
  const tamValue = extractValue(tam.value) * getMultiplier(tam.value)
  const samValue = extractValue(sam.value) * getMultiplier(sam.value)
  const somValue = extractValue(som.value) * getMultiplier(som.value)

  // Ensure we have valid values
  const validTamValue = isNaN(tamValue) || tamValue <= 0 ? 100 : tamValue
  const validSamValue = isNaN(samValue) || samValue <= 0 ? 50 : samValue
  const validSomValue = isNaN(somValue) || somValue <= 0 ? 10 : somValue

  // Custom tooltip to show the original values
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]
      let value, customers

      switch (item.name) {
        case "TAM":
          value = tam.value || "$100 million"
          customers = tam.customers || "1 million customers"
          break
        case "SAM":
          value = sam.value || "$50 million"
          customers = sam.customers || "500,000 customers"
          break
        case "SOM":
          value = som.value || "$10 million"
          customers = som.customers || "100,000 customers"
          break
        default:
          value = ""
          customers = ""
      }

      return (
        <div className="bg-gray-900 p-3 border border-gray-800 rounded-md shadow-lg">
          <p className="text-xs uppercase tracking-wider text-white/60 mb-1">{item.name}</p>
          <p className="text-lg font-bold text-white">{value}</p>
          <p className="text-xs text-white/60">{customers}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[{ name: "TAM", value: validTamValue }]}
            cx="50%"
            cy="50%"
            outerRadius={140}
            innerRadius={0}
            fill="#3b82f6"
            dataKey="value"
            label={({ name }) => name}
            labelLine={false}
          >
            <Cell fill="#3b82f620" stroke="#3b82f640" strokeWidth={2} />
          </Pie>
          <Pie
            data={[{ name: "SAM", value: validSamValue }]}
            cx="50%"
            cy="50%"
            outerRadius={100}
            innerRadius={0}
            fill="#8b5cf6"
            dataKey="value"
            label={({ name }) => name}
            labelLine={false}
          >
            <Cell fill="#8b5cf620" stroke="#8b5cf640" strokeWidth={2} />
          </Pie>
          <Pie
            data={[{ name: "SOM", value: validSomValue }]}
            cx="50%"
            cy="50%"
            outerRadius={60}
            innerRadius={0}
            fill="#ec4899"
            dataKey="value"
            label={({ name }) => name}
            labelLine={false}
          >
            <Cell fill="#ec489920" stroke="#ec489940" strokeWidth={2} />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            formatter={(value) => {
              let displayValue = ""
              switch (value) {
                case "TAM":
                  displayValue = `TAM: ${tam.value || "$100 million"}`
                  break
                case "SAM":
                  displayValue = `SAM: ${sam.value || "$50 million"}`
                  break
                case "SOM":
                  displayValue = `SOM: ${som.value || "$10 million"}`
                  break
              }
              return <span className="text-white">{displayValue}</span>
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
