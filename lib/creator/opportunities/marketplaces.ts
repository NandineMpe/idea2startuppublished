/**
 * Registry of platforms brands use to FIND creators. The Opportunities agent
 * checks which of these the creator should be listed on and proposes the
 * listing as a one-time action. Static by design — this list changes rarely
 * and a wrong entry is cheap to fix here.
 */

export type CreatorMarketplace = {
  key: string
  name: string
  url: string
  /** What it is, in one line the agent can reason over. */
  focus: string
  /** Rough entry bar, so the agent doesn't propose platforms the creator can't join yet. */
  entry_bar: string
}

export const CREATOR_MARKETPLACES: CreatorMarketplace[] = [
  {
    key: "tiktok-creator-marketplace",
    name: "TikTok Creator Marketplace",
    url: "https://creatormarketplace.tiktok.com",
    focus: "TikTok's official brand-deal platform; brands filter by niche, audience and engagement.",
    entry_bar: "10k+ followers, 18+, meets TikTok's engagement thresholds.",
  },
  {
    key: "passionfroot",
    name: "Passionfroot",
    url: "https://www.passionfroot.me",
    focus: "Storefront for creator sponsorships — newsletters, YouTube, TikTok; brands book directly.",
    entry_bar: "Open; strongest for creators with a clear media kit and rate card.",
  },
  {
    key: "collabstr",
    name: "Collabstr",
    url: "https://collabstr.com",
    focus: "Marketplace where brands search and buy creator packages (TikTok, IG, UGC).",
    entry_bar: "Open application; approval based on content quality.",
  },
  {
    key: "insense",
    name: "Insense",
    url: "https://insense.pro",
    focus: "UGC and paid-ads creator platform; brands brief, creators apply.",
    entry_bar: "Open; UGC-friendly, works below 10k followers.",
  },
  {
    key: "billo",
    name: "Billo",
    url: "https://billo.app",
    focus: "UGC video marketplace for product videos; volume work, fixed rates.",
    entry_bar: "Open (US-centric); no follower minimum.",
  },
  {
    key: "hashtag-paid",
    name: "#paid",
    url: "https://hashtagpaid.com",
    focus: "Managed creator-brand matching; brands run campaigns, creators get matched.",
    entry_bar: "Curated; mid-size creators with consistent engagement.",
  },
  {
    key: "grin",
    name: "GRIN",
    url: "https://grin.co",
    focus: "Brand-side creator management tool; being discoverable there matters for DTC deals.",
    entry_bar: "Brand-initiated; creators join via brand invitations.",
  },
  {
    key: "aspire",
    name: "Aspire",
    url: "https://www.aspire.io",
    focus: "Influencer marketing platform with a creator marketplace brands search.",
    entry_bar: "Application; typically 10k+ on a primary channel.",
  },
]
