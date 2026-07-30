/** Juno brand mark — blue dot used on login, OS portal, and Career OS. */
export function JunoBlueDotMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_10px_rgba(59,130,246,0.09),0_18px_40px_rgba(37,99,235,0.26)] ${className}`}
    />
  )
}
