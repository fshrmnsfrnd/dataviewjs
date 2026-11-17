# Changelog

## 0.2.0

### Minor Changes

- 1717627: Render DataviewJS blocks with the same markup Dataview produces in Obsidian (`div.block-language-dataviewjs`, `<h2><span>…</span></h2>`, …), run scripts in their own context with Obsidian's prototype extensions (`"…".contains()`, `[].last()`, …), make `requestUrl` reject on HTTP errors like Obsidian does, render strings as markdown, and add `dv.el`, `dv.span`, `dv.list` and `dv.table`. Limit `requestUrl` to 6 parallel requests per host like Chromium, and log failed requests in the build output even when the script catches them.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial Quartz community plugin template.
