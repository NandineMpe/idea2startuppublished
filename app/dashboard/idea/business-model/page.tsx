import { ComingSoonOverlay } from "@/components/ui/coming-soon-overlay"

export default function BusinessModelPage() {
  return (
    <div className="relative h-full w-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Business Model Generator</h1>
        <p className="text-gray-500">Design and visualize your business model with our interactive tool.</p>

        {/* Page content would go here */}
        <div className="mt-8 grid gap-6">
          <div className="bg-black/10 p-8 rounded-lg h-64"></div>
          <div className="bg-black/10 p-8 rounded-lg h-64"></div>
        </div>
      </div>

      <ComingSoonOverlay
        title="Business Model Generator Coming Soon"
        description="We're building a powerful tool to help you design and visualize your business model."
      />
    </div>
  )
}
