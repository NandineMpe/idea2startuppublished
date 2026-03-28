"use client"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import {
  CHANNEL_MIX_KEYS,
  CHANNEL_MIX_LABELS,
  type ChannelMixKey,
  type GtmChannelMix,
  type GtmMotionStrategy,
  channelMixShares,
  channelMixSum,
  normalizeChannelMix,
} from "@/lib/gtm-hub"

const MIX_COLORS: Record<ChannelMixKey, string> = {
  outbound: "bg-sky-500/90",
  social: "bg-violet-500/90",
  partners: "bg-emerald-500/90",
  events: "bg-amber-500/90",
  inbound: "bg-rose-500/90",
  paid: "bg-slate-500/90",
}

type Props = {
  channelMix: GtmChannelMix
  motionStrategy: GtmMotionStrategy
  onChannelMixChange: (mix: GtmChannelMix) => void
  onMotionStrategyChange: (m: GtmMotionStrategy) => void
}

export function GtmChannelsPanel({
  channelMix,
  motionStrategy,
  onChannelMixChange,
  onMotionStrategyChange,
}: Props) {
  const sum = channelMixSum(channelMix)
  const shares = channelMixShares(channelMix)

  function setChannel(key: ChannelMixKey, value: number[]) {
    const v = Math.round(value[0] ?? 0)
    onChannelMixChange({ ...channelMix, [key]: Math.min(100, Math.max(0, v)) })
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Channel mix</p>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Set relative weight per channel. Use normalize so shares sum to 100% for a clear split view.
        </p>

        <div className="mt-4 flex h-4 w-full max-w-2xl overflow-hidden rounded-full border border-border bg-muted/50">
          {CHANNEL_MIX_KEYS.map((k) => (
            <div
              key={k}
              title={`${CHANNEL_MIX_LABELS[k].title}: ${shares[k].toFixed(0)}%`}
              className={cn(MIX_COLORS[k], "min-w-px transition-[flex-grow] duration-200")}
              style={{ flexGrow: Math.max(0.02, shares[k]) }}
            />
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Total weight: <span className="font-medium text-foreground">{sum}</span>
          {sum !== 100 ? (
            <span className="text-muted-foreground"> — normalize to compare as percentages</span>
          ) : null}
        </p>

        <div className="mt-5 max-w-2xl space-y-5">
          {CHANNEL_MIX_KEYS.map((key) => (
            <div key={key} className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <Label className="text-[13px] font-medium text-foreground">{CHANNEL_MIX_LABELS[key].title}</Label>
                  <p className="text-[11px] text-muted-foreground">{CHANNEL_MIX_LABELS[key].hint}</p>
                </div>
                <span className="tabular-nums text-[13px] font-medium text-foreground">{channelMix[key]}</span>
              </div>
              <Slider
                value={[channelMix[key]]}
                onValueChange={(v) => setChannel(key, v)}
                max={100}
                step={1}
                className="w-full"
              />
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => onChannelMixChange(normalizeChannelMix(channelMix))}
        >
          Normalize to 100%
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Motion strategy</p>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Select how you sell — product-led, enterprise, and eval paths can run together.
        </p>

        <div className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 hover:bg-muted/40">
            <Checkbox
              checked={motionStrategy.selfServe}
              onCheckedChange={(c) =>
                onMotionStrategyChange({ ...motionStrategy, selfServe: c === true })
              }
              className="mt-0.5"
            />
            <div>
              <span className="text-[13px] font-medium text-foreground">Self-serve access</span>
              <p className="text-[12px] text-muted-foreground">
                Sign-up, trial, or PLG — buyers start without a sales gate.
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 hover:bg-muted/40">
            <Checkbox
              checked={motionStrategy.topDown}
              onCheckedChange={(c) =>
                onMotionStrategyChange({ ...motionStrategy, topDown: c === true })
              }
              className="mt-0.5"
            />
            <div>
              <span className="text-[13px] font-medium text-foreground">Top-down motion</span>
              <p className="text-[12px] text-muted-foreground">
                Executive or procurement-led deals, security review, and multi-threaded champions.
              </p>
            </div>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 hover:bg-muted/40">
            <Checkbox
              checked={motionStrategy.proofOfConcept}
              onCheckedChange={(c) =>
                onMotionStrategyChange({ ...motionStrategy, proofOfConcept: c === true })
              }
              className="mt-0.5"
            />
            <div>
              <span className="text-[13px] font-medium text-foreground">Proof of concept</span>
              <p className="text-[12px] text-muted-foreground">
                Scoped pilots, success criteria, and conversion to paid — before full rollout.
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  )
}
