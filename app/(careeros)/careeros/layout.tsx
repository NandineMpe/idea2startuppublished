import "@/app/careeros-prototype.css"
import { CareerOsShell } from "@/components/careeros/career-os-shell"

export default function CareerOsAppLayout({ children }: { children: React.ReactNode }) {
  return <CareerOsShell>{children}</CareerOsShell>
}
