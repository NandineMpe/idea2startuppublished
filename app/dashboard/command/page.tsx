"use client"

import { CommandCenterTodos } from "@/components/dashboard/command-center-todos"
import { JunoStaffMeetingPanel } from "@/components/dashboard/juno-staff-meeting-panel"

export default function CommandPage() {
  return (
    <div className="flex flex-col max-w-7xl mx-auto w-full">
      <section className="border-b border-border/60 bg-muted/20 px-6 lg:px-8 pt-6 lg:pt-8 pb-8 lg:pb-10">
        <div className="flex flex-col xl:flex-row gap-8 xl:gap-10 xl:items-start">
          <div className="flex-1 min-w-0 w-full">
            <JunoStaffMeetingPanel />
          </div>
          <aside className="w-full xl:w-[380px] shrink-0 xl:sticky xl:top-6 xl:self-start">
            <CommandCenterTodos />
          </aside>
        </div>
      </section>
    </div>
  )
}
