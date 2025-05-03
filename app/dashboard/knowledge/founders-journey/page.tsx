"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import {
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper"

import { useEffect } from "react"

export default function FoundersJourneyPage() {
  useEffect(() => {
    console.log("FoundersJourneyPage mounted")
  }, [])

  const [currentStep, setCurrentStep] = useState(0)
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null)
  const [selectedTone, setSelectedTone] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedStory, setGeneratedStory] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    personalExperience: "",
    ahaMoment: "",
    industryExperience: "",
    relevantProjects: "",
    networkAdvantages: "",
    whyNow: "",
  })

  const steps = [
    {
      title: "Personal Experience",
      description: "Share your story and motivation",
    },
    {
      title: "Credibility Mapping",
      description: "Your unique advantages",
    },
    {
      title: "Aha Moment",
      description: "When everything clicked",
    },
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, 2))
  }

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0))
  }

  const handleEmotionSelect = (emotion: string) => {
    setSelectedEmotion(emotion)
  }

  const handleToneSelect = (tone: string) => {
    setSelectedTone(tone)
  }

  const handleGenerateStory = async () => {
    console.log("handleGenerateStory called")
    try {
      setIsGenerating(true)

      // Defensive: Example for future fetches
      // try {
      //   const response = await fetch("/api/some-endpoint");
      //   if (!response.ok) throw new Error("Failed to fetch");
      //   const data = await response.json();
      //   // setData(data)
      // } catch (err) {
      //   setError("Could not load data");
      // }

      const response = await fetch("/api/generate-founder-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalExperience: formData.personalExperience,
          selectedEmotion,
          ahaMoment: formData.ahaMoment,
          selectedTone,
          industryExperience: formData.industryExperience,
          relevantProjects: formData.relevantProjects,
          networkAdvantages: formData.networkAdvantages,
          whyNow: formData.whyNow,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate story")
      }

      const data = await response.json()
      setGeneratedStory(data.story)
    } catch (error) {
      console.error("Error generating story:", error)
      alert("Failed to generate your founder story. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6 pb-8 px-4 md:px-6">
      <h1 className="text-3xl font-bold">Founder's Journey</h1>
      <p className="text-gray-400">Document and share your founder story to inspire others and attract investors.</p>

      {/* Stepper Component */}
      <div className="mb-8">
        <Stepper value={currentStep} onValueChange={setCurrentStep} className="w-full">
          {steps.map((step, index) => (
            <StepperItem key={index} step={index} className="relative flex-1 !flex-col">
              <StepperTrigger className="flex-col gap-3">
                <StepperIndicator className="bg-gray-800 data-[state=active]:bg-[#32CD32] data-[state=completed]:bg-[#32CD32] flex items-center justify-center">
                  <span className="text-xs font-medium">{index + 1}</span>
                </StepperIndicator>
                <div className="space-y-0.5 px-2">
                  <StepperTitle className="text-white">{step.title}</StepperTitle>
                  <StepperDescription className="text-gray-400">{step.description}</StepperDescription>
                </div>
              </StepperTrigger>
              {index < steps.length - 1 && (
                <StepperSeparator
                  className="absolute inset-x-0 left-[calc(50%+0.75rem+0.125rem)] top-3 -order-1 m-0 -translate-y-1/2 
                  group-data-[orientation=horizontal]/stepper:w-[calc(100%-1.5rem-0.25rem)] 
                  group-data-[orientation=horizontal]/stepper:flex-none
                  bg-gray-700 group-data-[state=completed]/step:bg-[#32CD32]"
                />
              )}
            </StepperItem>
          ))}
        </Stepper>
      </div>

      {/* Step 1: Personal Experience */}
      {currentStep === 0 && (
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Personal Experience</h2>
            <p className="text-gray-400">
              Describe a challenge or frustration you personally faced that motivated you to start your business.
            </p>
            <Textarea
              className="min-h-[120px] bg-black border-gray-800 focus:border-[#32CD32] text-white"
              placeholder="Describe your experience..."
              value={formData.personalExperience}
              onChange={(e) => handleInputChange("personalExperience", e.target.value)}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Emotion or Motivation</h2>
            <p className="text-gray-400">
              What was the driving emotion or motivation for wanting to solve this problem?
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                className={`h-14 border-gray-800 hover:border-[#32CD32] hover:bg-black ${selectedEmotion === "Frustration" ? "border-[#32CD32] bg-black/50" : ""}`}
                onClick={() => handleEmotionSelect("Frustration")}
              >
                Frustration
              </Button>
              <Button
                variant="outline"
                className={`h-14 border-gray-800 hover:border-[#32CD32] hover:bg-black ${selectedEmotion === "Determination" ? "border-[#32CD32] bg-black/50" : ""}`}
                onClick={() => handleEmotionSelect("Determination")}
              >
                Determination
              </Button>
              <Button
                variant="outline"
                className={`h-14 border-gray-800 hover:border-[#32CD32] hover:bg-black ${selectedEmotion === "Empathy" ? "border-[#32CD32] bg-black/50" : ""}`}
                onClick={() => handleEmotionSelect("Empathy")}
              >
                Empathy
              </Button>
              <Button
                variant="outline"
                className={`h-14 border-gray-800 hover:border-[#32CD32] hover:bg-black ${selectedEmotion === "Drive for Change" ? "border-[#32CD32] bg-black/50" : ""}`}
                onClick={() => handleEmotionSelect("Drive for Change")}
              >
                Drive for Change
              </Button>
              <Button
                variant="outline"
                className={`h-14 border-gray-800 hover:border-[#32CD32] hover:bg-black ${selectedEmotion === "Resilience" ? "border-[#32CD32] bg-black/50" : ""}`}
                onClick={() => handleEmotionSelect("Resilience")}
              >
                Resilience
              </Button>
              <Button
                variant="outline"
                className={`h-14 border-gray-800 hover:border-[#32CD32] hover:bg-black ${selectedEmotion === "Passion" ? "border-[#32CD32] bg-black/50" : ""}`}
                onClick={() => handleEmotionSelect("Passion")}
              >
                Passion
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Step 2: Credibility Mapping */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Credibility Mapping</h2>
          <p className="text-gray-400">
            Help us understand your unique advantages and why you're the right person to solve this problem.
          </p>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Industry Experience</label>
              <Textarea
                className="min-h-[100px] bg-black border-gray-800 focus:border-[#32CD32] text-white"
                placeholder="What relevant industry experience gives you an edge?"
                value={formData.industryExperience}
                onChange={(e) => handleInputChange("industryExperience", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Relevant Projects</label>
              <Textarea
                className="min-h-[100px] bg-black border-gray-800 focus:border-[#32CD32] text-white"
                placeholder="Have you built similar things before? What technical or operational experience do you have?"
                value={formData.relevantProjects}
                onChange={(e) => handleInputChange("relevantProjects", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Network Advantages</label>
              <Textarea
                className="min-h-[100px] bg-black border-gray-800 focus:border-[#32CD32] text-white"
                placeholder="Who are you connected to that would be valuable in this space?"
                value={formData.networkAdvantages}
                onChange={(e) => handleInputChange("networkAdvantages", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Why Now?</label>
              <Textarea
                className="min-h-[100px] bg-black border-gray-800 focus:border-[#32CD32] text-white"
                placeholder="Why is now the right time to solve this problem?"
                value={formData.whyNow}
                onChange={(e) => handleInputChange("whyNow", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Aha Moment and Story Tone */}
      {currentStep === 2 && (
        <div className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">The Aha Moment</h2>
            <p className="text-gray-400">
              Describe the exact moment when everything clicked and you knew you had to build this solution.
            </p>
            <Textarea
              className="min-h-[120px] bg-black border-gray-800 focus:border-[#32CD32] text-white"
              placeholder="Describe the moment..."
              value={formData.ahaMoment}
              onChange={(e) => handleInputChange("ahaMoment", e.target.value)}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold">Story Tone</h2>
            <p className="text-gray-400">Select the audience and purpose for your founder story.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className={`h-24 border-gray-800 hover:border-[#32CD32] hover:bg-black flex flex-col items-start p-4 ${selectedTone === "VC Pitch" ? "border-[#32CD32] bg-[#32CD32]/10" : ""}`}
                onClick={() => handleToneSelect("VC Pitch")}
              >
                <span className="font-bold">VC Pitch</span>
                <span className="text-xs text-gray-400 text-left">Concise, confident, problem-obsessed</span>
              </Button>
              <Button
                variant="outline"
                className={`h-24 border-gray-800 hover:border-[#32CD32] hover:bg-black flex flex-col items-start p-4 ${selectedTone === "Team Building" ? "border-[#32CD32] bg-[#32CD32]/10" : ""}`}
                onClick={() => handleToneSelect("Team Building")}
              >
                <span className="font-bold">Team Building</span>
                <span className="text-xs text-gray-400 text-left">Mission-led, purpose-driven, visionary</span>
              </Button>
              <Button
                variant="outline"
                className={`h-24 border-gray-800 hover:border-[#32CD32] hover:bg-black flex flex-col items-start p-4 ${selectedTone === "Press & Media" ? "border-[#32CD32] bg-[#32CD32]/10" : ""}`}
                onClick={() => handleToneSelect("Press & Media")}
              >
                <span className="font-bold">Press & Media</span>
                <span className="text-xs text-gray-400 text-left">Emotive, clear arc, social proof</span>
              </Button>
            </div>
          </section>

          <Card className="bg-black border-gray-800 p-6">
            <h3 className="text-xl font-bold mb-4">Your Story</h3>

            {generatedStory ? (
              <div className="mb-6">
                <p className="text-white whitespace-pre-line">{generatedStory}</p>
                <div className="flex justify-center mt-6">
                  <Button
                    className="bg-gray-800 hover:bg-gray-700 text-white mr-4"
                    onClick={() => setGeneratedStory(null)}
                  >
                    Reset
                  </Button>
                  <Button
                    className="bg-[#32CD32] hover:bg-[#28A428] text-black"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedStory)
                      alert("Story copied to clipboard!")
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-center mb-6">
                  Click the button below to generate your founder story based on your inputs. Our AI will craft a
                  compelling narrative tailored to your selected audience.
                </p>
                <div className="flex justify-center">
                  <Button
                    className="bg-[#32CD32] hover:bg-[#28A428] text-black"
                    onClick={handleGenerateStory}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      "Generate Story"
                    )}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <Button
          variant="outline"
          className="border-gray-800 hover:bg-gray-800"
          onClick={handlePrevious}
          disabled={currentStep === 0}
        >
          Previous
        </Button>
        <Button className="bg-gray-700 hover:bg-gray-600 text-white" onClick={handleNext} disabled={currentStep === 2}>
          Next
        </Button>
      </div>
    </div>
  )
}
