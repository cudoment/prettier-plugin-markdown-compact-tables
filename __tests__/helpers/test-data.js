// Table formatting cases
export const tableTestCases = [
  {
    name: "plain table",
    input: "| A | B |\n| --- | --- |\n| 1 | 2 |",
    expected: "| A | B |\n| --- | --- |\n| 1 | 2 |",
  },
  {
    name: "alignment markers",
    input: "| Left | Center | Right |\n| :-- | :-: | --: |\n| L | C | R |",
    expectedHeaders: [
      "| Left | Center | Right |",
      "| :-- | :-: | --: |",
      "| L | C | R |",
    ],
  },
  {
    name: "inline markup inside cells",
    input:
      "| Head1 | Head2<br/>Sub | Head3 |\n| --- | --- | --- |\n| **bold** | `code` | [link](url) |",
    expected: "| Head1 | Head2<br/>Sub | Head3 |",
  },
  {
    name: "single column",
    input: "| Only |\n| --- |\n| 1 |",
    expected: "| Only |\n| --- |\n| 1 |",
  },
  {
    name: "header and delimiter with no body rows",
    input: "| A | B |\n| --- | --- |",
    expected: "| A | B |\n| --- | --- |",
  },
]

// MDX comment cases
export const mdxCommentTestCases = [
  {
    name: "single line comment",
    input: "{/* this is a comment */}",
    expected: "{/* this is a comment */}",
  },
  {
    name: "multi line comment",
    input: "{/*\nseveral\nlines\n*/}",
    expected: "{/*\nseveral\nlines\n*/}",
  },
  {
    name: "comment between paragraphs",
    input: "plain text\n{/* comment */}\nmore text",
    expected: "{/* comment */}",
  },
]

// Pipe lines that are not read as a table, because the delimiter row is absent
export const incompletePipeTableTestCases = [
  {
    name: "no delimiter row",
    input: "| Head1 | Head2 |\n| Data1 | Data2 |",
    expected: "| Head1 | Head2 |\n| Data1 | Data2 |",
  },
  {
    name: "indented rows without a delimiter row",
    input: " | Item | Value |\n | A | B |",
    expected: " | Item | Value |\n | A | B |",
  },
]

// MDX/JSX elements
export const mdxJsxTestCases = [
  {
    name: "text element",
    input: "<Button>Click</Button>",
    expected: "<Button>Click</Button>",
  },
  {
    name: "flow element with an attribute",
    input: '<InfoBox type="note">Info</InfoBox>',
    expected: '<InfoBox type="note">Info</InfoBox>',
  },
]

// A page shaped like real API reference documentation
export const integrationTestCases = [
  {
    name: "API reference page",
    input: `## Request

| Name | Type | Description | Required |
| --- | --- | --- | --- |
| app_key | String | REST API key<br>Found under [My application] > [App keys] | O |
| user_id | Long | Service user id<br>**Note**: treat as sensitive | O |

{/* request sample */}

\`\`\`json
{
  "status": "success"
}
\`\`\``,
    expectedContains: [
      "| Name | Type | Description | Required |",
      "<br>",
      "{/* request sample */}",
      "```json",
    ],
  },
]
