/**
 * The rate card below the base fee.
 *
 * A sponsored video is not one thing sold once. It is a licence, and the fee a
 * brand quotes covers the narrowest version of it: one organic post, on the
 * creator's own handle, for as long as it stays up. Everything else the brand
 * subsequently does with the file — running it as a Spark Ad, posting it from
 * their own account, putting it on the homepage, keeping it forever, stopping
 * the creator working with a competitor — is a separate right with a published
 * market price, and handing those over inside the base fee is the single most
 * common way a creator gets underpaid without ever being lowballed.
 *
 * Every item here is a multiple of the base fee rather than a flat number, so
 * the whole card reprices the moment the base does. Each carries the published
 * market range it sits inside, because the number that survives a negotiation is
 * the one the brand can check.
 *
 * Market ranges as of August 2026, cross-read from influencer-pricing
 * benchmarks: 30-day paid usage +25-50%, 90-day +50-100%, perpetual buyout
 * +150-300%, category exclusivity +50-75%, rush +25-50%, revision rounds beyond
 * two USD 200-500. The chosen figure sits inside the published band in every
 * case, and is stated below it so it can be argued rather than asserted.
 */

export type LineItemGroup = "usage" | "exclusivity" | "production" | "beyond_video" | "bundle"

export type RateLineItem = {
  key: string
  group: LineItemGroup
  label: string
  /** What the brand is actually buying, in the words a contract would use. */
  what: string
  /** Multiple of the base fee. 0 means included at no charge. */
  multiple: number
  /** The published range this sits inside, so the figure is checkable. */
  market: string
}

