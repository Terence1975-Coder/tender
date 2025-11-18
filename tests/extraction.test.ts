import { describe, expect, it } from "vitest";
import { extractFromText, extractCandidatesFromText } from "../src/utils/extraction.js";
import { selectBestCandidate } from "../src/utils/roles.js";

describe("extractFromText", () => {
  it("should extract emails, phones, addresses, and linkedin", () => {
    const sample = `Contact us at info@acme.test or +44 20 7123 4567. Our office is 1 Cyber Street, London, UK. Follow https://www.linkedin.com/company/acme-ltd.`;
    const result = extractFromText(sample);
    expect(result.emails).toContain("info@acme.test");
    expect(result.phones.some((phone) => phone.includes("+44"))).toBe(true);
    expect(result.addresses[0]).toContain("London");
    expect(result.linkedinCompanies[0]).toContain("linkedin.com/company");
  });
});

describe("selectBestCandidate", () => {
  it("should prioritise senior IT titles", () => {
    const candidates = extractCandidatesFromText(
      `Jane Doe – IT Manager\nJohn Smith – Chief Technology Officer\n`,
    );
    const best = selectBestCandidate(candidates, "it");
    expect(best?.name).toBe("John Smith");
  });

  it("should prioritise senior HR titles", () => {
    const candidates = extractCandidatesFromText(
      `Alice Roe – People Manager\nBob Roe – Chief People Officer\n`,
    );
    const best = selectBestCandidate(candidates, "hr");
    expect(best?.name).toBe("Bob Roe");
  });
});
