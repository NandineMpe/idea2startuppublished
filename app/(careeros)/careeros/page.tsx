import Link from "next/link"

export default function CareerOSPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CareerOS</p>
      <h1 className="text-3xl font-semibold text-foreground">CareerOS is now provisioned</h1>
      <p className="text-sm text-muted-foreground">
        Your CareerOS data layer is live in production. This placeholder confirms the route group is active
        and authenticated while feature modules are wired in.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        <Link href="/careeros/onboarding" className="text-sm text-primary hover:underline">
          Start onboarding (Module 1.1)
        </Link>
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          Return to dashboard
        </Link>
      </div>
    </main>
  )
}
