import { OsAuthPage } from "@/components/access/os-auth-page"

export default async function CreatorLogin({
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
    <OsAuthPage mode="creator" message={message} redirectAfterAuth={redirectAfterAuth} />
  )
}
