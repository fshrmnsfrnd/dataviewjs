/**
 * Build-time stand-ins for the parts of the Obsidian runtime that DataviewJS
 * scripts commonly rely on.
 */

export interface RequestUrlParam {
  url: string;
  method?: string;
  contentType?: string;
  body?: string | ArrayBuffer;
  headers?: Record<string, string>;
  throw?: boolean;
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  text: string;
  json: unknown;
}

const warn = (message: string): void => console.warn(`[DataviewJS] ${message}`);

/**
 * Chromium, and with it Obsidian, opens at most 6 connections per host and
 * queues further requests. Node's fetch has no such limit, so a script that
 * fires 18 requests at one site with Promise.all works in Obsidian but trips
 * the site's connection limits in the build. Shared by all blocks of a build.
 */
export const MAX_CONNECTIONS_PER_HOST = 6;
const hostSlots = new Map<string, { active: number; queue: (() => void)[] }>();

async function withHostSlot<T>(url: string, task: () => Promise<T>): Promise<T> {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    return task();
  }
  let slot = hostSlots.get(host);
  if (!slot) {
    slot = { active: 0, queue: [] };
    hostSlots.set(host, slot);
  }
  const current = slot;
  if (current.active >= MAX_CONNECTIONS_PER_HOST) {
    await new Promise<void>((resolve) => current.queue.push(resolve));
  } else {
    current.active++;
  }
  try {
    return await task();
  } finally {
    const next = current.queue.shift();
    if (next) {
      next(); // hand the slot over directly
    } else {
      current.active--;
      if (current.active === 0) hostSlots.delete(host);
    }
  }
}

/**
 * Mirrors `requestUrl` from the Obsidian API: resolves with the body in
 * several shapes and, like Obsidian, rejects on HTTP status >= 400 unless
 * `throw: false` is passed.
 */
export function createRequestUrl(timeoutMs: number) {
  return async function requestUrl(request: string | RequestUrlParam): Promise<RequestUrlResponse> {
    const param: RequestUrlParam = typeof request === "string" ? { url: request } : request;
    const headers: Record<string, string> = { ...(param.headers ?? {}) };
    if (param.contentType) headers["Content-Type"] = param.contentType;

    let res: Response;
    let arrayBuffer: ArrayBuffer;
    try {
      [res, arrayBuffer] = await withHostSlot(param.url, async () => {
        // The timeout starts once a slot is free, so queueing does not eat it up.
        const response = await fetch(param.url, {
          method: param.method ?? "GET",
          headers,
          body: param.body,
          signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
        });
        return [response, await response.arrayBuffer()] as const;
      });
    } catch (err) {
      const cause = (err as { cause?: { code?: string } }).cause?.code;
      warn(`requestUrl ${param.url} failed: ${String(err)}${cause ? ` (${cause})` : ""}`);
      throw err;
    }

    if (res.status >= 400) {
      // Scripts usually swallow errors with try/catch, so without this the
      // build log would not say why a block rendered without data.
      const challenge = res.headers.get("cf-mitigated") === "challenge";
      warn(
        `requestUrl ${param.url} answered HTTP ${res.status}` +
          (challenge ? " (Cloudflare bot challenge: the site blocks non-browser clients)" : ""),
      );
      if (param.throw !== false) {
        throw Object.assign(new Error(`Request failed, status ${res.status}`), {
          status: res.status,
        });
      }
    }

    const text = new TextDecoder().decode(arrayBuffer);
    return {
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      arrayBuffer,
      text,
      get json(): unknown {
        return JSON.parse(text);
      },
    };
  };
}

/** The module returned by `require("obsidian")` inside a script. */
export function createObsidianModule(timeoutMs: number) {
  const requestUrl = createRequestUrl(timeoutMs);
  return {
    requestUrl,
    request: async (request: string | RequestUrlParam): Promise<string> =>
      (await requestUrl(request)).text,
  };
}

/**
 * Obsidian extends a few built-in prototypes (`"abc".contains("b")`,
 * `[1, 2].last()`, ...). This source is evaluated inside the script's own VM
 * context, so the build process' own built-ins stay untouched.
 */
export const OBSIDIAN_GLOBALS_SOURCE = `
(() => {
  const def = (target, name, value) => {
    if (name in target) return;
    Object.defineProperty(target, name, { value, writable: true, configurable: true });
  };
  def(String.prototype, "contains", function (target) { return this.includes(target); });
  def(String.prototype, "format", function (...args) {
    return this.replace(/{(\\d+)}/g, (match, i) => (args[i] !== undefined ? String(args[i]) : match));
  });
  def(Array.prototype, "contains", function (target) { return this.includes(target); });
  def(Array.prototype, "first", function () { return this[0]; });
  def(Array.prototype, "last", function () { return this[this.length - 1]; });
  def(Array.prototype, "remove", function (target) {
    for (let i = this.length - 1; i >= 0; i--) if (this[i] === target) this.splice(i, 1);
  });
  def(Array.prototype, "unique", function () { return Array.from(new Set(this)); });
  def(Math, "clamp", (value, min, max) => Math.min(Math.max(value, min), max));
  def(Math, "square", (value) => value * value);
  def(String, "isString", (value) => typeof value === "string");
  def(Number, "isNumber", (value) => typeof value === "number");
  def(Object, "isEmpty", (object) => {
    for (const key in object) if (Object.prototype.hasOwnProperty.call(object, key)) return false;
    return true;
  });
})();
`;
