import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default async function Login({
    searchParams,
}: {
    searchParams: { message: string }
}) {
    const supabase = await createClient()

    // If user is already logged in, redirect to dashboard
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (user) {
        return redirect("/dashboard")
    }

    const login = async (formData: FormData) => {
        "use server"

        const email = formData.get("email") as string
        const password = formData.get("password") as string
        const supabase = await createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            return redirect("/login?message=Could not authenticate user")
        }

        return redirect("/dashboard")
    }

    const signup = async (formData: FormData) => {
        "use server"

        const origin = (await headers()).get("origin")
        const email = formData.get("email") as string
        const password = formData.get("password") as string
        const supabase = await createClient()

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${origin}/auth/callback`,
            },
        })

        if (error) {
            return redirect("/login?message=Could not authenticate user")
        }

        return redirect("/login?message=Check email to continue sign in process")
    }

    return (
        <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 h-screen mx-auto">
            <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-white">
                <h1 className="text-3xl font-bold mb-4">Idea to Startup</h1>
                <Label className="text-md" htmlFor="email">
                    Email
                </Label>
                <Input
                    className="rounded-md px-4 py-2 bg-inherit border mb-6 text-white"
                    name="email"
                    placeholder="you@example.com"
                    required
                />
                <Label className="text-md" htmlFor="password">
                    Password
                </Label>
                <Input
                    className="rounded-md px-4 py-2 bg-inherit border mb-6 text-white"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    required
                />
                <Button formAction={login} className="bg-primary text-black font-bold mb-2 rounded-md px-4 py-2">
                    Sign In
                </Button>
                <Button formAction={signup} variant="outline" className="border-white/20 text-white rounded-md px-4 py-2 hover:bg-white/10">
                    Sign Up
                </Button>
                {searchParams?.message && (
                    <p className="mt-4 p-4 bg-white/10 text-center rounded-md font-medium text-white">
                        {searchParams.message}
                    </p>
                )}
            </form>
        </div>
    )
}
