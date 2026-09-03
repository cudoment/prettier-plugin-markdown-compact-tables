import { describe, it, expect } from "vitest"
import { compile } from "@mdx-js/mdx"
import {
  formatWithPlugin,
  formatWithoutPlugin,
  expectIdempotent,
  expectTableStructure,
  expectMdxCommentPreservation,
  expectTableAlignment,
  expectIncompletePipeTablePreservation,
  expectMdxJsxPreservation,
  readFixture,
} from "./helpers/test-utils.js"
import {
  tableTestCases,
  mdxCommentTestCases,
  incompletePipeTableTestCases,
  mdxJsxTestCases,
  integrationTestCases,
} from "./helpers/test-data.js"

describe("prettier-plugin-markdown-compact-tables", () => {
  describe("1. table compaction", () => {
    tableTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)

        expect(result).toContain("|")
        expectTableAlignment(result)

        if (testCase.expected) {
          expect(result).toContain(testCase.expected.split("\n")[0])
        }

        if (testCase.expectedHeaders) {
          expectTableStructure(result, testCase.expectedHeaders)
        }
      })
    })

    it("adds no padding to match column widths", async () => {
      const input = "| A  | B   |\n| --- | --- |\n| C  | D   |"
      const result = await formatWithPlugin(input)

      expect(result).toContain("| A | B |")
      expect(result).toContain("| C | D |")
      expect(result).not.toContain("| A  | B   |")
    })

    it("pads nothing even when one cell is far longer than the others", async () => {
      const input = [
        "| Name | Description | Required |",
        "| --- | --- | --- |",
        "| title | Notification title | O |",
        "| send_mode | Delivery mode<br />- `0`: send now<br />- `1`: schedule<br />**Note**: defaults to `0` | X |",
        "| is_public | Whether the notice is public | X |",
      ].join("\n")
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
      // The short rows stay short: no line is stretched to the longest one.
      const lines = result.trim().split("\n")
      expect(lines[2].length).toBeLessThan(lines[3].length / 2)
    })

    it("collapses repeated spaces while protecting code, tags and entities", async () => {
      const input = [
        "| H | V |",
        "| --- | --- |",
        '| A  B | `code  span` <span  class="x">tag</span> &nbsp;  |',
      ].join("\n")

      const result = await formatWithPlugin(input)

      expect(result).toContain("| A B |")
      expect(result).toContain("`code  span`")
      expect(result).toContain('<span  class="x">tag</span>')
      expect(result).toContain("&nbsp;")
    })

    it("does not pad a table whose cells hold wide characters", async () => {
      // East Asian characters are two columns wide on screen, which is what the
      // built-in printer aligns on. Compaction has to ignore display width.
      const input = "| 이름 | 값 |\n| --- | --- |\n| a | b |"
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
    })
  })

  describe("2. MDX comments", () => {
    mdxCommentTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)
        expectMdxCommentPreservation(result, [testCase.expected])
      })
    })

    it("keeps a comment that sits between two paragraphs", async () => {
      const input = "plain text\n{/* comment */}\nmore text"
      const result = await formatWithPlugin(input)

      expect(result).toContain("plain text")
      expect(result).toContain("more text")
      expectMdxCommentPreservation(result, ["{/* comment */}"])
    })

    it("keeps a commented-out table row as written", async () => {
      const input = [
        "| Category | API |",
        "| --- | --- |",
        "{/* | Channel message | [Send with a custom template](/docs/channel-message/rest-api) | */}",
      ].join("\n")

      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain(
        "{/* | Channel message | [Send with a custom template](/docs/channel-message/rest-api) | */}"
      )
      expect(result).not.toContain("| {/*")
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("keeps a whole table that lives inside a comment", async () => {
      const input = [
        "{/* ## Channel message batch (#channel-message-batch)",
        "",
        "| Category | API |",
        "| --- | --- |",
        "| Channel message batch | [Broadcast](/docs/platform/rest-api#broadcast) | */}",
      ].join("\n")

      const result = await formatWithPlugin(input, "mdx")

      // A pipe must not leak past the comment close, which would break MDX.
      expect(result).not.toContain("*/} |")
      expect(result.trim()).toBe(input)
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("repairs a stray pipe left after a comment close", async () => {
      const rows = [
        "{/* ## Channel message batch (#channel-message-batch)",
        "",
        "| Category | API |",
        "| --- | --- |",
        "| Channel message batch | [Broadcast](/docs/platform/rest-api#broadcast) | */}",
      ]
      const broken = rows.join("\n") + " |"
      const fixed = rows.join("\n")

      const result = await formatWithPlugin(broken, "mdx")

      expect(result).not.toContain("*/} |")
      expect(result.trim()).toBe(fixed)
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("formats a document holding a commented table twice with the same result", async () => {
      const input = [
        "{/* ## Batch",
        "",
        "| Category | API |",
        "| --- | --- |",
        "| Batch | [Broadcast](/docs/broadcast) | */}",
        "",
        "| A  | B |",
        "| --- | --- |",
        "| 1 | 2 |",
      ].join("\n")

      await expectIdempotent(input, "mdx")
    })
  })

  describe("3. pipe lines that are not a table", () => {
    incompletePipeTableTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)
        expectIncompletePipeTablePreservation(result, testCase.input)
      })
    })

    it("keeps a table whose row has too few cells", async () => {
      const input = "| A | B |\n| --- | --- |\n| 1 |"
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
      expect(result).not.toContain("| A   | B   |")
    })

    it("keeps a table whose row has too many cells", async () => {
      const input = "| A | B |\n| --- | --- |\n| 1 | 2 | 3 |"
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
    })
  })

  describe("4. MDX and JSX elements", () => {
    mdxJsxTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input, "mdx")
        expectMdxJsxPreservation(result, [testCase.expected])
      })
    })

    it("keeps a JSX table as written", async () => {
      const input =
        "<table><tr><td>a<br>b</td></tr></table>\n<table><tr><th>h<br/>i</th></tr></table>"
      const result = await formatWithPlugin(input, "mdx")

      expect(result.trim()).toBe(input)
    })

    it("collapses repeated spaces in an ordinary JSX element", async () => {
      const result = await formatWithPlugin("<InfoBox>a  b</InfoBox>", "mdx")

      expect(result).toContain("<InfoBox>a b</InfoBox>")
    })

    it("keeps the line breaks of a backtick fenced block inside JSX", async () => {
      const input = [
        "<Tabs>",
        '  <TabsContent value={"header"} label={"Header"}>',
        "    ```",
        "    line one",
        "    line two",
        "    ```",
        "  </TabsContent>",
        "</Tabs>",
      ].join("\n")
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain("    ```\n    line one\n    line two\n    ```")
      expect(result).not.toContain("``` line one")
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("keeps the line breaks of a tilde fenced block inside JSX", async () => {
      const input = [
        "<Tabs>",
        '  <TabsContent value={"header"} label={"Header"}>',
        "    ~~~",
        "    line one",
        "    line two",
        "    ~~~",
        "  </TabsContent>",
        "</Tabs>",
      ].join("\n")
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain("    ~~~\n    line one\n    line two\n    ~~~")
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("keeps a fenced block closed by a longer fence", async () => {
      const input = [
        "<Tabs>",
        '  <TabsContent value={"header"} label={"Header"}>',
        "    ```js",
        "    const a = 1",
        "    ````",
        "  </TabsContent>",
        "</Tabs>",
      ].join("\n")
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain("    const a = 1")
    })
  })

  describe("5. parsers", () => {
    it("markdown", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| 1 | 2 |",
        "markdown"
      )
      expectTableStructure(result, ["| A | B |"])
    })

    it("mdx", async () => {
      const result = await formatWithPlugin(
        "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n<Button>Click</Button>",
        "mdx"
      )
      expectTableStructure(result, ["| A | B |"])
      expect(result).toContain("<Button>Click</Button>")
    })
  })

  describe("6. whole documents", () => {
    integrationTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)

        testCase.expectedContains.forEach((expected) => {
          expect(result).toContain(expected)
        })

        if (result.includes("{/*")) {
          expectMdxCommentPreservation(result, ["{/* request sample */}"])
        }
        if (result.includes("|")) {
          expectTableAlignment(result)
        }
      })
    })

    it("mixes headings, comments, tables and JSX without disturbing them", async () => {
      const input = [
        "# Title",
        "",
        "{/* comment */}",
        "",
        // A bare `<br>` is not valid JSX, so an MDX document has to close it.
        "| Head | Body<br />Sub |",
        "| --- | --- |",
        "| **bold** | `code` |",
        "",
        '<InfoBox type="note">',
        "Info box",
        "</InfoBox>",
        "",
        "Closing paragraph",
      ].join("\n")

      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain("# Title")
      expectMdxCommentPreservation(result, ["{/* comment */}"])
      expectTableStructure(result, ["| Head | Body<br />Sub |"])
      expect(result).toContain('<InfoBox type="note">')
      expect(result).toContain("Closing paragraph")
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("compacts a table nested in a list item", async () => {
      const input = [
        "- Step one",
        "",
        "  | A  | B |",
        "  | --- | --- |",
        "  | 1 | 2 |",
        "",
        "- Step two",
      ].join("\n")
      const result = await formatWithPlugin(input)

      expect(result).toContain("| A | B |")
      expect(result).toContain("- Step two")
      await expectIdempotent(input)
    })

    it("compacts a table nested in a blockquote", async () => {
      const input = ["> | A  | B |", "> | --- | --- |", "> | 1 | 2 |"].join(
        "\n"
      )
      const result = await formatWithPlugin(input)

      expect(result).toContain("| A | B |")
      await expectIdempotent(input)
    })

    it("leaves an empty document empty", async () => {
      expect((await formatWithPlugin("")).trim()).toBe("")
    })

    it("leaves a whitespace-only document empty", async () => {
      expect((await formatWithPlugin("   \n   \n   ")).trim()).toBe("")
    })

    it("keeps a very wide table on one line per row", async () => {
      const wide = "A".repeat(100)
      const input = [
        `| ${wide} | ${wide} |`,
        "| --- | --- |",
        `| ${"x".repeat(200)} | ${"y".repeat(200)} |`,
      ].join("\n")
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
    })
  })

  describe("7. HTML blocks", () => {
    it("keeps an HTML table as written", async () => {
      const input = "<table><tr><td>a<br>b</td></tr></table>"
      const result = await formatWithPlugin(input, "markdown")

      expect(result.trim()).toBe(input)
    })

    it("keeps an HTML table fragment that opens with a row", async () => {
      const input = "<tr><td>a  b</td></tr>"
      const result = await formatWithPlugin(input, "markdown")

      expect(result.trim()).toBe(input)
    })

    it("keeps a multi line HTML table as written", async () => {
      const input = [
        "<table>",
        "  <thead>",
        "    <tr><th>A</th></tr>",
        "  </thead>",
        "</table>",
      ].join("\n")
      const result = await formatWithPlugin(input, "markdown")

      expect(result.trim()).toBe(input)
    })
  })

  describe("8. tables taken from real documents", () => {
    const fixtures = [
      {
        name: "error code table keeps its links and long cells",
        filename: "real-error-code-table.mdx",
        expectedLines: [
          "| Error Code | Status Code | Cause | Solution |",
          "| `-3` | `403` | If the required feature activation (simple sign-up, consent items, service settings, etc.) is not completed or the allow call is not enabled in the [Available APIs](../app-setting/app#admin-key-api) for using this API. | After completing the required settings in the [app management page](https://developers.example.com/console/app), request again. |",
        ],
      },
      {
        name: "app setting table keeps its emphasis and links",
        filename: "real-app-setting-table.mdx",
        expectedLines: [
          "| Setting item | Allowed target | Usage example |",
          "| [Only specific APIs allowed] | Allows calling **only selected APIs** among [Admin key: API category](../reference/admin-key-api). | Use this when you want to separate and control sensitive APIs. |",
        ],
      },
      {
        name: "channel method table keeps its code spans and long links",
        filename: "real-channel-method-table.mdx",
        expectedLines: [
          "| Implementation method | Method name | Service page retention | Result check |",
          "| [Channel Add](#channel-add) | `addChannel()` | Redirects to the channel page in Messenger via a connection page, and adds the channel **after leaving the service page with user consent** | Requires a separate check via [Retrieve Channel relationship](#status-check-relationship) request |",
        ],
      },
      {
        name: "browser support table keeps characters Markdown would escape",
        filename: "real-browser-support-table.mdx",
        expectedLines: [
          "| Chrome* | O | O | O | O |",
          "| Internet Explorer (IE) | X | X | X | O** |",
        ],
      },
    ]

    fixtures.forEach((fixture) => {
      it(fixture.name, async () => {
        const input = readFixture(fixture.filename)
        const result = await formatWithPlugin(input, "mdx")

        expect(result.trim()).toBe(input.trim())
        fixture.expectedLines.forEach((line) => {
          expect(result).toContain(line)
        })
      })

      it(`${fixture.name}, formatted twice`, async () => {
        await expectIdempotent(readFixture(fixture.filename), "mdx")
      })
    })

    it("keeps asterisks that the built-in printer escapes", async () => {
      const input = readFixture("real-browser-support-table.mdx")
      const baseResult = await formatWithoutPlugin(input, "mdx")
      const pluginResult = await formatWithPlugin(input, "mdx")

      expect(baseResult).toContain("Chrome\\*")
      expect(baseResult).toContain("O\\*\\*")
      expect(pluginResult).toContain("| Chrome* | O | O | O | O |")
      expect(pluginResult).toContain(
        "| Internet Explorer (IE) | X | X | X | O** |"
      )
      expect(pluginResult.trim()).toBe(input.trim())
    })
  })

  describe("9. MDX taken from real documents", () => {
    it("keeps a commented-out JSX block as written", async () => {
      const input = readFixture("commented-jsx-table.mdx")
      const result = await formatWithPlugin(input, "mdx")

      expect(result.trim()).toBe(input.trim())
      expectMdxCommentPreservation(result, ["{/* <Table>"])
      expect(result).toContain(
        "[Android](../social-login/android#login-with-messenger)<br />[iOS](../social-login/ios#login-with-messenger)<br />[Flutter](../social-login/flutter#login-with-messenger)"
      )
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("keeps a commented-out JSX block that the built-in printer escapes", async () => {
      const input = readFixture("commented-jsx-table.mdx")
      const baseResult = await formatWithoutPlugin(input, "mdx")
      const pluginResult = await formatWithPlugin(input, "mdx")

      expect(baseResult).toContain("{/\\* <Table>")
      expect(pluginResult).toContain("{/* <Table>")
      expect(pluginResult.trim()).toBe(input.trim())
      await expect(compile(pluginResult, { jsx: true })).resolves.toBeTruthy()
    })

    it("keeps a Tabs and DocDataEmbed structure as written", async () => {
      const input = readFixture("real-tabs-docdataembed.mdx")
      const result = await formatWithPlugin(input, "mdx")

      expect(result.trim()).toBe(input.trim())
      expect(result).toContain(
        '<DocDataEmbed href="/docs/en/message-share/android-link" type="infoApiReferenceDescription" minWidths={[, 280]} />'
      )
      expect(result).toContain(
        '<DocDataEmbed href="/docs/en/message-share/callback" type="infoApiMethodUrlDescription" />'
      )
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("keeps every fixture stable when formatted twice", async () => {
      for (const filename of [
        "commented-jsx-table.mdx",
        "real-tabs-docdataembed.mdx",
      ]) {
        await expectIdempotent(readFixture(filename), "mdx")
      }
    })
  })
})
