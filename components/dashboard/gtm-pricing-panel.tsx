"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { GtmPricingModel } from "@/lib/gtm-hub"

type Props = {
  pricing: GtmPricingModel
  onChange: (p: GtmPricingModel) => void
}

export function GtmPricingPanel({ pricing, onChange }: Props) {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
        Capture how you charge: a recurring platform fee and optional pay-per-use on top.
      </p>

      <div className="max-w-xl space-y-2">
        <Label htmlFor="gtm-platform-fee" className="text-[13px] font-medium">
          Platform fee
        </Label>
        <Input
          id="gtm-platform-fee"
          placeholder='e.g. $499 / month per seat — or "Custom enterprise"'
          value={pricing.platformFee}
          onChange={(e) => onChange({ ...pricing, platformFee: e.target.value })}
          className="text-[13px]"
        />
        <p className="text-[11px] text-muted-foreground">Base subscription, seats, or minimum commit.</p>
      </div>

      <div className="max-w-xl space-y-3 rounded-xl border border-border bg-card p-5">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={pricing.payPerUseEnabled}
            onCheckedChange={(c) => onChange({ ...pricing, payPerUseEnabled: c === true })}
            className="mt-0.5"
          />
          <div className="flex-1 space-y-1">
            <span className="text-[13px] font-medium text-foreground">Pay per use</span>
            <p className="text-[12px] text-muted-foreground">
              Usage-based charges on API calls, credits, overages, or agent runs beyond the platform fee.
            </p>
          </div>
        </label>

        {pricing.payPerUseEnabled ? (
          <div className="space-y-2 pt-1 pl-7">
            <Label htmlFor="gtm-pay-per-use" className="text-[12px] text-muted-foreground">
              Pay-per-use terms
            </Label>
            <Input
              id="gtm-pay-per-use"
              placeholder="e.g. $0.02 per 1K tokens · $10 per 1K enriched leads"
              value={pricing.payPerUse}
              onChange={(e) => onChange({ ...pricing, payPerUse: e.target.value })}
              className="font-mono text-[12px]"
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
