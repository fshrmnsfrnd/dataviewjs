import { describe, expect, it, vi } from "vitest";
import type { Root } from "mdast";
import type { BuildCtx } from "@quartz-community/types";
import { VFile } from "vfile";
import { DataviewJS } from "../src/index";

describe("DataviewJS", () => {
  it("renders headings and paragraphs from dataviewjs blocks", async () => {
    const transformer = DataviewJS({});
    const plugin = transformer.markdownPlugins?.({} as BuildCtx)[0];
    if (!plugin) throw new Error("Expected a markdown plugin");

    const tree: Root = {
      type: "root",
      children: [
        {
          type: "code",
          lang: "dataviewjs",
          value: 'dv.header(2, "Tasks"); dv.paragraph("Done")',
        },
      ],
    };
    const transformerPlugin = plugin as () => (tree: Root, file: VFile) => Promise<void>;
    await transformerPlugin()(tree, new VFile());

    expect(tree.children).toEqual([
      {
        type: "heading",
        depth: 2,
        children: [{ type: "text", value: "Tasks" }],
      },
      {
        type: "paragraph",
        children: [{ type: "text", value: "Done" }],
      },
    ]);
  });

  it("renders an error node when a block fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const transformer = DataviewJS({});
    const plugin = transformer.markdownPlugins?.({} as BuildCtx)[0];
    if (!plugin) throw new Error("Expected a markdown plugin");

    const tree: Root = {
      type: "root",
      children: [{ type: "code", lang: "dataviewjs", value: "throw new Error('boom')" }],
    };
    const transformerPlugin = plugin as () => (tree: Root, file: VFile) => Promise<void>;
    await transformerPlugin()(tree, new VFile());

    const errorNode = tree.children[0];
    expect(errorNode).toMatchObject({ type: "html" });
    if (errorNode?.type === "html") {
      expect(errorNode.value).toContain("DataviewJS Render Error");
    }
    error.mockRestore();
  });
});
