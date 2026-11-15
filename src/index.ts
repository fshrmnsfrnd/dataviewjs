import { createRequire as createNodeRequire } from "node:module";
import vm from "node:vm";
import type { QuartzTransformerPlugin } from "@quartz-community/types";
import type { Code, Parent, Root, RootContent } from "mdast";
import type { Processor } from "unified";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";
import { DOMParser as LinkedomDOMParser } from "linkedom";
import { createDv, h, type MarkdownParser } from "./dv";
import { createObsidianModule, OBSIDIAN_GLOBALS_SOURCE } from "./obsidian";
import { styles } from "./styles";

export interface DataviewJSOptions {
  /**
   * Milliseconds after which a `requestUrl()` call made by a script is
   * aborted, so a slow server cannot hang the build. `0` disables the limit.
   */
  requestTimeout?: number;
}

const defaultOptions: Required<DataviewJSOptions> = {
  requestTimeout: 15000,
};

const nodeRequire = createNodeRequire(import.meta.url);

/**
 * linkedom only fills `document.body` when the markup has an `<html>` root,
 * while a browser's DOMParser always creates one. Wrap fragments so scripts
 * written against the browser behave the same.
 */
class DOMParser {
  parseFromString(markup: string, mimeType: "text/html" | "image/svg+xml" | "text/xml") {
    const wrapped =
      mimeType === "text/html" && !/<html[\s>]/i.test(markup)
        ? `<!DOCTYPE html><html><head></head><body>${markup}</body></html>`
        : markup;
    return new LinkedomDOMParser().parseFromString(wrapped, mimeType);
  }
}

const stripPositions = (node: { position?: unknown; children?: unknown[] }): void => {
  delete node.position;
  for (const child of node.children ?? []) stripPositions(child as typeof node);
};

/**
 * Dataview renders every string it is given as markdown. Reuse the processor
 * Quartz is running, so the same syntax extensions apply to generated text.
 */
function createMarkdownParser(processor: Processor | undefined): MarkdownParser {
  return (text) => {
    if (text === "") return [];
    try {
      if (!processor) throw new Error("no processor");
      const root = processor.parse(text) as Root;
      stripPositions(root);
      const only = root.children.length === 1 ? root.children[0] : undefined;
      return only?.type === "paragraph" ? only.children : root.children;
    } catch {
      return [{ type: "text", value: text }];
    }
  };
}

async function runScript(
  source: string,
  filename: string,
  parseMarkdown: MarkdownParser,
  opts: Required<DataviewJSOptions>,
): Promise<RootContent[]> {
  const output: RootContent[] = [];
  const dv = createDv(parseMarkdown, output);
  const obsidian = createObsidianModule(opts.requestTimeout);

  // A separate context gives the script its own String/Array prototypes, so
  // Obsidian's prototype extensions never leak into the Quartz build process.
  const context = vm.createContext({
    dv,
    dataview: dv,
    require: (id: string) => (id === "obsidian" ? obsidian : nodeRequire(id)),
    DOMParser,
    console,
    fetch,
    Headers,
    Request,
    Response,
    URL,
    URLSearchParams,
    AbortController,
    AbortSignal,
    TextDecoder,
    TextEncoder,
    structuredClone,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    atob,
    btoa,
  });
  vm.runInContext(OBSIDIAN_GLOBALS_SOURCE, context);
  await vm.runInContext(`(async () => {\n${source}\n})()`, context, {
    filename,
    lineOffset: -1,
  });
  return output;
}

export const DataviewJS: QuartzTransformerPlugin<DataviewJSOptions> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts };
  return {
    name: "DataviewJS",
    markdownPlugins() {
      return [
        function (this: Processor | undefined) {
          const parseMarkdown = createMarkdownParser(
            typeof this?.parse === "function" ? this : undefined,
          );

          return async (tree: Root, file: VFile) => {
            const blocks: { node: Code; parent: Parent }[] = [];
            visit(tree, "code", (node: Code, _index, parent: Parent | undefined) => {
              if (node.lang === "dataviewjs" && parent) blocks.push({ node, parent });
            });

            await Promise.all(
              blocks.map(async ({ node, parent }) => {
                const name = String(file.data?.slug ?? file.path ?? "unknown");
                let children: RootContent[];
                try {
                  children = await runScript(node.value, `dataviewjs:${name}`, parseMarkdown, opts);
                } catch (err) {
                  console.error(`[DataviewJS] Error in file ${name}:`, err);
                  children = [
                    h("pre", { className: ["dataview", "dataview-error"] }, [
                      { type: "text", value: `Evaluation Error: ${String(err)}` },
                    ]),
                  ];
                }
                // Same wrapper Obsidian puts around a rendered dataviewjs block.
                const block = h("div", { className: ["block-language-dataviewjs"] }, children);
                parent.children.splice(parent.children.indexOf(node), 1, block);
              }),
            );
          };
        },
      ];
    },
    externalResources() {
      return { css: [{ content: styles, inline: true }] };
    },
  };
};
