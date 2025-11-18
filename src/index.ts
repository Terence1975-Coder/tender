import { chromium } from "playwright";
import pLimit from "p-limit";
import { companySchema, type CliOptions, cliOptionsDefaults, type CompanyRecord, type SchemaMapper } from "./types.js";
import { DirectoryScraper } from "./scraper/directory.js";
import { buildCompanyRecord } from "./scraper/companyDiscovery.js";
import { logger } from "./logger.js";
import { setTimeout as delay } from "node:timers/promises";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

interface RunResult {
  records: CompanyRecord[];
}

function applySchemaMap(record: CompanyRecord, map: SchemaMapper | null): Record<string, unknown> {
  if (!map) {
    return record;
  }
  const output: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, value]) => {
    const mappedKey = map[key] ?? key;
    output[mappedKey] = value;
  });
  return output;
}

async function loadSchemaMapper(mapFile: string | null): Promise<SchemaMapper | null> {
  if (!mapFile) {
    return null;
  }
  const data = await readFile(mapFile, "utf8");
  return JSON.parse(data) as SchemaMapper;
}

async function writeOutput(
  records: CompanyRecord[],
  options: CliOptions,
  mapper: SchemaMapper | null,
): Promise<void> {
  if (!options.output) {
    return;
  }
  const directory = path.dirname(options.output);
  await mkdir(directory, { recursive: true });
  if (options.format === "jsonl") {
    const lines = records.map((record) => JSON.stringify(applySchemaMap(record, mapper)));
    await writeFile(options.output, `${lines.join("\n")}\n`, "utf8");
  } else {
    await writeFile(options.output, JSON.stringify(records.map((record) => applySchemaMap(record, mapper)), null, 2), "utf8");
  }
  logger.info("output_written", { path: options.output, count: records.length });
}

export async function run(passedOptions: Partial<CliOptions>): Promise<RunResult> {
  const options: CliOptions = { ...cliOptionsDefaults, ...passedOptions };
  const browser = await chromium.launch({ headless: options.headless });
  try {
    const directoryScraper = new DirectoryScraper({ browser, options });
    let entries = await directoryScraper.collect();
    if (options.maxCompanies) {
      entries = entries.slice(0, options.maxCompanies);
    }

    const limit = pLimit(options.concurrency);
    const records: CompanyRecord[] = [];

    const mapper = await loadSchemaMapper(options.mapFile);

    let processed = 0;
    const tasks = entries.map((entry) =>
      limit(async () => {
        if (options.delayMs) {
          await delay(options.delayMs);
        }
        try {
          const record = await buildCompanyRecord({ entry, options });
          const validated = companySchema.parse(record);
          records.push(validated);
          processed += 1;
          logger.info("company_processed", { company: entry.company, processed, total: entries.length });
        } catch (error) {
          logger.error("company_processing_failed", { company: entry.company, message: (error as Error).message });
        }
      }),
    );
    await Promise.all(tasks);

    if (options.output && !options.dryRun) {
      await writeOutput(records, options, mapper);
    }

    return { records };
  } finally {
    await browser.close();
  }
}
