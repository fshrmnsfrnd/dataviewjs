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

    const res = await fetch(param.url, {
      method: param.method ?? "GET",
      headers,
      body: param.body,
      signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    const arrayBuffer = await res.arrayBuffer();

    if (res.status >= 400 && param.throw !== false) {
      throw Object.assign(new Error(`Request failed, status ${res.status}`), {
        status: res.status,
      });
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
