import { describe, it } from "vitest";

describe.skip("live smoke test", () => {
  it("scrapes a limited subset of the IASME directory", async () => {
    // Enable this test locally to exercise the full Playwright pipeline:
    // const { run } = await import("../src/index.js");
    // await run({ maxCompanies: 5, preview: true });
  });
});
