import type { QuartzTransformerPlugin } from "@quartz-community/types"
import type { Node, Parent } from "unist"
import { visit } from "unist-util-visit"
import { DOMParser } from "linkedom"

// Definiere (leere) Optionen, falls das Plugin später über die quartz.config.yaml konfigurierbar sein soll
export interface DataviewJSOptions {
  // z.B. timeoutMs?: number
}

// Factory Pattern (Astro-style)
export const DataviewJS: QuartzTransformerPlugin<DataviewJSOptions | void> = (opts) => {
  return {
    name: "DataviewJS",
    markdownPlugins() {
      // Remark/Unified Plugin als Return
      return [
        () => {
          return async (tree: Parent, file) => {
            const promises: Promise<void>[] = []

            visit(tree, "code", (node: any, index, parent) => {
              if (node.lang === "dataviewjs") {
                promises.push(
                  (async () => {
                    try {
                      const generatedNodes: Node[] = []

                      // Mock Obsidian 'dv' API
                      const dv = {
                        header: (level: number, text: string) => {
                          generatedNodes.push({
                            type: "heading",
                            depth: level,
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

                      // Mock Obsidian 'requestUrl' API
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

                      // Async Ausführung in isoliertem Scope
                      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
                      const executor = new AsyncFunction("dv", "require", "DOMParser", node.value)
                      await executor(dv, mockRequire, DOMParser)

                      // AST-Manipulation: Ersetze Dataview-Codeblock mit den neuen Nodes
                      if (parent && index !== undefined) {
                        parent.children.splice(index, 1, ...generatedNodes)
                      }
                    } catch (err) {
                      console.error(`[DataviewJS] Error in file ${file.data?.slug}:`, err)
                      if (parent && index !== undefined) {
                        parent.children.splice(index, 1, {
                          type: "html",
                          value: `<div class="dataviewjs-error">DataviewJS Render Error: ${err}</div>`
                        })
                      }
                    }
                  })()
                )
              }
            })

            // Warten bis alle asynchronen Dataview-Scripts in der Datei geparst wurden
            await Promise.all(promises)
          }
        }
      ]
    }
  }
}