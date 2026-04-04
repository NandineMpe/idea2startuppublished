"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DocumentUpload } from "@/components/onboarding/document-upload"
import { AgentActivation } from "@/components/onboarding/agent-activation"

type Step = "documents" | "activate" | "done"

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("documents")

  return (
    <div className="mx-auto max-w-[680px] px-5 py-10">
      {step === "documents" && <DocumentUpload onContinue={() => setStep("activate")} />}

      {step === "activate" && (
        <AgentActivation
          onFinish={() => {
            setStep("done")
            setTimeout(() => router.push("/dashboard"), 2200)
          }}
        />
      )}

      {step === "done" && (
        <div className="pt-[18vh] text-center">
          <h2 className="text-xl font-semibold">Your first daily brief is on its way</h2>
          <p className="mt-2 text-sm text-muted-foreground">Opening your command centre…</p>
        </div>
      )}
    </div>
  )
}
