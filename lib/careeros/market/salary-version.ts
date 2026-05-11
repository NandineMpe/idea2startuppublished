/** Bump when salary composition logic changes. */
export const SALARY_SOURCE_DATASET_VERSION = "salary-band-v1"

export const SALARY_SENIORITY_BANDS = ["junior", "mid", "senior"] as const
export type SalarySeniorityBand = (typeof SALARY_SENIORITY_BANDS)[number]
