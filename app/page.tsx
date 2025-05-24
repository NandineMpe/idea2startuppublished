import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Preloader } from "@/components/preloader"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Preloader />
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4 py-24 text-center sm:px-6 md:px-8 lg:py-32">
        <div className="absolute inset-0 z-0 bg-[url('/placeholder.svg?height=1080&width=1920&query=abstract%20digital%20network')] bg-cover bg-center opacity-20"></div>
        <div className="relative z-10 mx-auto max-w-5xl">
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl">
            Transform Your{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Ideas</span>{" "}
            Into Successful{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">Startups</span>
          </h1>
          <p className="mb-10 text-xl text-gray-300 md:text-2xl">
            AI-powered platform to analyze business ideas, generate pitch decks, and guide your entrepreneurial journey
            from concept to launch.
          </p>
          <div className="flex flex-col items-center justify-center space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
            <Button asChild size="lg" className="bg-blue-600 px-8 py-6 text-lg hover:bg-blue-700">
              <Link href="/auth/signin">Get Started</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-gray-600 px-8 py-6 text-lg text-white hover:bg-gray-800"
            >
              <Link href="/auth/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-900 py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-3xl font-bold text-white sm:text-4xl">
            Powerful Tools for Entrepreneurs
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="mb-4 rounded-full bg-blue-500/10 p-3 text-blue-400 w-fit">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Business Idea Analysis</h3>
              <p className="text-gray-400">
                Get comprehensive analysis of your business idea with AI-powered insights on market potential,
                competition, and viability.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10">
              <div className="mb-4 rounded-full bg-purple-500/10 p-3 text-purple-400 w-fit">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Pitch Deck Generation</h3>
              <p className="text-gray-400">
                Create professional pitch decks automatically with AI that highlights your unique value proposition and
                business model.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 transition-all hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/10">
              <div className="mb-4 rounded-full bg-green-500/10 p-3 text-green-400 w-fit">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 16v-4"></path>
                  <path d="M12 8h.01"></path>
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-bold text-white">Founder's Knowledge</h3>
              <p className="text-gray-400">
                Access a wealth of knowledge on entrepreneurship, funding strategies, and startup best practices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-6 text-3xl font-bold text-white sm:text-4xl">Ready to Start Your Journey?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-blue-100">
            Join thousands of entrepreneurs who are turning their ideas into successful startups.
          </p>
          <Button asChild size="lg" className="bg-white px-8 py-6 text-lg text-blue-900 hover:bg-gray-100">
            <Link href="/auth/signup">Create Your Free Account</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between space-y-6 md:flex-row md:space-y-0">
            <div className="text-2xl font-bold text-white">ideatostartup.io</div>
            <div className="flex space-x-6">
              <Link href="/terms" className="text-gray-400 hover:text-white">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white">
                Privacy
              </Link>
              <Link href="/contact" className="text-gray-400 hover:text-white">
                Contact
              </Link>
            </div>
            <div className="text-gray-400">© 2023 IdeaToStartup. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
