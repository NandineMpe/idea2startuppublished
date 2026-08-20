/**
 * The appearance catalogue, written as lead times rather than as a wish list.
 *
 * Every treatment here has a window. A superficial peel flakes on days two to
 * five and is settled by seven. Brow lamination is glossy and over-set for the
 * first day and reads normally by the third. Manual lymphatic drainage peaks
 * within a day or two and is gone by the weekend. A wrinkle relaxer has not
 * finished moving for a fortnight.
 *
 * Those numbers are the entire value of this screen. The list of treatments is
 * on every blog. The thing nobody tells you is that booking the peel on the
 * Wednesday for a Saturday shoot costs you the Saturday, and that the drainage
 * you booked for a quiet Tuesday did nothing you could film.
 *
 * Everything here is a starting default she can edit. Nothing is a medical
 * claim and nothing is a promise about a price.
 */

export type ProtocolCategory = "brow" | "lash" | "skin" | "body" | "hair" | "teeth" | "hands" | "wardrobe"

export type Presentation = "masculine" | "feminine" | "androgynous"

export type ProtocolSeed = {
  key: string
  label: string
  category: ProtocolCategory
  /** What it actually does, stated without hype and without medical claims. */
  what: string
  /** Minimum days between treatment and filming. */
  lead_days_before_camera: number
  /** Days after treatment when it looks its best. */
  peak_days_after: number
  /** How often it needs redoing. Null means one-off or as-needed. */
  repeat_weeks: number | null
  /**
   * Indicative Dublin range in euro, as a rough anchor for a first quote.
   *
   * Deliberately wide and deliberately not presented as researched. Salon
   * pricing moves and varies enormously by postcode, so the number that matters
   * is what she is actually quoted. This exists so a blank row does not look
   * like a zero, and the screen labels it as an estimate everywhere it appears.
   */
  indicative_eur: [number, number]
  /** How to ask for it so it suits the presentation. Empty means it does not vary. */
  by_presentation?: Partial<Record<Presentation, string>>
  /** The thing that goes wrong, stated plainly. */
  watch_out?: string
  /** True where a qualified clinician is involved and it is not a salon service. */
  clinical?: boolean
}

