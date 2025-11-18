const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(0\))?(?:\d[\s-]?){7,15}\d/g;
const linkedinCompanyRegex = /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/(?:company|school)\/[\w%\-]+/gi;
const linkedinProfileRegex = /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/in\/[\w%\-]+/gi;

export interface ExtractionResult {
  emails: string[];
  phones: string[];
  addresses: string[];
  linkedinCompanies: string[];
  linkedinProfiles: string[];
}

export function extractFromText(text: string): ExtractionResult {
  const emails = Array.from(text.match(emailRegex) ?? []).map((email) => email.toLowerCase());
  const phones = Array.from(text.match(phoneRegex) ?? []);
  const linkedinCompanies = Array.from(text.match(linkedinCompanyRegex) ?? []);
  const linkedinProfiles = Array.from(text.match(linkedinProfileRegex) ?? []);

  const addresses: string[] = [];
  const addressRegex = /(\d+\s+[\w\s]+,?\s+[\w\s]+,?\s+(?:UK|United Kingdom|England|Scotland|Wales|Northern Ireland))/gi;
  let match: RegExpExecArray | null;
  while ((match = addressRegex.exec(text)) !== null) {
    addresses.push(match[0].trim());
  }

  return {
    emails,
    phones,
    addresses,
    linkedinCompanies,
    linkedinProfiles,
  };
}

export function extractCandidatesFromHtml(html: string): Candidate[] {
  const pattern = /<[^>]+>|&[^;]+;/g;
  const text = html.replace(pattern, " ");
  return extractCandidatesFromText(text);
}

export interface Candidate {
  name: string;
  title: string;
  email: string | null;
  linkedin: string | null;
}

const candidateRegex = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\s*(?:[–\-\u2013\u2014\|,]\s*)([^\n\r\|]{2,120})/g;

export function extractCandidatesFromText(text: string): Candidate[] {
  const candidates: Candidate[] = [];
  const linkedinMatches = Array.from(text.match(linkedinProfileRegex) ?? []);
  let match: RegExpExecArray | null;
  while ((match = candidateRegex.exec(text)) !== null) {
    const rawName = match[1].trim();
    const rawTitle = match[2].replace(/\s+/g, " ").trim();
    if (!rawTitle || rawTitle.length > 120) {
      continue;
    }
    const emailMatch = match[0].match(emailRegex)?.[0]?.toLowerCase() ?? null;
    const linkedinMatch = linkedinMatches.find((link) => match?.[0].includes(link)) ?? null;
    candidates.push({
      name: rawName,
      title: rawTitle,
      email: emailMatch,
      linkedin: linkedinMatch ?? null,
    });
  }
  return candidates;
}