export const RATE_LINE_ITEMS: RateLineItem[] = [
  // -------------------------------------------------------------------------
  // Usage. The expensive half of every brief, and the half most often given away.
  // -------------------------------------------------------------------------
  {
    key: "usage_organic",
    group: "usage",
    label: "Organic post, your handle",
    what: "The video goes live on the creator's account and stays up. The brand may reshare it to their own feed and stories. No paid spend behind it.",
    multiple: 0,
    market: "Included in base across the market",
  },
  {
    key: "usage_paid_30",
    group: "usage",
    label: "Paid amplification, 30 days",
    what: "Spark Ads or equivalent, run from the creator's handle, brand pays the media spend.",
    multiple: 0.3,
    market: "Market +25% to +50%",
  },
  {
    key: "usage_paid_90",
    group: "usage",
    label: "Paid amplification, 90 days",
    what: "The same right for a quarter, which is the length most performance teams actually want.",
    multiple: 0.6,
    market: "Market +50% to +100%",
  },
  {
    key: "usage_paid_180",
    group: "usage",
    label: "Paid amplification, 6 months",
    what: "Half a year of paid running. At this length the asset is doing the work of a produced ad.",
    multiple: 1,
    market: "Market +50% to +100%, upper end",
  },
  {
    key: "usage_paid_365",
    group: "usage",
    label: "Paid amplification, 12 months",
    what: "A full year. Quote this only when the brand has refused a shorter window.",
    multiple: 1.5,
    market: "Market +100% to +200%",
  },
  {
    key: "usage_perpetual",
    group: "usage",
    label: "Perpetual buyout, all channels",
    what: "The brand keeps and runs the video anywhere, forever, with no further payment. Rarely worth agreeing to at any price under this.",
    multiple: 2,
    market: "Market +150% to +300%",
  },
  {
    key: "usage_dark_post",
    group: "usage",
    label: "Brand-handle post",
    what: "The video runs from the brand's own account rather than the creator's. Their audience, the creator's face, none of the creator's follower growth.",
    multiple: 0.4,
    market: "Market +25% to +50%",
  },
  {
    key: "usage_owned",
    group: "usage",
    label: "Website, landing page and email, 12 months",
    what: "Use on brand-owned surfaces outside social: homepage, product pages, lifecycle email, sales decks.",
    multiple: 0.25,
    market: "Market +20% to +40%",
  },

  // -------------------------------------------------------------------------
  // Exclusivity. Not usage — this is payment for the deals not taken.
  // -------------------------------------------------------------------------
  {
    key: "excl_category_90",
    group: "exclusivity",
    label: "Category exclusivity, 3 months",
    what: "No competing brand in the same category for the window. Priced on the deals foregone, not on the work done.",
    multiple: 0.5,
    market: "Market +50% to +75%",
  },
  {
    key: "excl_category_180",
    group: "exclusivity",
    label: "Category exclusivity, 6 months",
    what: "The same, for half a year. Define the category narrowly in writing or it silently swallows the adjacent ones.",
    multiple: 0.75,
    market: "Market +50% to +100%",
  },
  {
    key: "excl_category_365",
    group: "exclusivity",
    label: "Category exclusivity, 12 months",
    what: "A year off the market in that category. Worth taking only against a retainer, not a single video.",
    multiple: 1.25,
    market: "Market +100% to +150%",
  },

  // -------------------------------------------------------------------------
  // Production. Real extra work, priced as extra work.
  // -------------------------------------------------------------------------
  {
    key: "prod_extra_platform",
    group: "production",
    label: "Each additional platform",
    what: "The same video cut and posted to Reels, Shorts or LinkedIn. Per platform.",
    multiple: 0.2,
    market: "Market +15% to +30%",
  },
  {
    key: "prod_cutdown",
    group: "production",
    label: "Extra cutdown or alternate edit",
    what: "A second edit from the same shoot: different hook, different length, different call to action. Per version.",
    multiple: 0.3,
    market: "Market +25% to +40%",
  },
  {
    key: "prod_raw",
    group: "production",
    label: "Raw footage delivered",
    what: "The unedited files. Once these leave, control of the edit leaves with them, so this is priced as a licence rather than a file transfer.",
    multiple: 0.25,
    market: "Market +20% to +30%",
  },
  {
    key: "prod_rush",
    group: "production",
    label: "Rush, live inside 5 working days",
    what: "Brief to published in under a week, which means dropping something else.",
    multiple: 0.35,
    market: "Market +25% to +50%",
  },
  {
    key: "prod_revision",
    group: "production",
    label: "Revision round beyond the two included",
    what: "Per round. Two rounds are included; unlimited revisions is how a one-day job becomes a three-week one.",
    multiple: 0.25,
    market: "Market USD 200 to 500 per round",
  },

  // -------------------------------------------------------------------------
  // Beyond the video. Different work, sold off the same authority.
  // -------------------------------------------------------------------------
  {
    key: "beyond_script",
    group: "beyond_video",
    label: "Script and concept only",
    what: "The angle, the structure and the words, delivered for the brand's own team to shoot. No appearance, no likeness.",
    multiple: 0.45,
    market: "Typically 40% to 55% of an on-camera fee",
  },
  {
    key: "beyond_written",
    group: "beyond_video",
    label: "Written post, LinkedIn or newsletter",
    what: "A long-form written piece under the creator's byline, which reaches the decision maker the video reaches the practitioner.",
    multiple: 0.6,
    market: "B2B sponsored newsletter and LinkedIn rates",
  },
  {
    key: "beyond_live",
    group: "beyond_video",
    label: "Live webinar or panel, 60 minutes",
    what: "Appearing live for the brand, including a prep call. Recording rights priced separately under usage.",
    multiple: 1.5,
    market: "Typically 1.25x to 2x a video fee",
  },
  {
    key: "beyond_talk",
    group: "beyond_video",
    label: "Conference talk, in person",
    what: "A prepared talk delivered at the brand's event. Travel and accommodation on top, invoiced at cost.",
    multiple: 3.5,
    market: "Typically 3x to 5x a video fee",
  },
  {
    key: "beyond_advisory",
    group: "beyond_video",
    label: "Advisory session, half day",
    what: "Working on the brand's own positioning and content rather than producing anything. Sold as expertise, not as reach.",
    multiple: 1.25,
    market: "Typically 1x to 1.5x a video fee",
  },

  // -------------------------------------------------------------------------
  // Bundles. Volume is the only thing that should ever move the unit price.
  // -------------------------------------------------------------------------
  {
    key: "bundle_two",
    group: "bundle",
    label: "Two-video series",
    what: "Two videos on one brief. Roughly 8% off the unit rate, which is the discount the shared setup actually justifies.",
    multiple: 1.85,
    market: "Standard series discount 5% to 10%",
  },
  {
    key: "bundle_three",
    group: "bundle",
    label: "Three-video series",
    what: "Three videos on one brief, shot together. Around 10% off the unit rate.",
    multiple: 2.7,
    market: "Standard series discount 10% to 15%",
  },
  {
    key: "bundle_retainer",
    group: "bundle",
    label: "Retainer, 3 videos a month",
    what: "Per month, minimum three months. Around 15% off the unit rate, in exchange for guaranteed volume and a booked calendar.",
    multiple: 2.55,
    market: "Standard retainer discount 15% to 20%",
  },
]

