import { ComingSoonOverlay } from "@/components/ui/coming-soon-overlay"

export default function RoadmapPage() {
  return (
    <div className="relative h-full w-full">
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Product Roadmap Builder</h1>
        <p className="text-gray-500">Plan and visualize your product development journey.</p>

        {/* Page content would go here */}
        <div className="mt-8 grid gap-6">
          <div className="bg-black/10 p-8 rounded-lg h-64"></div>
          <div className="bg-black/10 p-8 rounded-lg h-64"></div>
        </div>
      </div>

      <ComingSoonOverlay
        title="Product Roadmap Builder Coming Soon"
        description="We're building a powerful tool to help you plan and visualize your product development journey."
      />
    </div>
  )
}
