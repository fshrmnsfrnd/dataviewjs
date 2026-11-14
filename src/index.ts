import type { QuartzTransformerPlugin } from "@quartz-community/types"
import type { Parent } from "unist"
import type { Root, Code, BlockContent, HTML } from "mdast"
import type { VFile } from "vfile"
import { visit } from "unist-util-visit"
import { DOMParser } from "linkedom"

// 1. Linter-konformes require (ohne any)
declare const require: (id: string) => unknown;

export interface DataviewJSOptions extends Record<string, unknown> {}

export const DataviewJS: QuartzTransformerPlugin<DataviewJSOptions> = (_opts) => {
  return {
    name: "DataviewJS",
    markdownPlugins() {
      return [
        () => {
          // 2. file als VFile typisiert (ohne any)
          return async (tree: Root, file: VFile) => {
            const promises: Promise<void>[] = []

            visit(tree, "code", (node: Code, index: number | undefined, parent: Parent | undefined) => {
              if (node.lang === "dataviewjs") {
                promises.push(
                  (async () => {
                    try {
                      const generatedNodes: BlockContent[] = []

                      const dv = {
                        header: (level: number, text: string) => {
                          const depth = Math.min(Math.max(level, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6
                          generatedNodes.push({
                            type: "heading",
                            depth,
                            children: [{ type: "text", value: String(text) }],
                          })
                        },
                        paragraph: (text: string) => {
                          generatedNodes.push({
                            type: "paragraph",
                            children: [{ type: "text", value: String(text) }],
                          })
                        }
                      };

                      const mockRequire = (id: string) => {
                        if (id === "obsidian") {
                          return {
                            // 3. args strikt typisiert für Obsidian's requestUrl (ohne any)
                            requestUrl: async (args: string | { url: string; [key: string]: unknown }) => {
                              const url = typeof args === "string" ? args : args.url;
                              // Wir übergeben das Objekt sicher an die native fetch API weiter
                              const fetchOpts = typeof args === "string" ? undefined : (args as RequestInit);
                              
                              const res = await fetch(url, fetchOpts);
                              const text = await res.text();
                              return { text, status: res.status };
                            },
                          }
                        }
                        return require(id)
                      };

                      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
                      const executor = new AsyncFunction("dv", "require", "DOMParser", node.value);
                      await executor(dv, mockRequire, DOMParser);

                      if (parent && index !== undefined) {
                        (parent as Parent).children.splice(index, 1, ...generatedNodes);
                      }
                    } catch (err) {
                      const slug = file.data?.slug ?? "unknown";
                      console.error(`[DataviewJS] Error in file ${String(slug)}:`, err)
                      if (parent && index !== undefined) {
                        const errorNode: HTML = {
                          type: "html",
                          value: `<div class="dataviewjs-error" style="color: red; border: 1px solid red; padding: 10px;">DataviewJS Render Error: ${String(err)}</div>`
                        };
                        
                        (parent as Parent).children.splice(index, 1, errorNode);
                      }
                    }
                  })()
                )
              }
            })

            await Promise.all(promises)
          }
        }
      ]
    }
  }
}