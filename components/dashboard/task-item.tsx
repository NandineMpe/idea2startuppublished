import { Circle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface TaskItemProps {
  title: string
  dueDate: string
  priority: "High" | "Medium" | "Low"
  completed?: boolean
  className?: string
}

export function TaskItem({ title, dueDate, priority, completed = false, className }: TaskItemProps) {
  return (
    <div className={cn("flex items-start gap-3 py-2 hover:bg-primary/5 rounded-md transition-colors", className)}>
      <div className="mt-1 text-primary">
        <Circle className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className={cn("font-medium", completed && "line-through opacity-70")}>{title}</h4>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>Due: {dueDate}</span>
          </div>
          <span>•</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-xs",
              priority === "High"
                ? "bg-red-500/20 text-red-400"
                : priority === "Medium"
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-primary/20 text-primary",
            )}
          >
            {priority} Priority
          </span>
        </div>
      </div>
    </div>
  )
}
