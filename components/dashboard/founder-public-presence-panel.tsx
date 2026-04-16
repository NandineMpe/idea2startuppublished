"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ContentIntelligenceFeed } from "@/components/dashboard/content-intelligence-feed"
import { UpcomingTopicsPlanner } from "@/components/dashboard/upcoming-topics-planner"
import { DEFAULT_TIKTOK_DIGEST, type FounderBrandState, type TiktokWorkDigestConfig } from "@/lib/founder-brand"

type Props = {
  hint: string
  placeholder: string
  data: FounderBrandState
  setData: React.Dispatch<React.SetStateAction<FounderBrandState>>
}

export function FounderPublicPresencePanel({ hint, placeholder, data, setData }: Props) {
  function patchTiktok(patch: Partial<TiktokWorkDigestConfig>) {
    setData((prev) => ({
      ...prev,
      tiktokWorkDigest: { ...(prev.tiktokWorkDigest ?? DEFAULT_TIKTOK_DIGEST), ...patch },
    }))
  }

  const td = data.tiktokWorkDigest ?? DEFAULT_TIKTOK_DIGEST

  return (
    <div className="space-y-6">
      <p className="text-[13px] leading-relaxed text-muted-foreground">{hint}</p>

      <ContentIntelligenceFeed
        talkingPoints={td.digestBody}
        talkingPointsGeneratedAt={td.lastDigestAt}
        onTalkingPointsChange={(value) => patchTiktok({ digestBody: value })}
        onTalkingPointsGeneratedAtChange={(value) => patchTiktok({ lastDigestAt: value })}
      />

      <UpcomingTopicsPlanner data={data} setData={setData} />

      <div className="space-y-2">
        <Label htmlFor="fb-publicPresence" className="text-[13px] font-medium">
          Other channels &amp; cadence
        </Label>
        <p className="text-[12px] text-muted-foreground">
          LinkedIn, talks, newsletter, podcast: where else you show up beyond short-form.
        </p>
        <Textarea
          id="fb-publicPresence"
          value={data.publicPresence}
          onChange={(e) => setData((prev) => ({ ...prev, publicPresence: e.target.value }))}
          placeholder={placeholder}
          rows={10}
          className="min-h-[200px] resize-y text-[13px] leading-relaxed"
        />
      </div>
    </div>
  )
}
