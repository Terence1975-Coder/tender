/* eslint-disable no-console */
export type LogLevel = "debug" | "info" | "warn" | "error";

const levels: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const activeLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";
const activeThreshold = levels[activeLevel] ?? levels.info;

export interface StructuredLog {
  event: string;
  [key: string]: unknown;
}

function log(level: LogLevel, event: string, payload: Record<string, unknown> = {}) {
  if (levels[level] < activeThreshold) {
    return;
  }
  const entry: StructuredLog = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (event: string, payload?: Record<string, unknown>) => log("debug", event, payload),
  info: (event: string, payload?: Record<string, unknown>) => log("info", event, payload),
  warn: (event: string, payload?: Record<string, unknown>) => log("warn", event, payload),
  error: (event: string, payload?: Record<string, unknown>) => log("error", event, payload),
};
