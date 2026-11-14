import type { QuartzTransformerPlugin } from "@quartz-community/types"
import type { Parent } from "unist"
import type { Code, BlockContent, HTML } from "mdast"
import { visit } from "unist-util-visit"
import { DOMParser } from "linkedom"

// 1. Saubere Typisierung für (spätere) Optionen, die dem Constraint entspricht
export interface DataviewJSOptions extends Record<string, unknown> {}

export const DataviewJS: QuartzTransformerPlugin<DataviewJSOptions> = (opts) => {
  return {
    name: "DataviewJS",
    markdownPlugins() {
      return [
        () => {
          return async (tree: Parent, file: any) => {
            const promises: Promise<void>[] = []

            // 2. Den "node" strikt als 'Code' (aus mdast) typisieren
            visit(tree, "code", (node: Code, index, parent) => {
              if (node.lang === "dataviewjs") {
                promises.push(
                  (async () => {
                    try {
                      // 3. Generierte Elemente strikt als 'BlockContent' typisieren
                      const generatedNodes: BlockContent[] = []

                      const dv = {
                        header: (level: number, text: string) => {
                          // mdast erlaubt für depth strikt nur 1, 2, 3, 4, 5, 6
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
                      }

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
                      }

                      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
                      const executor = new AsyncFunction("dv", "require", "DOMParser", node.value)
                      await executor(dv, mockRequire, DOMParser)

                      // 4. Austausch im Syntaxbaum
                      if (parent && index !== undefined) {
                        parent.children.splice(index, 1, ...generatedNodes)
                      }
                    } catch (err) {
                      console.error(`[DataviewJS] Error in file ${file.data?.slug}:`, err)
                      if (parent && index !== undefined) {
                        // Fehlermeldung als sauberen HTML-Node übergeben
                        const errorNode: HTML = {
                          type: "html",
                          value: `<div class="dataviewjs-error" style="color: red; border: 1px solid red; padding: 10px;">DataviewJS Render Error: ${err}</div>`
                        }
                        parent.children.splice(index, 1, errorNode)
                      }
                    }
                  })()
                )
              }
            })

            // Warten, bis alle Blöcke gerendert sind
            await Promise.all(promises)
          }
        }
      ]
    }
  }
}