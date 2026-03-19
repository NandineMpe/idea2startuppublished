"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, Loader2, Sparkles, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Link from "next/link"

interface FormField {
  key: string
  label: string
  placeholder: string
  type: "input" | "textarea" | "select"
  required?: boolean
  options?: { value: string; label: string }[]
}

interface AIToolPageProps {
  title: string
  description: string
  toolId: string
  fields: FormField[]
  icon: React.ReactNode
  backHref?: string
  backLabel?: string
}

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
}
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

export function AIToolPage({ title, description, toolId, fields, icon, backHref = "/dashboard", backLabel = "Back" }: AIToolPageProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [result, setResult] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/ai-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: toolId, inputs }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate")
      setResult(data.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (result) {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const updateInput = (key: string, value: string) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }

  const hasRequiredFields = fields
    .filter((f) => f.required !== false)
    .every((f) => inputs[f.key]?.trim())

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className="flex flex-col gap-6 p-6 lg:p-8 max-w-4xl mx-auto"
    >
      <motion.div variants={item}>
        <Link href={backHref} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
          {backLabel}
        </Link>
      </motion.div>

      <motion.div variants={item} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-[13px] text-muted-foreground">{description}</p>
        </div>
      </motion.div>

      <motion.div variants={item}>
        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-5 space-y-4">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-[13px] font-medium">
                {field.label}
                {field.required !== false && <span className="text-destructive ml-0.5">*</span>}
              </Label>
              {field.type === "textarea" ? (
                <Textarea
                  placeholder={field.placeholder}
                  value={inputs[field.key] || ""}
                  onChange={(e) => updateInput(field.key, e.target.value)}
                  className="text-[13px] min-h-[80px] bg-background border-border"
                />
              ) : field.type === "select" ? (
                <select
                  value={inputs[field.key] || ""}
                  onChange={(e) => updateInput(field.key, e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{field.placeholder}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder={field.placeholder}
                  value={inputs[field.key] || ""}
                  onChange={(e) => updateInput(field.key, e.target.value)}
                  className="text-[13px] h-9 bg-background border-border"
                />
              )}
            </div>
          ))}

          <Button
            type="submit"
            disabled={isLoading || !hasRequiredFields}
            className="w-full gap-2 h-9 text-[13px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate with AI
              </>
            )}
          </Button>
        </form>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-[13px] text-destructive"
        >
          {error}
        </motion.div>
      )}

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-border bg-card"
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-[13px] font-medium text-foreground">Results</span>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 h-7 text-[12px]">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="p-5 prose prose-sm prose-invert max-w-none">
            <div className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap markdown-content">
              {result.split(/^## /m).map((section, i) => {
                if (i === 0 && !section.trim()) return null
                if (i === 0) return <p key={i}>{section}</p>
                const [heading, ...body] = section.split("\n")
                return (
                  <div key={i} className="mb-5">
                    <h3 className="text-[14px] font-semibold text-foreground mb-2">{heading}</h3>
                    <div className="text-muted-foreground whitespace-pre-wrap">{body.join("\n").trim()}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
