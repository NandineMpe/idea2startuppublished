import { JunoAuthPage } from "@/components/access/juno-auth-page"

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[]; next?: string | string[] }>
}) {
  const params = await searchParams
  const message = Array.isArray(params.message) ? params.message[0] : params.message
  const nextRaw = Array.isArray(params.next) ? params.next[0] : params.next
  const redirectAfterAuth =
    typeof nextRaw === "string" && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw.slice(0, 512)
      : undefined

  return (
    <JunoAuthPage pagePath="/login" message={message} redirectAfterAuth={redirectAfterAuth} />
  )
}
