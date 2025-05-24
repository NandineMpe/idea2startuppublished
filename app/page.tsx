import { Preloader } from "@/components/preloader"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Preloader />
      <div>
        <h1>Welcome to my Next.js app!</h1>
      </div>
    </main>
  )
}
