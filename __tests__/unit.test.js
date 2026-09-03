import { describe, it, expect } from "vitest"
import {
  formatWithPlugin,
  expectIdempotent,
  expectNoLeakedPlaceholder,
} from "./helpers/test-utils.js"
import { unwrapTableCellRaw } from "../index.js"

describe("prettier-plugin-markdown-compact-tables unit behavior", () => {
  // The Prettier version this repository installs may not produce the wrapped
  // cell slice that 3.9 introduced, so the helper is called directly to cover
  // both shapes.
  describe("unwrapping a raw cell slice", () => {
    const cases = [
      ["slice as 3.5 through 3.8 report it", "A", "A"],
      ["first cell slice on 3.9", "| A ", "A"],
      ["last cell slice on 3.9", "| B |", "B"],
      ["trailing spaces past the closing pipe", "| 2 |   ", "2"],
      ["trailing tab past the closing pipe", "| 2 |\t", "2"],
      ["slice that is nothing but a pipe", "|", ""],
      ["cell ending in an escaped pipe", "| b\\| ", "b\\|"],
      ["escaped backslash before the closing pipe", "| b\\\\ |", "b\\\\"],
      ["leading NBSP is content, not padding", "|\u00a0x ", "\u00a0x"],
      ["leading ideographic space is content", "|\u3000x ", "\u3000x"],
      ["trailing NBSP is content", "| x\u00a0|", "x\u00a0"],
      ["empty cell", "|  |", ""],
      ["cell holding only an escaped pipe", "| \\| |", "\\|"],
    ]

    cases.forEach(([name, raw, expected]) => {
      it(name, () => {
        expect(unwrapTableCellRaw(raw)).toBe(expected)
      })
    })
  })

  describe("cell delimiters", () => {
    it("emits exactly one pipe per cell boundary", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| 1 | 2 |"
      )

      expect(result.trim()).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |")
    })

    it("keeps a cell that ends in an escaped pipe", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| 1 | b\\| |"
      )

      expect(result).toContain("| 1 | b\\| |")
    })

    it("treats the pipe after an escaped backslash as a delimiter", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| 1 | b\\\\|"
      )

      expect(result).toContain("| 1 | b\\\\ |")
    })

    it("keeps a cell whose only content is an escaped pipe", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| \\| | \\| |"
      )

      expect(result).toContain("| \\| | \\| |")
    })

    it("keeps an escaped pipe inside a code span", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| 1 | `a\\|b` |"
      )

      expect(result).toContain("`a\\|b`")
    })

    it("drops spaces left past the end of a row", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| 1 | 2 |   "
      )

      expect(result.trim()).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |")
    })

    it("drops spaces left past the end of the header", async () => {
      const result = await formatWithPlugin(
        "| A | B |  \n| --- | --- |\n| 1 | 2 |"
      )

      expect(result.trim()).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |")
    })

    it("keeps Unicode spaces at the start of a cell", async () => {
      // The printer always puts one ASCII space after the pipe, so the NBSP and
      // the ideographic space that follow it are cell content that survived.
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n|\u00a0x |\u3000y |"
      )

      expect(result).toContain("| \u00a0x | \u3000y |")
    })

    it("compacts a table written without outer pipes", async () => {
      const result = await formatWithPlugin("A | B\n--- | ---\n1 | 2")

      expect(result.trim()).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |")
    })

    it("compacts a table written without spaces around pipes", async () => {
      const result = await formatWithPlugin("|A|B|\n|---|---|\n|1|2|")

      expect(result.trim()).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |")
    })
  })

  describe("what the printer protects inside a cell", () => {
    it("keeps the spacing inside a code span", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| `a  b` | c |"
      )

      expect(result).toContain("`a  b`")
    })

    it("keeps the spacing inside a multi-backtick code span", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| `` a  `b`  c `` | d |"
      )

      expect(result).toContain("`` a  `b`  c ``")
    })

    it("keeps an unbalanced backtick as written", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| a  `b | c |"
      )

      expect(result).toContain("| a `b | c |")
      expectNoLeakedPlaceholder(result)
    })

    it("keeps the spacing inside an HTML tag", async () => {
      const result = await formatWithPlugin(
        '| A | B |\n| --- | --- |\n| <span  class="x">t</span>  u | c |'
      )

      expect(result).toContain('<span  class="x">t</span> u')
    })

    it("keeps a character entity intact", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| a &nbsp;  b | c |"
      )

      expect(result).toContain("&nbsp;")
    })

    it("restores code spans even when comparison operators surround them", async () => {
      const result = await formatWithPlugin(
        "| H | V |\n| --- | --- |\n| `-1435` < value <= `43200` <br />next | ok |"
      )

      expect(result).toContain("`-1435`")
      expect(result).toContain("`43200`")
      expectNoLeakedPlaceholder(result)
    })

    // Restoring a protected region puts an author's text back. If that text
    // holds what a regular expression replacement reads as a substitution
    // pattern, the restore has to stay literal or the region is rewritten and
    // the internal token leaks out.
    const substitutionPatterns = [
      ["whole match", "$&"],
      ["doubled dollar", "$$"],
      ["preceding portion", "$`"],
      ["following portion", "$'"],
      ["numbered group", "$1"],
    ]

    substitutionPatterns.forEach(([name, pattern]) => {
      it(`keeps ${name} (${pattern}) inside a code span`, async () => {
        const result = await formatWithPlugin(
          `| A | B |\n| --- | --- |\n| \`\`a  ${pattern}b\`\` | c |`
        )

        expect(result).toContain(`\`\`a  ${pattern}b\`\``)
        expectNoLeakedPlaceholder(result)
      })

      it(`keeps ${name} (${pattern}) inside an HTML attribute`, async () => {
        const result = await formatWithPlugin(
          `| A | B |\n| --- | --- |\n| <span data="${pattern}">x  y</span> | c |`
        )

        expect(result).toContain(`data="${pattern}"`)
        expectNoLeakedPlaceholder(result)
      })
    })

    it("survives a document that already contains the internal token", async () => {
      // The placeholder prefix is regenerated until it is absent from the
      // input, so a document mentioning it must still round-trip.
      const token = "__COMPACT_TABLES_PLACEHOLDER_abc123__CODE_0__"
      const result = await formatWithPlugin(
        `| H | V |\n| --- | --- |\n| ${token} | \`x  y\` |`
      )

      expect(result).toContain(token)
      expect(result).toContain("`x  y`")
    })
  })

  describe("structures left as written", () => {
    it("keeps pipe lines that have no delimiter row", async () => {
      const input = "| Head1 | Head2 |\n| Data1 | Data2 |"
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
    })

    it("keeps a table whose row has too few cells", async () => {
      const input = "| A | B |\n| --- | --- |\n| 1 |"
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
    })

    it("keeps an MDX comment as written", async () => {
      const result = await formatWithPlugin("{/* a comment */}")

      expect(result).toContain("{/* a comment */}")
      expect(result).not.toContain("<!--")
    })

    it("keeps an unterminated MDX comment opener as written", async () => {
      const input = "{/* opened and never closed\n\n| A | B |\n| --- | --- |"
      const result = await formatWithPlugin(input, "markdown")

      expect(result).toContain("{/* opened and never closed")
    })

    it("leaves a stray closing sequence alone when it closes no comment", async () => {
      // `fixLeakedPipeAfterMdxCommentClose` only acts on a pipe that trails a
      // real comment close, matched against the ranges found in the source.
      const input = "| A |\n| --- |\n| text \\*/} |"
      const result = await formatWithPlugin(input, "markdown")

      expect(result).toContain("\\*/}")
    })

    // Comment markers only count outside code. A `{/*` in a code sample used to
    // pair with an unrelated `*/}` further down, and the tables between the two
    // were then treated as commented-out content: left uncompacted at best, and
    // at worst stripped of a real closing pipe that happened to sit after a
    // `*/}` in a cell.
    describe("comment markers that are only code", () => {
      const table = "| A  | B |\n| --- | --- |\n| 1 | 2 |"
      const compacted = "| A | B |\n| --- | --- |\n| 1 | 2 |"

      const cases = [
        [
          "opener in a fenced block, closer in later prose",
          '```js\nconst a = "{/*"\n```\n\n' + table + "\n\ntext */} end",
        ],
        [
          "opener in a tilde fence, closer in later prose",
          "~~~\n{/*\n~~~\n\n" + table + "\n\n*/} end",
        ],
        [
          "opener and closer in code spans",
          "`{/*` opens\n\n" + table + "\n\n`*/}` closes",
        ],
        [
          "opener in a multi-backtick code span",
          "``a {/* b`` opens\n\n" + table + "\n\n*/} end",
        ],
      ]

      cases.forEach(([name, input]) => {
        it(`still compacts the table when the ${name}`, async () => {
          const result = await formatWithPlugin(input, "markdown")

          expect(result).toContain(compacted)
          await expectIdempotent(input, "markdown")
        })
      })

      it("keeps a closing pipe that follows a comment close in a cell", async () => {
        const input =
          '```js\nconst a = "{/*"\n```\n\n| A | B |\n| --- | --- |\n| x | */} |'
        const result = await formatWithPlugin(input, "markdown")

        expect(result).toContain("| x | */} |")
        await expectIdempotent(input, "markdown")
      })

      it("still treats a real comment as a comment", async () => {
        // The fix must not stop the plugin from recognising comment syntax that
        // sits in ordinary content, fenced code inside the comment included.
        const input = [
          "{/*",
          "",
          "```js",
          "x",
          "```",
          "",
          "| A  | B |",
          "| --- | --- |",
          "| 1 | 2 |",
          "",
          "*/}",
        ].join("\n")
        const result = await formatWithPlugin(input, "markdown")

        expect(result.trim()).toBe(input)
        await expectIdempotent(input, "markdown")
      })
    })

    it("keeps an MDX/JSX element as written", async () => {
      const result = await formatWithPlugin(
        '<Button type="primary">Click</Button>',
        "mdx"
      )

      expect(result).toContain('<Button type="primary">Click</Button>')
    })
  })

  describe("alignment", () => {
    it("keeps every alignment marker", async () => {
      const result = await formatWithPlugin(
        "| Left | Center | Right |\n| :-- | :-: | --: |\n| A | B | C |"
      )

      expect(result).toContain(":--")
      expect(result).toContain(":-:")
      expect(result).toContain("--:")
    })

    it("normalizes a long delimiter row to three dashes", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| ---------- | :--------: |\n| 1 | 2 |"
      )

      expect(result).toContain("| --- | :-: |")
    })
  })

  describe("scale and stability", () => {
    it("handles a table with a hundred rows", async () => {
      const rows = Array.from(
        { length: 100 },
        (_, i) => `| Data${i} | Value${i} |`
      ).join("\n")
      const result = await formatWithPlugin(
        `| Head1 | Head2 |\n| --- | --- |\n${rows}`
      )

      expect(result).toContain("| Head1 | Head2 |")
      expect(result).toContain("| Data99 | Value99 |")
    })

    it("keeps characters that are markup elsewhere", async () => {
      const input = "| Symbols | Value |\n| --- | --- |\n| & < > \" ' | ok |"
      const result = await formatWithPlugin(input)

      expect(result).toContain("| Symbols | Value |")
      expect(result).toContain("| & < > \" ' | ok |")
    })

    it("formats the same table twice with the same result", async () => {
      await expectIdempotent(
        "|A|B|\n|---|---|\n| 1  | `a  b` |   \n\n| C |\n| --- |\n| 2 |"
      )
    })

    it("handles CRLF line endings", async () => {
      const result = await formatWithPlugin(
        "| A  | B |\r\n| --- | --- |\r\n| 1 | 2 |\r\n"
      )

      expect(result).toContain("| A | B |")
      expect(result).toContain("| 1 | 2 |")
    })
  })
})
