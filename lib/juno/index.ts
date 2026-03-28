// Shared company context (used by agents)
export { getCompanyContext, getCompanyContextLight, getActiveUserIds } from "../company-context"
export type { CompanyContext, CompanyProfile, CompanyAsset } from "../company-context"

// Scrapers
export {
  scrapeArxiv,
  scrapeHackerNews,
  scrapeNews,
  scrapeProductHunt,
  scrapeJobBoards,
  scrapeRegulation,
  scrapeCBSSources,
  scrapeCTOSources,
  scrapeCROJobSources,
  dedupeByUrl,
  filterToLast24Hours,
  cutoffMs24HoursAgo,
} from "./scrapers"
export type { JobListing, RawItem } from "./scrapers"

export { SOURCES, getSourcesForAgent, getSourcesByCategory } from "./sources"
export type { Source } from "./sources"

// Scoring
export { scoreItems } from "./scoring"
export type { ScoredItem } from "./scoring"

// AI generation
export {
  generateLinkedInPost,
  generateComments,
  generateOutreach,
  scoreLeadFit,
  analyzeTechTrends,
} from "./ai-engine"

// Formatting
export { formatBrief, formatBriefForVault, formatDashboardItem } from "./brief-formatter"

// Delivery
export { saveBriefToDB, saveLeadToDB, saveContentToDB } from "./delivery"

// Obsidian vault (GitHub API)
export {
  resolveGithubVaultConfig,
  listVaultFiles,
  readVaultFile,
  readVaultFiles,
  readVaultFolder,
  writeVaultFile,
  getVaultContext,
} from "./vault"
export type { VaultFile } from "./vault"
