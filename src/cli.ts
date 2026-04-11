#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { run } from "./index.js";
import { cliOptionsDefaults } from "./types.js";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("iasme-research")
    .usage("$0 [options]")
    .option("index", {
      type: "string",
      description: "IASME directory index URL",
      default: cliOptionsDefaults.index,
    })
    .option("output", {
      type: "string",
      description: "Output file path",
    })
    .option("format", {
      type: "string",
      choices: ["json", "jsonl"],
      default: cliOptionsDefaults.format,
    })
    .option("max-companies", {
      type: "number",
      description: "Limit the number of companies processed",
    })
    .option("concurrency", {
      type: "number",
      default: cliOptionsDefaults.concurrency,
      description: "Maximum concurrent company processors",
    })
    .option("delay-ms", {
      type: "number",
      default: cliOptionsDefaults.delayMs,
      description: "Delay between requests per company",
    })
    .option("retries", {
      type: "number",
      default: cliOptionsDefaults.retries,
      description: "Number of HTTP retries",
    })
    .option("timeout", {
      type: "number",
      default: cliOptionsDefaults.timeout,
      description: "HTTP request timeout in ms",
    })
    .option("map-file", {
      type: "string",
      description: "Optional JSON file mapping output keys",
    })
    .option("headless", {
      type: "boolean",
      default: cliOptionsDefaults.headless,
      description: "Run Playwright in headless mode",
    })
    .option("dry-run", {
      type: "boolean",
      default: cliOptionsDefaults.dryRun,
      description: "Skip writing output",
    })
    .option("preview", {
      type: "boolean",
      default: cliOptionsDefaults.preview,
      description: "Print summary to stdout",
    })
    .help()
    .alias("h", "help").argv;

  const result = await run({
    index: argv.index,
    output: (argv.output as string | undefined) ?? null,
    format: argv.format as "json" | "jsonl",
    maxCompanies: (argv["max-companies"] as number | undefined) ?? null,
    concurrency: argv.concurrency as number,
    delayMs: argv["delay-ms"] as number,
    retries: argv.retries as number,
    timeout: argv.timeout as number,
    mapFile: (argv["map-file"] as string | undefined) ?? null,
    headless: argv.headless as boolean,
    dryRun: argv["dry-run"] as boolean,
    preview: argv.preview as boolean,
  });

  if (argv.preview) {
    console.log(JSON.stringify(result.records, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
