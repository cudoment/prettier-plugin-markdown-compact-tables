# prettier-plugin-markdown-compact-tables

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Prettier 3.5+](https://img.shields.io/badge/prettier-3.5%2B-1A2B34?logo=prettier&logoColor=F7B93E)](https://prettier.io) [![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)

**English** | [한국어](./README.ko.md)

A [Prettier](https://prettier.io) plugin that prints Markdown and MDX tables in a compact form, without alignment padding. It hooks into Prettier 3's `markdown` and `mdx` parsers.

Pipes are surrounded by exactly one space, and cells are never padded to match column widths.

## Contents

- [Why](#why)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running it](#running-it)
- [Table compaction](#table-compaction)
- [Companion plugin](#companion-plugin)
- [Compatibility](#compatibility)
- [Development](#development)
- [License](#license)

## Why

Prettier's built-in Markdown printer pads every cell to its column width whenever the table fits within `printWidth`. Only a table that overflows the limit is printed in a compact form. In a documentation project that raises `printWidth` so prose is never wrapped, that means **every table gets alignment padding.**

When a table packs several lines into one cell with `<br />`, mixing lists and code, that single cell decides the width of the whole table. In the table below only the `send_mode` description is long: `title` and `is_public` are barely a few words.

**What you write**

<!-- prettier-ignore -->
```md
| Name | Type | Description | Required |
| --- | --- | --- | --- |
| title | `String` | Notification title | O |
| send_mode | `Integer` | Delivery mode<br />- `0`: send immediately<br />- `1`: schedule for later<br />--set the time with `send_at`<br />- `2`: do not send<br />**Note**: defaults to `0` when omitted | X |
| is_public | `Boolean` | Whether the notice is public | X |
```

**What the default printer produces**

<!-- prettier-ignore -->
```md
| Name      | Type      | Description                                                                                                                                                                      | Required |
| --------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| title     | `String`  | Notification title                                                                                                                                                               | O        |
| send_mode | `Integer` | Delivery mode<br />- `0`: send immediately<br />- `1`: schedule for later<br />--set the time with `send_at`<br />- `2`: do not send<br />**Note**: defaults to `0` when omitted | X        |
| is_public | `Boolean` | Whether the notice is public                                                                                                                                                     | X        |
```

The description cells of `title` and `is_public` are padded out to the width of the `send_mode` description.

**What this plugin produces**

<!-- prettier-ignore -->
```md
| Name | Type | Description | Required |
| --- | --- | --- | --- |
| title | `String` | Notification title | O |
| send_mode | `Integer` | Delivery mode<br />- `0`: send immediately<br />- `1`: schedule for later<br />--set the time with `send_at`<br />- `2`: do not send<br />**Note**: defaults to `0` when omitted | X |
| is_public | `Boolean` | Whether the notice is public | X |
```

**Line lengths**

| Line | Default printer | This plugin |
| --- | --- | --- |
| Header | 215 chars | 40 chars |
| Delimiter | 215 chars | 25 chars |
| `title` row | 215 chars | 45 chars |
| `send_mode` row | 215 chars | 208 chars |
| `is_public` row | 215 chars | 60 chars |

Not a single character of content was added, yet the short lines grew three to nine times longer, and every added position is a space.

It also affects review. Adding one sentence to the `send_mode` description recomputes the column widths, so with the default printer **all five lines of the table show up in the diff.** With this plugin, only the line you actually edited does.

## Requirements

| Item | Version |
| --- | --- |
| Node.js | 18 or later |
| Prettier | 3.5.3 or later |

Every Prettier 3 release from 3.5.3 onward is covered by the test suite. See [Compatibility](#compatibility).

## Installation

Install it as a dev dependency alongside Prettier.

```sh
# npm
npm install --save-dev prettier prettier-plugin-markdown-compact-tables

# yarn
yarn add --dev prettier prettier-plugin-markdown-compact-tables

# pnpm
pnpm add --save-dev prettier prettier-plugin-markdown-compact-tables
```

The plugin is ESM-only and cannot be loaded through `require()`. Prettier 3's plugin loader handles ESM directly, so naming it in the configuration file is all that is needed.

## Configuration

Add the package name to `plugins` in your [Prettier configuration](https://prettier.io/docs/configuration).

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables"]
}
```

To vendor the plugin inside your repository instead of installing it, point at the file.

```json
{
  "plugins": ["./tools/prettier-plugin-markdown-compact-tables/index.js"]
}
```

### Recommended setup

The plugin compacts tables regardless of `printWidth`, so you never have to tune `printWidth` for the sake of tables. The options below concern the prose around them. Applying them through `overrides` keeps the rest of the repository on your usual formatting.

| Option | Recommended value | Why |
| --- | --- | --- |
| `parser` | `"markdown"` for `.md`, `"mdx"` for `.mdx` | Prettier already infers it from the extension, but stating it makes the override self-explanatory |
| `proseWrap` | `"never"` | Keeps each paragraph on a single line, so editing one word produces a one-line diff |
| `printWidth` | `99999` | Stops that single line from being folded again. It has no effect on how tables are printed |

**Using Markdown**

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables"],
  "overrides": [
    {
      "files": "*.md",
      "options": {
        "parser": "markdown",
        "printWidth": 99999,
        "proseWrap": "never"
      }
    }
  ]
}
```

**Using MDX**

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables"],
  "overrides": [
    {
      "files": "*.mdx",
      "options": {
        "parser": "mdx",
        "printWidth": 99999,
        "proseWrap": "never"
      }
    }
  ]
}
```

A project that carries both formats lists both entries in `overrides`.

## Running it

```sh
# format everything
npx prettier --write .

# format documents only
npx prettier --write "**/*.{md,mdx}"

# check whether anything needs formatting
npx prettier --check "**/*.{md,mdx}"
```

To format on save, follow the [Prettier editor integration guide](https://prettier.io/docs/editors). In VS Code, install the [Prettier extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) and add:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "prettier.documentSelectors": ["**/*.mdx"]
}
```

## Table compaction

Table compaction has no option of its own: registering the plugin turns it on.

### Rules applied

| Target | Behavior |
| --- | --- |
| Spaces around pipes | Fixed at one space; no padding is added to match column widths |
| Repeated spaces inside a cell | Collapsed to a single space |
| Unicode spaces in a cell | NBSP and ideographic space are content, so they are kept as written |
| Trailing space in a cell | Removed |
| Alignment markers | `:--`, `:-:` and `--:` are preserved as written |

Line-break tags and the wording inside a cell are left as written. Correcting those is a separate concern, handled by the [companion plugin](#companion-plugin).

### What is left untouched

Preserving the source beats correcting it automatically and breaking the table structure. The plugin does not touch:

- the contents of inline code, where spacing and tag spelling stay exactly as written
- pipe lines that are not read as a table because the delimiter row is missing
- tables whose rows do not match the header's column count
- tables inside an MDX comment, `{/* ... */}`
- MDX/JSX elements that contain a fenced code block

## Companion plugin

This plugin only decides how a table is printed. It never rewrites the words inside a cell.

Correcting spellings, or unifying a notation such as `<br>` versus `<br />`, is what [`prettier-plugin-markdown-replacements`](https://github.com/cspidar/prettier-plugin-markdown-replacements) is for. The two are independent: either works on its own, and they can be used together.

Prettier resolves one parser per language, and both plugins contribute one, so **the replacements plugin has to be listed last.** Listed first, its rules are silently skipped.

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables", "prettier-plugin-markdown-replacements"],
  "markdownReplacements": ["Javascript=>JavaScript"]
}
```

## Compatibility

| Prettier | Status |
| --- | --- |
| 3.5.3 ~ 3.9.x | Supported. All 67 tests pass on 3.5.3, 3.6.2, 3.7.4, 3.8.1, 3.9.0 and 3.9.6 |

Prettier 3.9 changed `tableCell` positions to cover the surrounding pipes, which the plugin accounts for. The two versions produce byte-identical output: formatting a corpus of 517 real documents with 3.8.1 and with 3.9.6 gives the same result for every file.

Both of Prettier's built-in parsers, `markdown` and `mdx`, are supported. The plugin wraps the printer of the built-in Markdown plugin, so anything unrelated to tables follows Prettier's default behavior.

## Development

```sh
# install dependencies
npm install

# run the tests once
npm run test:run

# run the tests in watch mode
npm test

# format this repository's own documents
npm run format
```

The tests are written with [Vitest](https://vitest.dev) and live in `__tests__/`. The MDX fragments under `__tests__/fixtures/` come from real documents and serve as evidence that table structures survive formatting.

## License

[MIT](./LICENSE)
