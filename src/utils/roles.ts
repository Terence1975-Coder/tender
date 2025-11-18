import { Candidate } from "./extraction.js";

const itKeywords = [
  "chief information officer",
  "chief technology officer",
  "cio",
  "cto",
  "it director",
  "head of it",
  "technology director",
  "director of technology",
  "it manager",
  "infrastructure",
  "network",
  "systems",
  "information security",
  "cyber",
];

const hrKeywords = [
  "chief people officer",
  "chief human resources officer",
  "people director",
  "hr director",
  "head of people",
  "head of hr",
  "talent",
  "recruiting",
  "people manager",
  "people lead",
  "human resources",
];

const seniorityOrder = ["chief", "vp", "vice president", "director", "head", "lead", "manager"];

function scoreTitle(title: string, keywords: string[]): number {
  const lower = title.toLowerCase();
  let score = 0;
  keywords.forEach((keyword) => {
    if (lower.includes(keyword)) {
      score += 10;
    }
  });
  seniorityOrder.forEach((rank, index) => {
    if (lower.includes(rank)) {
      score += 5 * (seniorityOrder.length - index);
    }
  });
  return score;
}

export function selectBestCandidate(candidates: Candidate[], type: "it" | "hr"): Candidate | null {
  const keywords = type === "it" ? itKeywords : hrKeywords;
  let best: Candidate | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreTitle(candidate.title, keywords);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}
