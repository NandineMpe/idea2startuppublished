"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface StepperContextValue {
  value: number
  onValueChange: (value: number) => void
  orientation?: "horizontal" | "vertical"
}

const StepperContext = React.createContext<StepperContextValue | undefined>(undefined)

function useStepper() {
  const context = React.useContext(StepperContext)
  if (!context) {
    throw new Error("useStepper must be used within a Stepper")
  }
  return context
}

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  onValueChange: (value: number) => void
  orientation?: "horizontal" | "vertical"
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ value, onValueChange, orientation = "horizontal", className, ...props }, ref) => {
    return (
      <StepperContext.Provider value={{ value, onValueChange, orientation }}>
        <div
          ref={ref}
          data-orientation={orientation}
          className={cn("flex", orientation === "horizontal" ? "flex-row" : "flex-col", "group/stepper", className)}
          {...props}
        />
      </StepperContext.Provider>
    )
  },
)
Stepper.displayName = "Stepper"

interface StepperItemProps extends React.HTMLAttributes<HTMLDivElement> {
  step: number
}

const StepperItem = React.forwardRef<HTMLDivElement, StepperItemProps>(({ step, className, ...props }, ref) => {
  const { value } = useStepper()
  const isActive = value === step
  const isCompleted = value > step

  return (
    <div
      ref={ref}
      data-state={isActive ? "active" : isCompleted ? "completed" : "inactive"}
      className={cn("flex", "group/step", className)}
      {...props}
    />
  )
})
StepperItem.displayName = "StepperItem"

interface StepperTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const StepperTrigger = React.forwardRef<HTMLButtonElement, StepperTriggerProps>(({ className, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
})
StepperTrigger.displayName = "StepperTrigger"

interface StepperIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {}

const StepperIndicator = React.forwardRef<HTMLDivElement, StepperIndicatorProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "relative z-10 flex h-6 w-6 items-center justify-center rounded-full border border-transparent",
        className,
      )}
      {...props}
    />
  )
})
StepperIndicator.displayName = "StepperIndicator"

interface StepperTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

const StepperTitle = React.forwardRef<HTMLHeadingElement, StepperTitleProps>(({ className, ...props }, ref) => {
  return <h3 ref={ref} className={cn("text-sm font-medium", className)} {...props} />
})
StepperTitle.displayName = "StepperTitle"

interface StepperDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const StepperDescription = React.forwardRef<HTMLParagraphElement, StepperDescriptionProps>(
  ({ className, ...props }, ref) => {
    return <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
  },
)
StepperDescription.displayName = "StepperDescription"

interface StepperSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {}

const StepperSeparator = React.forwardRef<HTMLDivElement, StepperSeparatorProps>(({ className, ...props }, ref) => {
  const { orientation } = useStepper()
  return (
    <div
      ref={ref}
      className={cn("h-[2px] w-full", orientation === "horizontal" ? "h-[2px] w-full" : "h-full w-[2px]", className)}
      {...props}
    />
  )
})
StepperSeparator.displayName = "StepperSeparator"

export {
  Stepper,
  StepperItem,
  StepperTrigger,
  StepperIndicator,
  StepperTitle,
  StepperDescription,
  StepperSeparator,
  useStepper,
}
