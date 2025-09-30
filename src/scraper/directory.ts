import type { Browser } from "playwright";
import { setTimeout as delay } from "node:timers/promises";
import { logger } from "../logger.js";
import type { CliOptions, DirectoryEntry } from "../types.js";

interface DirectoryScraperOptions {
  browser: Browser;
  options: CliOptions;
}

interface JsonFeedCandidate {
  url: string;
  payload: unknown;
}

export class DirectoryScraper {
  private browser: Browser;

  private options: CliOptions;

  constructor({ browser, options }: DirectoryScraperOptions) {
    this.browser = browser;
    this.options = options;
  }

  async collect(): Promise<DirectoryEntry[]> {
    const context = await this.browser.newContext();
    const page = await context.newPage();
    const jsonFeeds: JsonFeedCandidate[] = [];

    page.on("response", async (response) => {
      try {
        const request = response.request();
        if (!request) {
          return;
        }
        const url = response.url();
        const headers = response.headers();
        const contentType = headers["content-type"] ?? "";
        if (!contentType.includes("application/json")) {
          return;
        }
        const payload = await response.json().catch(() => null);
        if (!payload) {
          return;
        }
        jsonFeeds.push({ url, payload });
      } catch (error) {
        logger.debug("json_feed_capture_failed", { message: (error as Error).message });
      }
    });

    await page.goto(this.options.index, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    try {
      await page.waitForSelector("table", { timeout: this.options.timeout }).catch(() => null);
    } catch (error) {
      logger.warn("directory_table_wait_failed", { message: (error as Error).message });
    }

    const domEntries = await this.scrapeFromDom(page);
    const feedEntries = this.extractFromFeeds(jsonFeeds);

    await context.close();

    const combined = [...feedEntries, ...domEntries];
    const deduped = new Map<string, DirectoryEntry>();
    combined.forEach((entry) => {
      const key = entry.company.toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, entry);
      } else {
        const existing = deduped.get(key)!;
        const merged: DirectoryEntry = {
          company: existing.company,
          profileUrl: existing.profileUrl ?? entry.profileUrl,
          externalUrl: existing.externalUrl ?? entry.externalUrl,
          certifications: Array.from(new Set([...existing.certifications, ...entry.certifications])),
          filters: Array.from(new Set([...existing.filters, ...entry.filters])),
        };
        deduped.set(key, merged);
      }
    });

