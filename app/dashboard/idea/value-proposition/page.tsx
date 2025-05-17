import { ComingSoonOverlay } from "@/components/ui/coming-soon-overlay"

export default function ValuePropositionPage() {
  return (
    <div className="relative h-full w-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Value Proposition Generator</h1>
        <p className="text-gray-500">Create compelling value propositions that resonate with your target audience.</p>

        {/* Page content would go here */}
        <div className="mt-8 grid gap-6">
          <div className="bg-black/10 p-8 rounded-lg h-64"></div>
          <div className="bg-black/10 p-8 rounded-lg h-64"></div>
        </div>
      </div>

      <ComingSoonOverlay
        title="Value Proposition Generator Coming Soon"
        description="We're building a powerful tool to help you create compelling value propositions that resonate with your target audience."
      />
    </div>
  )
}
