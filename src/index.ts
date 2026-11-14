import type { QuartzTransformerPlugin } from "@quartz-community/types"
import type { Parent } from "unist"
import type { Root, Code, BlockContent, HTML } from "mdast"
import { visit } from "unist-util-visit"
import { DOMParser } from "linkedom"

// Deklariere require für TypeScript, falls Node-Types fehlen
declare const require: any;

export interface DataviewJSOptions extends Record<string, unknown> {}

export const DataviewJS: QuartzTransformerPlugin<DataviewJSOptions> = (_opts) => {
  return {
    name: "DataviewJS",
    markdownPlugins() {
      return [
        () => {
          return async (tree: Root, file: any) => {
            const promises: Promise<void>[] = []

            // Explizite Typen für index und parent hinzugefügt
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
                      }; // Semikolon hinzugefügt

                      const mockRequire = (id: string) => {
                        if (id === "obsidian") {
                          return {
                            requestUrl: async (args: any) => {
                              const url = typeof args === "string" ? args : args.url
                              const res = await fetch(url, args)
                              const text = await res.text()
                              return { text, status: res.status }
                            },
                          }
                        }
                        return require(id)
                      }; // Semikolon hinzugefügt

                      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
                      const executor = new AsyncFunction("dv", "require", "DOMParser", node.value);
                      await executor(dv, mockRequire, DOMParser);

                      if (parent && index !== undefined) {
                        (parent as Parent).children.splice(index, 1, ...generatedNodes);
                      }
                    } catch (err) {
                      console.error(`[DataviewJS] Error in file ${file.data?.slug}:`, err)
                      if (parent && index !== undefined) {
                        const errorNode: HTML = {
                          type: "html",
                          value: `<div class="dataviewjs-error" style="color: red; border: 1px solid red; padding: 10px;">DataviewJS Render Error: ${err}</div>`
                        }; // Semikolon hinzugefügt (Hier entstand der Callable-Fehler!)
                        
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