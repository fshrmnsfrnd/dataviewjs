# DataviewJS

Quartz transformer that executes `dataviewjs` code blocks during the build and renders them with
the same markup the Dataview plugin produces in Obsidian.

## Usage

Install the plugin into a Quartz v5 site:

```bash
npx quartz plugin add github:fshrmnsfrnd/dataviewjs
```

Register it in `quartz.config.yaml`:

```yaml
plugins:
  - source: github:fshrmnsfrnd/dataviewjs
    enabled: true
    options:
      requestTimeout: 15000
```

## Options

| Option           | Type     | Default | Description                                                                                         |
| ---------------- | -------- | ------- | --------------------------------------------------------------------------------------------------- |
| `requestTimeout` | `number` | `15000` | Milliseconds after which a `requestUrl()` call is aborted so it cannot hang the build. `0` = never. |

## What a block can use

```dataviewjs
const { requestUrl } = require("obsidian");
const res = await requestUrl({ url: "https://example.com/data.json" });
dv.header(2, "Result");
dv.paragraph(`**${res.json.value}** items`);
```

- **`dv` rendering API**: `dv.el`, `dv.header`, `dv.paragraph`, `dv.span`, `dv.list`, `dv.table`,
  including the `{ cls, attr }` options. Strings are rendered as markdown, like in Obsidian.
- **`require("obsidian")`**: `requestUrl` and `request`. As in Obsidian, `requestUrl` rejects on
  HTTP status >= 400 unless `throw: false` is passed, and the response has `status`, `headers`,
  `text`, `json` and `arrayBuffer`.
- **`DOMParser`** (via linkedom), `fetch`, `URL`, timers and `console`.
- **Obsidian's prototype extensions** such as `"text".contains("x")`, `[1, 2].first()`,
  `[1, 2].last()`, `Math.clamp()`. They only exist inside the script, not in the Quartz build.
- Top-level `await`.

The output is wrapped in `<div class="block-language-dataviewjs">`, and elements carry the same
classes as in Obsidian (`dataview table-view-table`, `dataview list-view-ul`, ...), so CSS snippets
written for Obsidian can be reused. Headers created with `dv.header` do not show up in the table of
contents, just as they are not part of the outline in Obsidian. A failing block renders a
`pre.dataview.dataview-error` box and logs the error; it does not fail the build.

## Limitations

- Scripts run **once, at build time**. "Live" data is a snapshot from the last build; rebuild on a
  schedule if it should stay fresh.
- Requests are made by Node, not by a Chromium browser as in Obsidian. Sites behind bot protection
  may answer `403` to the build even though the same request works in Obsidian.
- Vault queries (`dv.pages()`, `dv.current()`, `dv.query()`, ...) and DOM access (`dv.container`,
  `app`, `window`, `document`) are not available. Calling an unsupported `dv` function renders an
  error that names it.
- `dv.el` & co. return nothing instead of an `HTMLElement`.

## Development

```bash
npm install
npm run check
npm run build
```
