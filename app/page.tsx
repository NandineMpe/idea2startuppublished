import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { OsPortalPage } from "@/components/access/os-portal-page"
import { entitledProducts, primaryProduct, HOME_PATH_BY_PRODUCT } from "@/lib/products"

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const entitled = entitledProducts(user.user_metadata)
    // With one product there is nothing to choose, so go straight there.
    // With several, the portal is the switcher — never skip past it.
    if (entitled.length === 1) {
      redirect(HOME_PATH_BY_PRODUCT[entitled[0]])
    }
    return (
      <OsPortalPage
        access={{ signedIn: true, entitled, primary: primaryProduct(user.user_metadata) }}
      />
    )
  }

  return <OsPortalPage />
}
