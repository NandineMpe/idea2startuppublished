import { SharedIntakeForm } from "@/components/onboarding/shared-intake-form"

export default async function SharedIntakePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SharedIntakeForm token={token} />
    </div>
  )
}
