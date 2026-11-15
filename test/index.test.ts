import { afterEach, describe, expect, it, vi } from "vitest";
import type { BuildCtx } from "@quartz-community/types";
import { unified, type PluggableList } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { DataviewJS } from "../src/index";

async function render(markdown: string, options = {}): Promise<string> {
  const plugins = DataviewJS(options).markdownPlugins?.({} as BuildCtx) as PluggableList;
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(plugins)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);
  return String(file);
}

const block = (code: string): string => "```dataviewjs\n" + code + "\n```";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DataviewJS", () => {
  it("renders headers and paragraphs with the markup Dataview produces in Obsidian", async () => {
    const html = await render(block('dv.header(2, "Tasks"); dv.paragraph("Done")'));

    expect(html).toBe(
      '<div class="block-language-dataviewjs">' +
        "<h2><span>Tasks</span></h2>" +
        "<p><span>Done</span></p>" +
        "</div>",
    );
  });

  it("renders text as markdown, like Dataview does", async () => {
    const html = await render(block('dv.paragraph("**bold** and ~~gone~~")'));

    expect(html).toContain("<p><span><strong>bold</strong> and <del>gone</del></span></p>");
  });

  it("supports cls/attr options, lists and tables", async () => {
    const html = await render(
      block(
        [
          'dv.el("b", "x", { cls: "one two", attr: { id: "y" } });',
          'dv.list(["a", 2]);',
          'dv.table(["Name", "Lifte"], [["Axams", 9], ["Garmisch", null]]);',
        ].join("\n"),
      ),
    );

    expect(html).toContain('<b id="y" class="one two"><span>x</span></b>');
    expect(html).toContain('<ul class="dataview list-view-ul">');
    expect(html).toContain("<li><span>2</span></li>");
    expect(html).toContain('<table class="dataview table-view-table">');
    expect(html).toContain('<span>Name</span><span class="dataview small-text">2</span>');
    expect(html).toContain("<td><span>-</span></td>");
  });

  it("provides Obsidian's prototype extensions without touching the build's own globals", async () => {
    const html = await render(
      block('dv.paragraph(String("Fehler!".contains("Fehler")) + " " + [1, 2, 3].last())'),
    );

    expect(html).toContain("<p><span>true 3</span></p>");
    expect("contains" in String.prototype).toBe(false);
    expect("last" in Array.prototype).toBe(false);
  });

  it("keeps the rest of the page and replaces several blocks in place", async () => {
    const html = await render(
      ["# Title", block('dv.span("one")'), "between", block('dv.span("two")')].join("\n\n"),
    );

    expect(html.indexOf("<h1>Title</h1>")).toBeLessThan(html.indexOf("one"));
    expect(html.indexOf("one")).toBeLessThan(html.indexOf("<p>between</p>"));
    expect(html.indexOf("<p>between</p>")).toBeLessThan(html.indexOf("two"));
    expect(html).not.toContain("<code");
  });

  it("renders a Dataview-style error box when a block fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = await render(block("throw new Error('boom')"));

    expect(html).toContain(
      '<pre class="dataview dataview-error">Evaluation Error: Error: boom</pre>',
    );
    expect(error).toHaveBeenCalled();
  });

  it("explains that vault queries are not available", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const html = await render(block('dv.pages("#tag")'));

    expect(html).toContain("dv.pages is not supported");
  });

  it("runs a script that scrapes pages with requestUrl and DOMParser", async () => {
    const pages: Record<string, string> = {
      "https://example.test/axams/":
        "<html><body><div>Offene Lifte <b>3</b> von 9</div><p>Berg: 120 cm</p><p>Tal 35 cm</p></body></html>",
      "https://example.test/fragment/": "<div>Offene Lifte: 1/4</div>",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url in pages
          ? new Response(pages[url], { status: 200 })
          : new Response("blocked", { status: 403 }),
      ),
    );

    const html = await render(
      block(`
const { requestUrl } = require("obsidian");
const gebiete = [
  { name: "Axams", url: "https://example.test/axams/" },
  { name: "Fragment", url: "https://example.test/fragment/" },
  { name: "Gesperrt", url: "https://example.test/blocked/" },
];
const ergebnisse = await Promise.all(
  gebiete.map(async (g) => {
    try {
      const res = await requestUrl({ url: g.url });
      const doc = new DOMParser().parseFromString(res.text, "text/html").body.textContent;
      const m = doc.match(/Offene Lifte[\\s:]*(\\d+)\\s*(?:\\/|von)\\s*(\\d+)/i);
      const b = doc.match(/Berg[\\s:]*(\\d+)\\s*cm/i);
      const t = doc.match(/(?:Tal|Ort)[\\s:]*(\\d+)\\s*cm/i);
      return {
        name: g.name,
        lifte: \`Lifte: \${m ? m[1] + "/" + m[2] : "-/-"}\`,
        berg: \`Schnee Berg: \${b ? b[1] : "-"} cm\`,
        tal: \`Schnee Tal: \${t ? t[1] : "-"} cm\`
      };
    } catch {
      return { name: g.name, lifte: "Lifte: Fehler", berg: "Schnee: Fehler", tal: "" };
    }
  })
);
for (const e of ergebnisse) {
  if (e.name) dv.header(2, e.name);
  if (!e.lifte.contains("Fehler")) dv.paragraph(e.lifte);
  if (!e.berg.contains("Fehler")) dv.paragraph(e.berg);
  if (!e.tal.contains("Fehler")) dv.paragraph(e.tal);
}
`),
    );

    expect(html).toBe(
      '<div class="block-language-dataviewjs">' +
        [
          "<h2><span>Axams</span></h2>",
          "<p><span>Lifte: 3/9</span></p>",
          "<p><span>Schnee Berg: 120 cm</span></p>",
          "<p><span>Schnee Tal: 35 cm</span></p>",
          "<h2><span>Fragment</span></h2>",
          "<p><span>Lifte: 1/4</span></p>",
          "<p><span>Schnee Berg: - cm</span></p>",
          "<p><span>Schnee Tal: - cm</span></p>",
          // requestUrl rejects on HTTP 403 like in Obsidian, so the script's
          // own catch branch runs: header plus the empty "tal" paragraph.
          "<h2><span>Gesperrt</span></h2>",
          "<p><span></span></p>",
        ].join("") +
        "</div>",
    );
  });
});
