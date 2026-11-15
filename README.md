# DataviewJS

Quartz transformer that executes `dataviewjs` code blocks during the build.

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
```

The transformer exposes a small `dv` API inside `dataviewjs` blocks:

```dataviewjs
dv.header(2, "Tasks")
dv.paragraph("Generated during the Quartz build.")
```

`require("obsidian").requestUrl(...)` is supported through the native `fetch` API.
Errors are logged and rendered in the generated page.

## Development

```bash
npm install
npm run check
npm run build
```
