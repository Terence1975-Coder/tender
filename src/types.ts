import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().nullable(),
  title: z.string().nullable(),
  email: z.string().email().nullable(),
  linkedin: z.string().url().nullable(),
});

export const companySchema = z.object({
  company: z.string(),
  domain: z.string().nullable(),
  website: z.string().url().nullable(),
  emails: z.array(z.string().email()),
  phones: z.array(z.string()),
  address: z.string().nullable(),
  linkedin_company: z.string().url().nullable(),
  it_contact: contactSchema.nullable(),
  hr_contact: contactSchema.nullable(),
  certifications: z.array(z.string()),
  profile_url: z.string().url().nullable(),
  sources: z.array(z.string().url()),
  last_seen: z.string(),
});

export type Contact = z.infer<typeof contactSchema>;
export type CompanyRecord = z.infer<typeof companySchema>;

export interface DirectoryEntry {
  company: string;
  profileUrl: string | null;
  externalUrl: string | null;
  certifications: string[];
  filters: string[];
}

export interface CliOptions {
  index: string;
  output: string | null;
  format: "json" | "jsonl";
  maxCompanies: number | null;
  concurrency: number;
  delayMs: number;
  retries: number;
  timeout: number;
  mapFile: string | null;
  headless: boolean;
  dryRun: boolean;
  preview: boolean;
}

export const cliOptionsDefaults: CliOptions = {
  index: "https://iasme.co.uk/network-directory/",
  output: null,
  format: "jsonl",
  maxCompanies: null,
  concurrency: 4,
  delayMs: 500,
  retries: 3,
  timeout: 15000,
  mapFile: null,
  headless: true,
  dryRun: false,
  preview: false,
};

export type SchemaMapper = Record<string, string>;
