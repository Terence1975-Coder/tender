import got, { OptionsOfTextResponseBody } from "got";
import { CookieJar } from "tough-cookie";
import { setTimeout as delay } from "node:timers/promises";
import { logger } from "../logger.js";

export interface RequestOptions {
  url: string;
  timeout: number;
  retries: number;
  delayMs: number;
  headers?: Record<string, string>;
}

const cookieJar = new CookieJar();

export async function httpGet(options: RequestOptions): Promise<string | null> {
  const { url, timeout, retries, delayMs, headers } = options;
  const requestOptions: OptionsOfTextResponseBody = {
    cookieJar,
    timeout: {
      request: timeout,
    },
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...headers,
    },
  };

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await got(url, requestOptions);
      return response.body;
    } catch (error) {
      attempt += 1;
      const statusCode = (error as { response?: { statusCode?: number } }).response?.statusCode;
      logger.warn("http_get_failed", {
        url,
        attempt,
        retries,
        statusCode,
        message: (error as Error).message,
      });
      if (attempt > retries) {
        return null;
      }
      const backoff = Math.min(delayMs * 2 ** (attempt - 1), 5000);
      await delay(backoff + Math.random() * 250);
    }
  }
  return null;
}
