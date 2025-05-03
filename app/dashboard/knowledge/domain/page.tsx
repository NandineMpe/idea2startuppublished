"use client"

import { useState } from "react"
import { FileUpload } from "@/components/ui/file-upload"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, CheckCircle, Loader2 } from "lucide-react"

export default function DomainKnowledgePage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const handleFileUpload = (newFiles: File[]) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles])
  }

  const handleSubmit = async () => {
    if (files.length === 0) return

    setIsUploading(true)

    // Simulate upload process
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Add file names to uploaded files
    const newUploadedFiles = files.map((file) => file.name)
    setUploadedFiles((prev) => [...prev, ...newUploadedFiles])

    // Clear current files
    setFiles([])
    setIsUploading(false)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-white">Domain Expertise</h1>
        <p className="text-white/60">
          Upload your industry knowledge to enhance AI-powered insights across the platform.
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex-1" />
        <Button
          onClick={handleSubmit}
          disabled={files.length === 0 || isUploading}
          className="bg-primary hover:bg-primary/90 text-black"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            "Save Documents"
          )}
        </Button>
      </div>

      <Card className="glass-card border-primary/10">
        <CardHeader>
          <CardTitle className="text-white">The more we know, the sharper we get.</CardTitle>
          <CardDescription className="text-white/80">
            This is your space to upload key documents, insights, research, or internal knowledge that reflects your
            unique expertise in your industry or field. Whether it's white papers, internal decks, market research, user
            personas, or lived experience — the more context you share, the more tailored and strategic our AI analyses
            will be across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 bg-black/40 p-4 rounded-lg border border-primary/10">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <span className="text-primary">🔐</span> Privacy Disclaimer
            </h3>
            <div className="space-y-2">
              <p className="text-primary font-medium">✅ 100% Private & Confidential</p>
              <p className="text-white/70">
                Everything you upload here is completely private and only accessible to you. These documents are never
                shared, indexed, or made public in any way.
              </p>
              <p className="text-white/70">
                They are used solely to enrich your own experience on the platform — giving you deeper, more relevant
                insights when generating strategies, pitches, or analyses.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <span className="text-primary">📂</span> Suggestions of What to Upload
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-white/70">
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Market research reports
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Industry-specific white papers
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Case studies or trend analysis
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Product specs or strategy decks
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Personal insights or field notes
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Regulatory documents
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Expert interviews or customer research
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white flex items-center gap-2">
              <span className="text-primary">🧩</span> Why It Matters
            </h3>
            <p className="text-white/70">
              Your startup is solving a specific problem in a specific space — and no generic prompt can replace your
              real-world understanding. With this upload, our system will be able to:
            </p>
            <ul className="space-y-2 text-white/70">
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Generate analyses with the right terminology and nuance
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Ground recommendations in your unique context
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">•</span> Align strategies with industry realities
              </li>
            </ul>
            <p className="font-bold text-primary mt-4">This is where context becomes competitive advantage.</p>
          </div>

          <div className="w-full max-w-4xl mx-auto border border-dashed border-primary/20 rounded-lg bg-black/20 overflow-hidden">
            <FileUpload onChange={handleFileUpload} />
          </div>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <Card className="glass-card border-primary/10">
          <CardHeader>
            <CardTitle className="text-white">Uploaded Knowledge Documents</CardTitle>
            <CardDescription className="text-white/80">
              These documents have been uploaded and will be used to provide insights for your startup journey.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((fileName, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/10 rounded-md"
                >
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 text-white">{fileName}</span>
                  <CheckCircle className="h-5 w-5 text-primary" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
