import { JunoAuthPage } from "@/components/access/juno-auth-page"

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string | string[] }>
}) {
  const params = searchParams ? await searchParams : undefined
  const message = Array.isArray(params?.message) ? params?.message[0] : params?.message

  return <JunoAuthPage pagePath="/" message={message} />
}
