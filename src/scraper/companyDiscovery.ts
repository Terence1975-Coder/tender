import { load } from "cheerio";
import dayjs from "dayjs";
import pLimit from "p-limit";
import { logger } from "../logger.js";
import { httpGet } from "../utils/http.js";
import { extractDomain, normaliseUrl, unique } from "../utils/normalise.js";
import { extractCandidatesFromHtml, extractFromText, type Candidate } from "../utils/extraction.js";
import { selectBestCandidate } from "../utils/roles.js";
import type { CliOptions, CompanyRecord, DirectoryEntry } from "../types.js";

interface FetchResult {
  url: string;
  html: string | null;
}

function resolveUrl(base: string, href: string | null): string | null {
  if (!href) {
    return null;
  }
  try {
    const url = new URL(href, base);
    return url.toString();
  } catch {
    return null;
  }
}

function extractWebsiteFromProfile(html: string, baseUrl: string): string | null {
  const $ = load(html);
  const selectors = ["a[href*='http']", "a.profile-website", "a:contains('Website')", "a:contains('Visit')"];
  for (const selector of selectors) {
    const candidate = $(selector).first();
    if (!candidate.length) {
      continue;
    }
    const href = candidate.attr("href");
    if (!href) {
      continue;
    }
    const url = resolveUrl(baseUrl, href);
    if (url && !url.includes("iasme.co.uk")) {
      return url;
    }
  }
  const meta = $('meta[property="og:url"], link[rel="canonical"]');
  if (meta.length) {
    const href = meta.first().attr("content") ?? meta.first().attr("href") ?? null;
    if (href && !href.includes("iasme.co.uk")) {
      return resolveUrl(baseUrl, href);
    }
  }
  return null;
}

async function searchForWebsite(company: string, options: CliOptions): Promise<{ url: string | null; sources: string[] }> {
  const query = encodeURIComponent(`${company} official site`);
  const searchUrl = `https://duckduckgo.com/html/?q=${query}`;
  const html = await httpGet({ url: searchUrl, timeout: options.timeout, retries: options.retries, delayMs: options.delayMs });
  if (!html) {
    return { url: null, sources: [] };
  }
  const $ = load(html);
  const results: string[] = [];
  $("a.result__a").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) {
      return;
    }
    const urlMatch = href.match(/uddg=([^&]+)/);
    const candidate = urlMatch ? decodeURIComponent(urlMatch[1]) : href;
    if (candidate.includes("duckduckgo.com/y.js")) {
      return;
    }
    results.push(candidate);
  });
  const filtered = results.filter((url) => {
    try {
      const hostname = new URL(url).hostname;
      return !hostname.includes("linkedin.com") && !hostname.includes("facebook.com") && !hostname.includes("twitter.com");
    } catch {
      return false;
    }
  });
  return { url: filtered[0] ?? null, sources: filtered.length ? [searchUrl] : [] };
}

interface PipelineContext {
  entry: DirectoryEntry;
  options: CliOptions;
}

export async function buildCompanyRecord({ entry, options }: PipelineContext): Promise<CompanyRecord> {
  const sources = new Set<string>([options.index]);
  if (entry.profileUrl) {
    sources.add(entry.profileUrl);
  }
  if (entry.externalUrl) {
    sources.add(entry.externalUrl);
  }
  const profileHtml = entry.profileUrl
    ? await httpGet({ url: entry.profileUrl, timeout: options.timeout, retries: options.retries, delayMs: options.delayMs })
    : null;
  if (profileHtml) {
    sources.add(entry.profileUrl!);
  }
  let websiteCandidate = entry.externalUrl;
  if ((!websiteCandidate || websiteCandidate.includes("iasme.co.uk")) && profileHtml && entry.profileUrl) {
    const extracted = extractWebsiteFromProfile(profileHtml, entry.profileUrl);
    if (extracted) {
      websiteCandidate = extracted;
      logger.info("website_found_profile", { company: entry.company, url: extracted });
    }
  }
  if (!websiteCandidate) {
    const searchResult = await searchForWebsite(entry.company, options);
    if (searchResult.url) {
      websiteCandidate = searchResult.url;
      searchResult.sources.forEach((source) => sources.add(source));
      logger.info("website_found_search", { company: entry.company, url: websiteCandidate });
    }
  }
  const website = normaliseUrl(websiteCandidate);
  const domain = extractDomain(website ?? null);

  if (website) {
    sources.add(website);
  }

  const fetchTargets = buildFetchTargets(website);
  const fetchedPages = await fetchPages(fetchTargets, options);
  fetchedPages.forEach((page) => {
    if (page.html) {
      sources.add(page.url);
    }
  });

  const emails: string[] = [];
  const allEmails: string[] = [];
  const phones: string[] = [];
  const addresses: string[] = [];
  let linkedinCompany: string | null = null;
  const candidates: Candidate[] = [];

  for (const page of fetchedPages) {
    if (!page.html) {
      continue;
    }
    const extraction = extractFromText(page.html);
    allEmails.push(...extraction.emails);
    const domainEmails = domain ? extraction.emails.filter((email) => email.endsWith(domain)) : extraction.emails;
    emails.push(...domainEmails);
    phones.push(...extraction.phones);
    addresses.push(...extraction.addresses);
    if (!linkedinCompany && extraction.linkedinCompanies.length) {
      linkedinCompany = extraction.linkedinCompanies[0];
    }
    candidates.push(...extractCandidatesFromHtml(page.html));
  }

  let dedupedEmails = unique(emails);
  if (!dedupedEmails.length) {
    dedupedEmails = unique(allEmails);
  }
  const dedupedPhones = unique(phones);
  const address = addresses.length ? unique(addresses)[0] : null;
  const itCandidate = selectBestCandidate(candidates, "it");
  const hrCandidate = selectBestCandidate(candidates, "hr");

  const record: CompanyRecord = {
    company: entry.company,
    domain,
    website,
    emails: dedupedEmails,
    phones: dedupedPhones,
    address,
    linkedin_company: linkedinCompany ?? null,
    it_contact: itCandidate
      ? {
          name: itCandidate.name,
          title: itCandidate.title,
          email: itCandidate.email,
          linkedin: itCandidate.linkedin,
        }
      : null,
    hr_contact: hrCandidate
      ? {
          name: hrCandidate.name,
          title: hrCandidate.title,
          email: hrCandidate.email,
          linkedin: hrCandidate.linkedin,
        }
      : null,
    certifications: entry.certifications,
    profile_url: entry.profileUrl,
    sources: Array.from(sources),
    last_seen: dayjs().format("YYYY-MM-DD"),
  };

  return record;
}

function buildFetchTargets(website: string | null): string[] {
  if (!website) {
    return [];
  }
  const baseUrl = website.endsWith("/") ? website.slice(0, -1) : website;
  const paths = ["", "/contact", "/about", "/team", "/leadership", "/people", "/careers", "/jobs", "/privacy", "/impressum"];
  return unique(
    paths
      .map((path) => `${baseUrl}${path}`)
      .map((url) => {
        try {
          return new URL(url).toString();
        } catch {
          return null;
        }
      })
      .filter((url): url is string => Boolean(url)),
  );
}

async function fetchPages(urls: string[], options: CliOptions): Promise<FetchResult[]> {
  const limit = pLimit(2);
  const results = await Promise.all(
    urls.map((url) =>
      limit(async () => {
        const html = await httpGet({ url, timeout: options.timeout, retries: options.retries, delayMs: options.delayMs });
        if (!html) {
          logger.debug("page_fetch_failed", { url });
        }
        return { url, html };
      }),
    ),
  );
  return results;
}
