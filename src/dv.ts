import type { Parent, RootContent } from "mdast";

/**
 * A generic element node. `data.hName` / `data.hProperties` tell remark-rehype
 * which HTML element to emit, so the output needs no raw HTML and the nodes
 * are invisible to plugins that look for real markdown headings (e.g. the
 * table of contents) - just like DataviewJS output is not part of the outline
 * in Obsidian.
 */
export type DvProperties = Record<string, string | number | boolean | string[]>;

export interface DvElement extends Parent {
  type: "dataviewjs";
  data: { hName: string; hProperties?: DvProperties };
  children: RootContent[];
}

declare module "mdast" {
  interface RootContentMap {
    dataviewjs: DvElement;
  }
}

export interface DvElementOptions {
  cls?: string;
  attr?: Record<string, string>;
}

/** Turns a markdown string into mdast nodes (inline nodes if it is one line of text). */
export type MarkdownParser = (text: string) => RootContent[];

export function h(
  tag: string,
  properties: DvProperties | undefined,
  children: RootContent[],
): DvElement {
  return {
    type: "dataviewjs",
    data: properties ? { hName: tag, hProperties: properties } : { hName: tag },
    children,
  };
}

const classNames = (cls: string | undefined): string[] => (cls ? cls.split(/\s+/) : []);

const SUPPORTED = "dv.el, dv.header, dv.paragraph, dv.span, dv.list and dv.table";

/**
 * Creates the `dv` object handed to a script. It supports the rendering half
 * of the Dataview API and mirrors the markup the Dataview plugin produces in
 * Obsidian. Vault queries (`dv.pages()` & co.) are not available.
 */
export function createDv(parseMarkdown: MarkdownParser, output: RootContent[]) {
  const renderValue = (value: unknown): RootContent[] => {
    if (value === null || value === undefined) return [{ type: "text", value: "-" }];
    if (typeof value === "string") return parseMarkdown(value);
    if (Array.isArray(value)) {
      return [
        h(
          "ul",
          { className: ["dataview", "dataview-ul", "dataview-result-list-ul"] },
          value.map((item) =>
            h("li", { className: ["dataview-result-list-li"] }, renderValue(item)),
          ),
        ),
      ];
    }
    if (Object.prototype.toString.call(value) === "[object Object]") {
      return [{ type: "text", value: JSON.stringify(value) }];
    }
    return [{ type: "text", value: String(value) }];
  };

  const span = (value: unknown): DvElement => h("span", undefined, renderValue(value));

  const el = (tag: string, value: unknown, options: DvElementOptions = {}): void => {
    const properties: DvProperties = { ...(options.attr ?? {}) };
    const cls = classNames(options.cls);
    if (cls.length > 0) properties.className = cls;
    const hasProperties = Object.keys(properties).length > 0;
    output.push(h(tag, hasProperties ? properties : undefined, [span(value)]));
  };

  const api = {
    el,
    header: (level: number, text: unknown, options?: DvElementOptions): void => {
      const depth = Math.min(Math.max(Math.trunc(Number(level)) || 1, 1), 6);
      el(`h${depth}`, text, options);
    },
    paragraph: (text: unknown, options?: DvElementOptions): void => el("p", text, options),
    span: (text: unknown, options?: DvElementOptions): void => el("span", text, options),
    list: (values: Iterable<unknown> | null | undefined): void => {
      output.push(
        h(
          "ul",
          { className: ["dataview", "list-view-ul"] },
          Array.from(values ?? []).map((value) => h("li", undefined, [span(value)])),
        ),
      );
    },
    table: (headers: Iterable<unknown>, rows: Iterable<Iterable<unknown>> | null): void => {
      const body = Array.from(rows ?? []).map((row) => Array.from(row));
      const headerCells = Array.from(headers).map((header, i) => {
        const cell: RootContent[] = [span(header)];
        if (i === 0) {
          cell.push(
            h("span", { className: ["dataview", "small-text"] }, [
              { type: "text", value: String(body.length) },
            ]),
          );
        }
        return h("th", { className: ["table-view-th"] }, cell);
      });
      output.push(
        h("table", { className: ["dataview", "table-view-table"] }, [
          h("thead", { className: ["table-view-thead"] }, [
            h("tr", { className: ["table-view-tr-header"] }, headerCells),
          ]),
          h(
            "tbody",
            { className: ["table-view-tbody"] },
            body.map((row) =>
              h(
                "tr",
                undefined,
                row.map((value) => h("td", undefined, [span(value)])),
              ),
            ),
          ),
        ]),
      );
    },
  };

  // Anything else (dv.pages(), dv.current(), ...) needs Obsidian's vault index.
  // Fail with a clear message instead of "dv.pages is not a function".
  return new Proxy(api, {
    get(target, key, receiver) {
      if (typeof key === "symbol" || key in target || key === "then") {
        return Reflect.get(target, key, receiver);
      }
      return () => {
        throw new Error(
          `dv.${key} is not supported when rendering DataviewJS in Quartz (supported: ${SUPPORTED})`,
        );
      };
    },
  });
}