export const LINE_ITEM_GROUP_LABELS: Record<LineItemGroup, string> = {
  usage: "Usage and licensing",
  exclusivity: "Exclusivity",
  production: "Production add-ons",
  beyond_video: "Beyond the video",
  bundle: "Bundles",
}

export const LINE_ITEM_GROUP_NOTES: Record<LineItemGroup, string> = {
  usage:
    "Priced on what the brand does with the video afterwards, not on how long it took to make. This is the half of the fee most often given away by accident.",
  exclusivity: "Payment for the deals not taken. Define the category in writing or it swallows the adjacent ones.",
  production: "Real extra work, priced as extra work.",
  beyond_video: "Different work, sold off the same authority.",
  bundle: "Volume is the only thing that should move the unit price.",
}

export type PricedLineItem = RateLineItem & {
  /** The base fee multiplied through, rounded to whole currency units. */
  amount: number
  /** True when the creator has overridden the market multiple in settings. */
  overridden: boolean
}

/**
 * Price the catalogue against a base fee.
 *
 * Rounded to the nearest 5 rather than to the unit: a quote reading 712.50 says
 * the number came out of a spreadsheet, and a number that looks calculated
 * invites recalculation.
 */
export function priceLineItems(
  base: number,
  overrides: Record<string, number> = {},
): PricedLineItem[] {
  return RATE_LINE_ITEMS.map((item) => {
    const override = overrides[item.key]
    const multiple = typeof override === "number" && override >= 0 ? override : item.multiple
    return {
      ...item,
      multiple,
      amount: Math.round((base * multiple) / 5) * 5,
      overridden: multiple !== item.multiple,
    }
  })
}

export function lineItemsByGroup(items: PricedLineItem[]): Array<{
  group: LineItemGroup
  label: string
  note: string
  items: PricedLineItem[]
}> {
  const order: LineItemGroup[] = ["bundle", "usage", "exclusivity", "production", "beyond_video"]
  return order
    .map((group) => ({
      group,
      label: LINE_ITEM_GROUP_LABELS[group],
      note: LINE_ITEM_GROUP_NOTES[group],
      items: items.filter((i) => i.group === group),
    }))
    .filter((g) => g.items.length > 0)
}

/**
 * The catalogue as plain text for a model prompt.
 *
 * The point of handing this to the brief reply is that an unpriced watch-out is
 * only half a warning. "They are asking for perpetual usage" is a flag; "they
 * are asking for perpetual usage, which is USD 1,900 on top" is a counter-offer.
 */
export function lineItemsBlock(items: PricedLineItem[], currency: string): string {
  return lineItemsByGroup(items)
    .map(
      (group) =>
        `${group.label}:\n${group.items
          .map((i) => {
            if (i.multiple === 0) return `- ${i.label}: included in the base fee`
            // Bundles and non-video work replace the base fee; everything else
            // is added to it. A model told "+2,565 for a three-video series"
            // will quote 3,515 for three videos.
            const standalone = i.group === "bundle" || i.group === "beyond_video"
            return `- ${i.label}: ${standalone ? "" : "+"}${currency} ${i.amount.toLocaleString()} (${Math.round(
              i.multiple * 100,
            )}% of base${standalone ? ", quoted instead of the base fee, not on top of it" : ", added to the base fee"})`
          })
          .join("\n")}`,
    )
    .join("\n\n")
}
