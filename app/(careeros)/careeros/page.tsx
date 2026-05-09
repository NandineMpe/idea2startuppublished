import Link from "next/link"
import { createClient } from "@/lib/supabase/server"

export default async function CareerOSPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let module11Complete = false
  if (user) {
    const { data: row } = await supabase
      .schema("careeros")
      .from("user_settings")
      .select("onboarding_state")
      .eq("user_id", user.id)
      .maybeSingle()

    const onboarding = row?.onboarding_state as Record<string, unknown> | null | undefined
    const m11 =
      onboarding &&
      typeof onboarding.module_1_1 === "object" &&
      onboarding.module_1_1 !== null
        ? (onboarding.module_1_1 as Record<string, unknown>)
        : undefined
    module11Complete = m11?.module_1_1_complete === true
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CareerOS</p>
      <h1 className="text-3xl font-semibold text-foreground">
        {module11Complete ? "Your CareerOS workspace" : "Welcome to CareerOS"}
      </h1>
      <p className="text-sm text-muted-foreground">
        {module11Complete ? (
          <>
            Module 1.1 onboarding is complete — your documents and profile fields are stored.
            Structured market extraction (Module 1.2) ships next; meanwhile you can use Juno as usual.
          </>
        ) : (
          <>
            Upload resume context and confirm your role in a short flow (Module 1.1). After that,
            you&apos;ll see the &quot;building your career profile&quot; step while we wire deeper
            extraction.
          </>
        )}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
        {module11Complete ? (
          <Link href="/careeros/onboarding" className="text-sm text-muted-foreground hover:underline">
            Review or update onboarding inputs
          </Link>
        ) : (
          <Link href="/careeros/onboarding" className="text-sm text-primary hover:underline">
            Start onboarding (Module 1.1)
          </Link>
        )}
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          Return to dashboard
        </Link>
      </div>
    </main>
  )
}