    const entries = Array.from(deduped.values());
    logger.info("directory_entries_collected", { count: entries.length });
    return entries;
  }

  private extractFromFeeds(feeds: JsonFeedCandidate[]): DirectoryEntry[] {
    const entries: DirectoryEntry[] = [];
    feeds.forEach((feed) => {
      const payload = feed.payload as Record<string, unknown>;
      const maybeItems = this.walkForItems(payload);
      maybeItems.forEach((item) => {
        const company = (item?.name ?? item?.company ?? item?.title) as string | undefined;
        if (!company) {
          return;
        }
        let profileUrl = this.normaliseUrl(item?.url ?? item?.link ?? null);
        let externalUrl = this.normaliseUrl(item?.website ?? item?.external_link ?? null);
        if (profileUrl && !profileUrl.includes("iasme.co.uk")) {
          externalUrl = externalUrl ?? profileUrl;
          profileUrl = null;
        }
        if (externalUrl && externalUrl.includes("iasme.co.uk")) {
          profileUrl = profileUrl ?? externalUrl;
          externalUrl = null;
        }
        const certs = Array.isArray(item?.certifications)
          ? (item?.certifications as unknown[])
              .map((cert) => (typeof cert === "string" ? cert.trim() : null))
              .filter((cert): cert is string => Boolean(cert))
          : [];
        entries.push({
          company,
          profileUrl,
          externalUrl,
          certifications: certs,
          filters: [feed.url],
        });
      });
    });
    if (entries.length) {
      logger.info("directory_json_feed_used", { feeds: feeds.map((feed) => feed.url) });
    }
    return entries;
  }

  private normaliseUrl(value: unknown): string | null {
    if (!value || typeof value !== "string") {
      return null;
    }
    try {
      const url = new URL(value, this.options.index);
      return url.toString();
    } catch {
      return null;
    }
  }

  private walkForItems(payload: Record<string, unknown>): Array<Record<string, unknown>> {
    const queue: Array<Record<string, unknown> | Record<string, unknown>[]> = [payload];
    const items: Array<Record<string, unknown>> = [];
    while (queue.length) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      if (Array.isArray(current)) {
        current.forEach((item) => {
          if (this.looksLikeCompany(item)) {
            items.push(item as Record<string, unknown>);
          } else if (item && typeof item === "object") {
            queue.push(item as Record<string, unknown>);
          }
        });
      } else {
        if (this.looksLikeCompany(current)) {
          items.push(current);
        }
        Object.values(current).forEach((value) => {
          if (Array.isArray(value) || (value && typeof value === "object")) {
            queue.push(value as Record<string, unknown>);
          }
        });
      }
    }
    return items;
  }

  private looksLikeCompany(item: unknown): item is Record<string, unknown> {
    if (!item || typeof item !== "object") {
      return false;
    }
    const candidate = item as Record<string, unknown>;
    const name = candidate.name ?? candidate.company ?? candidate.title;
    if (!name || typeof name !== "string") {
      return false;
    }
    const hasCertifications = Array.isArray(candidate.certifications) || typeof candidate.certification === "string";
    const hasUrl = typeof candidate.url === "string" || typeof candidate.link === "string";
    return hasCertifications || hasUrl;
  }

  private async scrapeFromDom(page: import("playwright").Page): Promise<DirectoryEntry[]> {
    const entries: DirectoryEntry[] = [];
    const visitedFilters = new Set<string>();

    const letterSelectors = await page.evaluate(() => {
      const selectors: string[] = [];
      document.querySelectorAll('[data-letter], [data-filter-letter], .az-filter button, .az-filter a').forEach((element) => {
        const text = element.textContent?.trim();
        if (text) {
          selectors.push(text);
        }
      });
      return selectors;
    });

    const certificationSelectors = await page.evaluate(() => {
      const selectors: string[] = [];
      document
        .querySelectorAll('[data-certification], [data-filter-certification], .certification-filter button, .certification-filter a')
        .forEach((element) => {
          const text = element.textContent?.trim();
          if (text) {
            selectors.push(text);
          }
        });
      return selectors;
    });

    const letters = letterSelectors.length ? letterSelectors : Array.from({ length: 26 }, (_, index) => String.fromCharCode(65 + index));
    const certifications = certificationSelectors.length ? certificationSelectors : ["All"];

    for (const letter of letters) {
      await this.tryClickFilter(page, letter);
      for (const certification of certifications) {
        const filterKey = `${letter}:${certification}`;
        if (visitedFilters.has(filterKey)) {
          continue;
        }
        visitedFilters.add(filterKey);
        await this.tryClickFilter(page, certification);
        await delay(this.options.delayMs);
        const rows = await page.$$eval("table tbody tr", (elements) =>
          elements.map((row) => {
            const companyCell = row.querySelector("td") as HTMLTableCellElement | null;
            const link = companyCell?.querySelector<HTMLAnchorElement>("a");
            const href = link?.href ?? null;
            const isExternal = href ? !href.includes("iasme.co.uk") : false;
            const certificationsCell = row.querySelector("td:nth-child(2)");
            const certificationsList = Array.from(certificationsCell?.querySelectorAll("span, img, .badge") ?? []).map((el) =>
              el.textContent?.trim() ?? el.getAttribute("alt") ?? "",
            );
            return {
              company: companyCell?.textContent?.trim() ?? "",
              profileUrl: isExternal ? null : href,
              externalUrl: isExternal ? href : null,
              certifications: certificationsList.filter(Boolean),
            };
          }),
        );
        rows.forEach((row) => {
          if (!row.company) {
            return;
          }
          entries.push({
            company: row.company,
            profileUrl: row.profileUrl,
            externalUrl: row.externalUrl,
            certifications: row.certifications,
            filters: [letter, certification],
          });
        });
      }
    }

    return entries;
  }

  private async tryClickFilter(page: import("playwright").Page, label: string): Promise<void> {
    if (!label) {
      return;
    }
    const locator = page.locator(`text=${label}`);
    const count = await locator.count();
    if (!count) {
      return;
    }
    try {
      await locator.first().click({ timeout: 1000 }).catch(() => null);
    } catch (error) {
      logger.debug("filter_click_failed", { label, message: (error as Error).message });
    }
  }
}