export const PROTOCOL_SEEDS: ProtocolSeed[] = [
  // --- Brows and lashes: the highest return per euro on a talking head, -----
  // --- because they frame the eyes and the eyes are what a viewer tracks. ---
  {
    key: "brow_lamination",
    label: "Brow lamination",
    category: "brow",
    what: "Sets the brow hairs in a direction so the brow looks fuller and tidier without adding colour or shape.",
    lead_days_before_camera: 2,
    peak_days_after: 3,
    repeat_weeks: 7,
    indicative_eur: [40, 70],
    by_presentation: {
      masculine:
        "Ask for brushed up and straight, low hold, no arch added and no tail lifted. The default a salon reaches for is a lifted arch, which is the single thing that will read feminine on camera. Say 'I want it fuller and flatter, not lifted'.",
      androgynous: "Brushed up with a soft arch. Ask them to keep the tail flat rather than tapered.",
      feminine: "Standard lift with the tail set upward.",
    },
    watch_out:
      "Day one it looks glossy and over-set on everyone. It settles by day two or three, which is why the lead time is two days rather than zero. Do not film the same day.",
  },
  {
    key: "brow_tint",
    label: "Brow tint",
    category: "brow",
    what: "Darkens the brow hairs and the fine hairs around them for a few weeks.",
    lead_days_before_camera: 3,
    peak_days_after: 5,
    repeat_weeks: 4,
    indicative_eur: [15, 30],
    by_presentation: {
      masculine:
        "Go one shade lighter than you think. Tint is the other thing that reads as makeup on camera. The goal is that nobody can tell, and a shade below natural is how you get there.",
    },
    watch_out: "It is darkest for the first three to five days and softens after. Book it early in the week, not the night before.",
  },
  {
    key: "lash_lift",
    label: "Lash lift",
    category: "lash",
    what: "Curls your own lashes upward from the root. No extensions and nothing added.",
    lead_days_before_camera: 1,
    peak_days_after: 2,
    repeat_weeks: 7,
    indicative_eur: [45, 75],
    by_presentation: {
      masculine:
        "This is the one to do instead of extensions. A lift opens the eye and reads as rested. Extensions read as makeup on camera under any lighting, and on a masculine presentation that is a much bigger tell than it is in person. Skip the tint that gets upsold with it, or take it very light.",
    },
    watch_out: "No water on the lashes for 24 hours. If your lashes are very short a lift has little to work with.",
  },

  // --- Skin: the category where the timing actually matters ----------------
  {
    key: "hydrating_facial",
    label: "Hydrating facial",
    category: "skin",
    what: "Cleansing, exfoliation and hydration with no peeling agent. Skin looks plumper and takes light more evenly.",
    lead_days_before_camera: 1,
    peak_days_after: 2,
    repeat_weeks: 4,
    indicative_eur: [60, 110],
    watch_out:
      "This is the safe one to do close to a shoot. Ask them explicitly not to add extractions or a peel if you are filming within the week, because both change the answer.",
  },
  {
    key: "peel_superficial",
    label: "Facial peel, superficial",
    category: "skin",
    what: "A light acid peel that speeds up surface turnover. Texture and tone improve over the following weeks.",
    lead_days_before_camera: 8,
    peak_days_after: 12,
    repeat_weeks: 5,
    indicative_eur: [70, 130],
    watch_out:
      "Visible flaking on days two to five. This is the treatment that ruins shoots, and it ruins them precisely because people book it to look good for the shoot. Eight days clear, minimum. Stop retinoids about five days before it.",
    clinical: false,
  },
  {
    key: "dermaplaning",
    label: "Dermaplaning",
    category: "skin",
    what: "Removes dead surface skin and fine vellus hair with a blade. Skin looks smoother and reflects light more evenly.",
    lead_days_before_camera: 2,
    peak_days_after: 3,
    repeat_weeks: 4,
    indicative_eur: [50, 90],
    by_presentation: {
      masculine:
        "Worth a thought before booking. If you have any facial hair you want to keep, this is not the treatment, and regrowth on treated areas can feel coarser for a few days even though it does not actually grow back thicker.",
    },
    watch_out: "Skin is more sun sensitive for about a week afterwards.",
  },
  {
    key: "microneedling",
    label: "Microneedling",
    category: "skin",
    what: "Controlled micro-injury to prompt collagen. Aimed at texture and scarring over months, not at looking better this week.",
    lead_days_before_camera: 7,
    peak_days_after: 30,
    repeat_weeks: 6,
    indicative_eur: [120, 250],
    watch_out:
      "Red like sunburn for two to three days, settled by five to seven. It is a long game treatment. Judge it at three months, not at three days.",
    clinical: true,
  },
  {
    key: "lymphatic_drainage",
    label: "Facial lymphatic drainage",
    category: "body",
    what: "Manual massage that moves fluid and temporarily reduces facial puffiness, particularly under the eyes and along the jaw.",
    lead_days_before_camera: 0,
    peak_days_after: 1,
    repeat_weeks: null,
    indicative_eur: [60, 100],
    watch_out:
      "The effect is real and it is temporary. It peaks within about a day and is largely gone within three, so this is a day-before treatment and nothing else. Booking it on a random Tuesday is the most commonly wasted money on this list. Claims beyond de-puffing, detox and the rest, are not supported.",
  },
  {
    key: "wrinkle_relaxer",
    label: "Wrinkle relaxer",
    category: "skin",
    what: "Prescription injectable that softens movement in the treated muscle.",
    lead_days_before_camera: 14,
    peak_days_after: 14,
    repeat_weeks: 16,
    indicative_eur: [180, 350],
    watch_out:
      "Takes ten to fourteen days to finish settling, and the in-between stage is uneven. Never book inside two weeks of a shoot. This is a prescription medical treatment: it needs a doctor, not a salon, and the decision is a medical one rather than anything this screen can advise on.",
    clinical: true,
  },

  // --- The unglamorous ones that show up more than people expect -----------
  {
    key: "haircut",
    label: "Haircut",
    category: "hair",
    what: "The single highest impact item on this list for a talking head, and the one most often left too late.",
    lead_days_before_camera: 2,
    peak_days_after: 4,
    repeat_weeks: 4,
    indicative_eur: [25, 60],
    watch_out:
      "A day-one cut photographs sharp to the point of severe, and short structured cuts sit best around days two to five. If your cut is short, four weeks is the honest cadence and five is already growing out on camera.",
  },
  {
    key: "teeth_whitening",
    label: "Teeth whitening",
    category: "teeth",
    what: "Professional whitening. Reads strongly on camera because you are talking for the whole video.",
    lead_days_before_camera: 3,
    peak_days_after: 7,
    repeat_weeks: 40,
    indicative_eur: [200, 450],
    watch_out:
      "Sensitivity for a day or two and a strict no-staining window of about 48 hours, so no coffee and no red wine. Shade settles over the first week. Home kits from a salon rather than a dentist are the usual regret here.",
    clinical: true,
  },
  {
    key: "hands_nails",
    label: "Hands and nails",
    category: "hands",
    what: "Short, filed, clean and buffed. Hands are in frame constantly if you talk with them and nobody notices them until they are wrong.",
    lead_days_before_camera: 0,
    peak_days_after: 0,
    repeat_weeks: 3,
    indicative_eur: [20, 40],
    by_presentation: {
      masculine: "Ask for a men's manicure or just say buffed, no polish, no shine. A gloss top coat catches key light and is the giveaway.",
    },
  },
  {
    key: "wardrobe_tailoring",
    label: "Wardrobe and tailoring",
    category: "wardrobe",
    what: "Fit does more on camera than anything in this list, and a tailored shoulder is the difference between a shirt reading as expensive or as borrowed.",
    lead_days_before_camera: 10,
    peak_days_after: 10,
    repeat_weeks: null,
    indicative_eur: [15, 60],
    by_presentation: {
      masculine:
        "The two alterations worth the money are the shoulder seam and the sleeve length. Both are cheap and both are what makes off-the-peg menswear read as fitted.",
    },
    watch_out:
      "Turnaround is one to two weeks in most Dublin tailors and longer before Christmas. This is the item that has a lead time everyone forgets is a lead time.",
  },
]

export const PROTOCOL_BY_KEY = new Map(PROTOCOL_SEEDS.map((p) => [p.key, p]))

export const CATEGORY_LABEL: Record<ProtocolCategory, string> = {
  brow: "Brows",
  lash: "Lashes",
  skin: "Skin",
  body: "Face and body work",
  hair: "Hair",
  teeth: "Teeth",
  hands: "Hands",
  wardrobe: "Wardrobe",
}

/** The presentation-specific line, falling back to nothing rather than to a guess. */
export function presentationNote(seed: ProtocolSeed, presentation: Presentation | null): string | null {
  if (!presentation) return null
  return seed.by_presentation?.[presentation] ?? null
}
