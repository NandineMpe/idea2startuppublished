import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface EventItemProps {
  title: string
  date: string
  time: string
  location: string
  className?: string
}

export function EventItem({ title, date, time, location, className }: EventItemProps) {
  return (
    <div className={cn("flex items-start gap-3 py-3 hover:bg-primary/5 rounded-md transition-colors", className)}>
      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Calendar className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium">{title}</h4>
        <div className="mt-1 text-sm text-muted-foreground">
          <div>
            {date}, {time}
          </div>
          <div>{location}</div>
        </div>
      </div>
    </div>
  )
}
