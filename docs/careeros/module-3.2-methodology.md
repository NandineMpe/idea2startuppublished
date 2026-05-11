# Module 3.2 — Skill Half-Life Tracker: Methodology

## Definition

The **skill half-life** is defined as the time (in months) for a skill's job-posting frequency to halve at its current rate of change. It is a linear extrapolation based on current market velocity and AI automation exposure — not a prediction.

When a skill has a positive or flat posting trajectory (rising or stable), its half-life is undefined (`null`). Half-life is only meaningful when a skill is declining.

---

## Formula v1

### Inputs

| Variable | Source | Description |
|---|---|---|
| `v` | `market_skill_velocity.velocity_score` | % change in job postings over 12 months (M360 window) |
| `e` | `skill_ai_exposure_scores.exposure_score` | AI displacement probability 0.0–1.0 |
| `c` | `skill_ai_exposure_scores.exposure_category` | `low` / `medium` / `high` / `augmenting` |
| `mention_count` | `market_skill_velocity.mention_count` | Sample size (used for confidence) |
| `prior_window_mention_count` | `market_skill_velocity.prior_window_mention_count` | Prior period count (used for volatility) |

### Step 1 — Effective Annual Decline Rate (D)

```
if category == "augmenting":
    D = -0.10 - max(0, (-v / 100) * 0.5)

elif v >= 0 and e <= 0.3:
    D = -v / 100

elif v >= 0 and e > 0.3:
    D = -v / 100 + (e - 0.3) * 0.15

else:  # v < 0
    D = -v / 100 + e * 0.10
```

`D < 0` means growing demand; `D > 0` means declining demand.

### Step 2 — Base Status

```
if D < -0.05:   status = "rising"
elif D <= 0.05: status = "stable"
elif D <= 0.15: status = "declining"
else:           status = "at-risk"
```

### Step 3 — Overrides

```
if category == "augmenting" and v < 0:
    status = "at-risk"
    override: "augmenting_skill_declining_demand"

if e > 0.7 and v >= 0:
    status = "at-risk"
    override: "high_ai_exposure_despite_growth"
```

Rationale: a high-exposure skill growing today (e.g. data entry) faces structural displacement risk that the velocity signal alone would miss.

### Step 4 — Half-Life Computation

Half-life is only computed when `D > 0`:

```
half_life_months = (ln(2) / ln(1 + D)) * 12
```

Rounded to 1 decimal place.

### Step 5 — Confidence

```
window_volatility = |mention_count - prior_window_mention_count| / prior_window_mention_count

if mention_count >= 1000 and (window_volatility is null or window_volatility < 0.3):
    confidence = "high"
elif mention_count >= 200 and (window_volatility is null or window_volatility < 0.6):
    confidence = "medium"
else:
    confidence = "low"
```

### Step 6 — Confidence Range

When confidence is not "high" and `half_life_months` is not null:

```
spread = 0.40 for "medium", 0.70 for "low"
range_low  = round(half_life_months * (1 - spread))
range_high = round(half_life_months * (1 + spread))
```

---

## Worked Examples

### Example 1 — Python (rising, high confidence)
- `v = +15`, `e = 0.20`, `c = "low"`, `mention_count = 5000`
- D = -15/100 = -0.15 → status = **rising**
- No half-life (D < 0)
- window_volatility ≈ 0.04 → confidence = **high**

### Example 2 — Prompt Engineering (augmenting, rising)
- `v = +340`, `e = 0.05`, `c = "augmenting"`, `mention_count = 3000`
- D = -0.10 - max(0, 0) = -0.10 → status = **rising**
- No half-life

### Example 3 — Augmenting skill with declining demand
- `v = -10`, `e = 0.05`, `c = "augmenting"`, `mention_count = 500`
- D = -0.10 - max(0, 0.10 * 0.5) = -0.10 - 0.05 = -0.15 → base: rising
- Override: augmenting + v < 0 → status = **at-risk**

### Example 4 — Data Entry (high exposure, growing)
- `v = +5`, `e = 0.80`, `c = "high"`, `mention_count = 2000`
- D = -(5/100) + (0.80 - 0.30) * 0.15 = -0.05 + 0.075 = +0.025 → base: stable
- Override: e > 0.7 and v >= 0 → status = **at-risk**

### Example 5 — jQuery (declining, medium confidence)
- `v = -25`, `e = 0.30`, `c = "low"`, `mention_count = 1500`
- D = 25/100 + 0.30 * 0.10 = 0.25 + 0.03 = 0.28 → status = **at-risk** (D > 0.15)
- half_life = (ln2 / ln(1.28)) * 12 ≈ **28.2 months**
- window_volatility small → confidence = **high**

### Example 6 — VBA (at-risk, high decline)
- `v = -40`, `e = 0.75`, `c = "high"`, `mention_count = 800`
- D = 40/100 + 0.75 * 0.10 = 0.40 + 0.075 = 0.475 → status = **at-risk**
- half_life = (ln2 / ln(1.475)) * 12 ≈ **20.2 months**

### Example 7 — Go (stable)
- `v = +2`, `e = 0.20`, `c = "low"`, `mention_count = 300`
- D = -2/100 = -0.02 → status = **stable**
- No half-life (D <= 0)

### Example 8 — Low confidence range
- Any skill with `mention_count = 50` → confidence = **low**
- If D > 0: half_life_range present with ±70% spread

### Example 9 — Medium confidence range
- `mention_count = 300`, high volatility between windows → confidence = **medium**
- If D > 0: half_life_range with ±40% spread

### Example 10 — Stable at exactly v=0
- `v = 0`, `e = 0.20`, `c = "low"` → D = 0 → D <= 0.05 → **stable**

---

## Caveats

1. **Linear extrapolation, not prediction.** The half-life assumes the current velocity continues unchanged. Real markets are non-linear.
2. **Stable skills have undefined half-life.** A null `half_life_months` means the skill is not declining — not that data is missing.
3. **Augmenting skills special case.** Skills that grow in value through AI adoption (orchestration, evaluation, safety) are always treated favourably unless market demand is actively declining.
4. **Exposure scores are point-in-time.** The seed data reflects research available as of 2023–2024. Scores should be reviewed quarterly.
5. **Low sample sizes.** Skills with fewer than 200 postings have low confidence ratings and wide ranges.

---

## Source Citations

- Eloundou, T., Manning, S., Mishkin, P., & Rock, D. (2023). *GPTs are GPTs: An Early Look at the Labor Market Impact Potential of Large Language Models.* arXiv:2303.10130.
- McKinsey Global Institute. (2024). *Skill Shift: Automation and the Future of the Workforce — Skill Change Index Update.*
