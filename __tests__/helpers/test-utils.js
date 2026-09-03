import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import prettier from "prettier"
import plugin from "../../index.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// The options mirror what a documentation project sets: prose is never wrapped,
// and `printWidth` is large enough that the built-in printer would pad every
// table. That is the situation the plugin exists for.
export async function formatWithPlugin(
  content,
  parser = "markdown",
  options = {}
) {
  return await prettier.format(content, {
    parser,
    plugins: [plugin],
    printWidth: 99999,
    proseWrap: "never",
    ...options,
  })
}

export async function formatWithoutPlugin(content, parser = "markdown") {
  return await prettier.format(content, {
    parser,
    printWidth: 99999,
    proseWrap: "never",
  })
}

export function readFixture(filename) {
  const fixturePath = join(__dirname, "../fixtures", filename)
  return readFileSync(fixturePath, "utf8")
}

// A formatter has to be idempotent: the second run must find nothing to change.
export async function expectIdempotent(content, parser = "markdown") {
  const once = await formatWithPlugin(content, parser)
  const twice = await formatWithPlugin(once, parser)
  expect(twice).toBe(once)
  return once
}

export function expectTableStructure(result, expectedLines) {
  expectedLines.forEach((line) => {
    expect(result).toContain(line)
  })
}

export function expectMdxCommentPreservation(result, expectedComments) {
  expectedComments.forEach((comment) => {
    expect(result).toContain(comment)
  })
  // An MDX comment turned into an HTML comment would change what renders.
  expect(result).not.toContain("<!--")
  expect(result).not.toContain("-->")
}

// The delimiter row keeps its outer pipes and at least one alignment marker.
export function expectTableAlignment(result) {
  const lines = result.split("\n")
  const separatorLine = lines.find(
    (line) =>
      line.includes("---") ||
      line.includes(":--") ||
      line.includes("--:") ||
      line.includes(":-:")
  )

  if (separatorLine) {
    expect(separatorLine.trim()).toMatch(/^\|.*\|$/)
    expect(separatorLine).toMatch(/(-{2,}|:--?|--?:)/)
  }
}

// Pipe lines that are not a table keep their line breaks, so the line count
// stays the same and every line still opens with a pipe.
export function expectIncompletePipeTablePreservation(result, originalInput) {
  const originalLines = originalInput.split("\n")
  const resultLines = result.trim().split("\n")

  expect(resultLines.length).toBe(originalLines.length)

  resultLines.forEach((line) => {
    if (line.trim()) {
      expect(line.trim()).toMatch(/^\|/)
    }
  })
}

export function expectMdxJsxPreservation(result, expectedElements) {
  expectedElements.forEach((element) => {
    expect(result).toContain(element)
  })
}

// No internal placeholder token may survive into the output.
export function expectNoLeakedPlaceholder(result) {
  expect(result).not.toContain("__COMPACT_TABLES_PLACEHOLDER_")
}
