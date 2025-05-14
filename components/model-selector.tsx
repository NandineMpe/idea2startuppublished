"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const models = [
  {
    value: "openai",
    label: "OpenAI GPT-4",
    apiRoute: "/api/chat/openai",
  },
  {
    value: "anthropic",
    label: "Anthropic Claude",
    apiRoute: "/api/chat/anthropic",
  },
  {
    value: "perplexity",
    label: "Perplexity",
    apiRoute: "/api/chat/perplexity",
  },
  {
    value: "deepseek",
    label: "DeepSeek Chat",
    apiRoute: "/api/chat/deepseek",
  },
  {
    value: "gemini",
    label: "Google Gemini",
    apiRoute: "/api/chat/gemini",
  },
]

export type ModelInfo = {
  value: string
  label: string
  apiRoute: string
}

interface ModelSelectorProps {
  onModelChange: (model: ModelInfo) => void
}

export function ModelSelector({ onModelChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<ModelInfo>(models[0])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-black/50 border-gray-800 hover:bg-black/70"
        >
          {selectedModel.label}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-black border-gray-800">
        <Command className="bg-transparent">
          <CommandInput placeholder="Search models..." className="h-9" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            <CommandGroup>
              {models.map((model) => (
                <CommandItem
                  key={model.value}
                  value={model.value}
                  onSelect={() => {
                    setSelectedModel(model)
                    onModelChange(model)
                    setOpen(false)
                  }}
                  className="text-white hover:bg-gray-800"
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", selectedModel.value === model.value ? "opacity-100" : "opacity-0")}
                  />
                  {model.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
