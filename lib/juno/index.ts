// Context engine (THE BRAIN — every agent starts here)
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
} from "./scrapers"
export type { JobListing, RawItem } from "./scrapers"

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
export { formatBrief } from "./brief-formatter"

// Delivery
export {
  sendWhatsApp,
  sendWhatsAppToUser,
  getUserWhatsAppNumber,
  saveBriefToDB,
  saveLeadToDB,
  saveContentToDB,
} from "./delivery"

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
