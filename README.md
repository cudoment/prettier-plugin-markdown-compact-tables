# prettier-plugin-markdown-compact-tables

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Prettier 3.5 ~ 3.8](https://img.shields.io/badge/prettier-3.5%20~%203.8-1A2B34?logo=prettier&logoColor=F7B93E)](https://prettier.io) [![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)

**English** | [한국어](./README.ko.md)

A [Prettier](https://prettier.io) plugin that prints Markdown and MDX tables in a compact form, without alignment padding. It hooks into Prettier 3's `markdown` and `mdx` parsers and does two things.

- **Compact tables**: pipes are surrounded by exactly one space, and cells are never padded to match column widths.
- **Text replacements**: register the spellings you keep getting wrong, as literal strings or regular expressions, and they are corrected on save.

## Contents

- [Why](#why)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running it](#running-it)
- [Table compaction](#table-compaction)
- [Text replacements](#text-replacements)
- [Options](#options)
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

Not a single character of content was added, yet the short lines grew more than fourfold, and every added position is a space.

It also affects review. Adding one sentence to the `send_mode` description recomputes the column widths, so with the default printer **all five lines of the table show up in the diff.** With this plugin, only the line you actually edited does.

## Requirements

| Item | Version |
| --- | --- |
| Node.js | 18 or later |
| Prettier | >= 3.5.3 and < 3.9.0 |

Prettier 3.9 and later print tables incorrectly with this plugin. See [Compatibility](#compatibility).

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

The plugin compacts tables regardless of `printWidth`, so you never have to tune `printWidth` for the sake of tables. If you also want prose left unwrapped, apply the following to Markdown and MDX only.

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables"],
  "compactTablesReplacements": ["Javascript=>JavaScript", "Github=>GitHub"],
  "overrides": [
    {
      "files": "*.md",
      "options": {
        "parser": "markdown",
        "printWidth": 99999,
        "proseWrap": "never"
      }
    },
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

`proseWrap: "never"` keeps each paragraph on a single line. The large `printWidth` only stops that line from being folded again; it has no effect on how tables are printed.

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
| Trailing space in a cell | Removed |
| Alignment markers | `:--`, `:-:` and `--:` are preserved as written |
| Line-break tags inside a cell | Normalized to `<br />` regardless of how they were written |

`<br>`, `<br/>`, `<BR>` and `<br >` all become `<br />`.

### What is left untouched

Preserving the source beats correcting it automatically and breaking the table structure. The plugin does not touch:

- the contents of inline code, where spacing and tag spelling stay exactly as written
- pipe lines that are not read as a table because the delimiter row is missing
- tables whose rows do not match the header's column count
- tables inside an MDX comment, `{/* ... */}`
- MDX/JSX elements that contain a fenced code block

## Text replacements

Register the spellings you keep getting wrong in `compactTablesReplacements` and they are corrected on save. The default is empty, so nothing is replaced until you add a rule.

**Configuration**

<!-- prettier-ignore -->
```json
{
  "compactTablesReplacements": ["Javascript=>JavaScript", "Github=>GitHub"]
}
```

**Before**

<!-- prettier-ignore -->
```md
Send a Javascript request from Github.

| Field | Description |
| --- | --- |
| `Javascript` | Javascript runtime |
```

**After**

<!-- prettier-ignore -->
```md
Send a JavaScript request from GitHub.

| Field | Description |
| --- | --- |
| `Javascript` | JavaScript runtime |
```

Prose in the body and in table cells is corrected, while anything wrapped in code markup keeps its original spelling.

### Rule formats

| Format | Example | Behavior |
| --- | --- | --- |
| Literal | `Javascript=>JavaScript` | Compared as a plain string and replaced at every occurrence |
| Regular expression | `/Max ([0-9]+)/g=>Maximum: $1` | Written as `/pattern/flags`, with capture references such as `$1` available |

With the regular expression above, `Max 50` becomes `Maximum: 50`. The `g` flag is added automatically when omitted, so every occurrence is replaced.

### Notes for both formats

- Inline code, code blocks and MDX comments are never replaced. Wrap a string that must survive verbatim, such as a value an API really returns, in code markup and it is protected.
- Nothing is trimmed, so leading and trailing spaces are part of the rule.
- The separator is the first `=>` in a literal rule, and the `=>` after the flags in a regular expression rule. The replacement itself may contain `=>`.
- Rules are applied in array order, and the output of one rule is the input of the next.
- An entry without a separator, with an empty left side, or with an invalid regular expression is ignored. An entry that starts with `/` but is not a valid regular expression is treated as a literal rule, so a path rewrite such as `/docs/guide=>/docs/tutorial` works as expected.
- Regular expressions run per paragraph and per cell, so keep them narrow. A broad pattern such as `/[A-Za-z_]+/` would also match the internal placeholders used to protect code, so replacement is skipped for that paragraph.

### Always applied

Independently of the option, an escaped bracket `\[` is turned back into `[`. This correction also skips inline code, code blocks and MDX comments.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `compactTablesReplacements` | `string[]` | `[]` | Text replacements applied outside code spans, code blocks and MDX comments. Use `"from=>to"` for a literal rule or `"/pattern/flags=>to"` for a regular expression |

It is available on the command line as well.

```sh
npx prettier --write "**/*.md" --compact-tables-replacements "Javascript=>JavaScript"
```

## Compatibility

| Prettier | Status |
| --- | --- |
| 3.5.3 ~ 3.8.x | Supported. All 73 tests pass |
| 3.9.0 and later | Not supported. Table output is malformed |

`peerDependencies` is declared as `>=3.5.3 <3.9.0`, so package managers warn about an unsupported combination.

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
