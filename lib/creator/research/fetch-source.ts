import { createHash } from "node:crypto"

/**
 * Get the actual text of a source document.
 *
 * Deliberately boring and deliberately defensive. Everything here is a public
 * URL from a lane adapter, which means arbitrary hosts, arbitrary sizes and
 * arbitrary content types, and the failure this guards hardest against is a
 * single 400 page PDF hanging the whole morning's run.
 */

/** Past this, a document is a corpus rather than a document. */
const MAX_BYTES = 12 * 1024 * 1024
const TIMEOUT_MS = 25_000

/** Enough for the model to work with, small enough not to blow the context budget. */
export const MAX_EXTRACT_CHARS = 120_000

export type FetchedSource =
  | { ok: true; text: string; hash: string; mediaType: string; chars: number; truncated: boolean }
  | { ok: false; error: string }

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32)
}

/**
 * Collapse whitespace before hashing and before quote matching.
 *
 * Both need it, and they need the SAME normalisation or verification fails on
 * documents it should pass: a PDF extractor emits line breaks wherever the
 * column ended, so a quote the model read as one sentence is stored with a
 * newline in the middle of it.
 */
export function normalise(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    // Non-breaking spaces and the various unicode dashes and quotes that PDFs
    // are full of. Without this, a quote copied faithfully out of the document
    // fails a literal substring check on a character the creator cannot see.
    .replace(/ /g, " ")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Point at the document rather than at the page about the document.
 *
 * This matters more than it looks. An arXiv /abs/ page is roughly 4,900
 * characters of title, abstract and site furniture, and an extract taken from
 * one has every locator reading "Abstract" — which is to say the desk was
 * reading abstracts and calling it reading the paper. Papers is also the
 * largest lane quota, so this was the single biggest gap between what the
 * pipeline claimed to do and what it did.
 */
export function canonicaliseSourceUrl(url: string): string {
  // arxiv.org/abs/2608.07316v1 -> arxiv.org/pdf/2608.07316v1
  const arxiv = url.match(/^https?:\/\/(?:www\.)?arxiv\.org\/abs\/(.+)$/i)
  if (arxiv) return `https://arxiv.org/pdf/${arxiv[1]}`

  // SSRN and bioRxiv/medRxiv follow the same shape: a landing page and a
  // sibling PDF that is the actual thing.
  const biorxiv = url.match(/^(https?:\/\/(?:www\.)?(?:bio|med)rxiv\.org\/content\/[^?#]+?)(?:\.full)?(?:\.pdf)?$/i)
  if (biorxiv && !url.toLowerCase().endsWith(".pdf")) return `${biorxiv[1]}.full.pdf`

  return url
}

export async function fetchSource(rawUrl: string): Promise<FetchedSource> {
  const url = canonicaliseSourceUrl(rawUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Several regulators and journals return 403 to an unidentified client.
        "user-agent":
          "Mozilla/5.0 (compatible; JunoCreatorOS/1.0; +https://usejuno-ai.com) research-desk",
        accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.8",
      },
    })

    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` }

    const declaredLength = Number(response.headers.get("content-length") ?? 0)
    if (declaredLength > MAX_BYTES) {
      return { ok: false, error: `Too large: ${Math.round(declaredLength / 1024 / 1024)}MB` }
    }

    const mediaType = (response.headers.get("content-type") ?? "").split(";")[0].trim()
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > MAX_BYTES) {
      return { ok: false, error: `Too large: ${Math.round(buffer.byteLength / 1024 / 1024)}MB` }
    }

    let raw: string
    if (mediaType === "application/pdf" || url.toLowerCase().endsWith(".pdf")) {
      raw = await extractPdf(buffer)
    } else if (mediaType.includes("json")) {
      raw = buffer.toString("utf8")
    } else {
      raw = extractHtml(buffer.toString("utf8"))
    }

    const text = normalise(raw)
    if (text.length < 200) {
      // A page that yields nothing readable is usually a paywall, a cookie
      // interstitial or a JS-only app. Saying so is more useful than storing
      // 40 characters of nav furniture and calling it a document.
      return { ok: false, error: `Only ${text.length} chars of text: paywall, interstitial or JS-only page` }
    }

    const truncated = text.length > MAX_EXTRACT_CHARS
    return {
      ok: true,
      // Hash the FULL text, not the truncated slice, so raising the cap later
      // does not invalidate every cached row.
      hash: hash(text),
      text: truncated ? text.slice(0, MAX_EXTRACT_CHARS) : text,
      mediaType: mediaType || "unknown",
      chars: text.length,
      truncated,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message === "The operation was aborted." ? "Timed out" : message }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * pdf-parse v2 exports a PDFParse class, not the callable default v1 had.
 *
 * The older call shape elsewhere in this repo throws "pdfParse is not a
 * function" at runtime rather than failing to compile, because it casts the
 * module to a function signature first. Worth knowing if PDF text turns up
 * empty anywhere else.
 */
async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return result.text ?? ""
  } finally {
    // Holds a pdfjs worker open otherwise, and this runs in a long-lived
    // serverless isolate handling many documents in one invocation.
    await parser.destroy()
  }
}

function extractHtml(html: string): string {
  // Strip the furniture before conversion. html-to-text keeps script and style
  // content out of the output but leaves nav and footer link soup in, and that
  // soup is what makes a model quote a cookie banner.
  const stripped = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")

  // Required lazily and defensively: this runs inside an Inngest step and a
  // module-load failure here would take down the whole function rather than one
  // document.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { convert } = require("html-to-text") as typeof import("html-to-text")
  return convert(stripped, {
    // `false` disables wrapping; the published type says number, so it is
    // asserted rather than dropped, because wrapping a document at 80 columns
    // inserts newlines mid-sentence and those newlines break quote matching.
    wordwrap: false as unknown as number,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "table", options: { uppercaseHeaderCells: false } },
    ],
  })
}
