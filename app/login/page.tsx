import { JunoAuthPage } from "@/components/access/juno-auth-page"

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[] }>
}) {
  const params = await searchParams
  const message = Array.isArray(params.message) ? params.message[0] : params.message

  return <JunoAuthPage pagePath="/login" message={message} />
}
