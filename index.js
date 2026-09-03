import markdownPlugin from "prettier/plugins/markdown.js"
import { doc } from "prettier"

const {
  builders: { join, hardline },
} = doc

const createPlaceholderPrefix = (input) => {
  let prefix = `__COMPACT_TABLES_PLACEHOLDER_${Math.random()
    .toString(36)
    .slice(2, 8)}__`
  while (input.includes(prefix)) {
    prefix = `__COMPACT_TABLES_PLACEHOLDER_${Math.random().toString(36).slice(2, 8)}__`
  }
  return prefix
}

const replaceCodeSpans = (input, replace) => {
  let result = ""
  let i = 0

  while (i < input.length) {
    if (input[i] !== "`") {
      result += input[i]
      i++
      continue
    }

    let tickCount = 1
    while (i + tickCount < input.length && input[i + tickCount] === "`") {
      tickCount++
    }

    const fence = "`".repeat(tickCount)
    const end = input.indexOf(fence, i + tickCount)

    if (end === -1) {
      result += input[i]
      i++
      continue
    }

    const span = input.slice(i, end + tickCount)
    result += replace(span)
    i = end + tickCount
  }

  return result
}

// The printer asks for the same document's ranges once per node, so caching the
// most recent input covers every repeat within a format run. A map keyed by the
// document text would never release the documents it has seen, which matters
// when an editor formats on every save.
let cachedRangesInput = null
let cachedRanges = []

const getMdxCommentRanges = (input) => {
  if (!input) return []
  if (input === cachedRangesInput) return cachedRanges

  const ranges = []
  let idx = 0
  while (idx < input.length) {
    const start = input.indexOf("{/*", idx)
    if (start === -1) break
    const end = input.indexOf("*/}", start + 3)
    if (end === -1) break
    ranges.push({ start, end: end + 3 })
    idx = end + 3
  }

  cachedRangesInput = input
  cachedRanges = ranges
  return ranges
}

const isNodeFullyInsideMdxComment = (ranges, nodeStart, nodeEnd) => {
  if (!ranges.length) return false
  return ranges.some(
    (range) => nodeStart >= range.start && nodeEnd <= range.end
  )
}

const fixLeakedPipeAfterMdxCommentClose = (ranges, nodeStart, raw) => {
  // Our formatter (or other tooling) can accidentally emit `*/} |` at the end of
  // a table row when a Markdown table is inside a `{/* ... */}` comment.
  // That breaks MDX parsing, so we normalize it back to the valid `*/}`.
  if (!ranges.length || typeof raw !== "string") return raw
  if (!/\*\/\}\s*\|\s*$/.test(raw)) return raw

  const closeIdx = raw.lastIndexOf("*/}")
  if (closeIdx === -1) return raw

  const commentEndOffset = nodeStart + closeIdx + 3
  const isRealCommentClose = ranges.some(
    (range) => range.end === commentEndOffset
  )
  if (!isRealCommentClose) return raw

  return raw.replace(/\*\/\}\s*\|\s*$/, "*/}")
}

const isHtmlTable = (raw) =>
  /<table[\s>]/i.test(raw) ||
  /<tbody[\s>]/i.test(raw) ||
  /<thead[\s>]/i.test(raw) ||
  /<tr[\s>]/i.test(raw) ||
  /<td[\s>]/i.test(raw) ||
  /<th[\s>]/i.test(raw)

const isSingleCharSequence = (value, ch) =>
  value.length > 0 && value.split("").every((c) => c === ch)

const hasFencedCodeBlock = (raw) => {
  if (typeof raw !== "string" || !raw.includes("\n")) return false

  const lines = raw.split(/\r?\n/)
  let openFence = null

  for (const line of lines) {
    if (!openFence) {
      const openMatch = line.match(/^\s*([`~]{3,})(.*)$/)
      if (!openMatch) continue

      const [, fence, tail] = openMatch
      const fenceChar = fence[0]
      if (!isSingleCharSequence(fence, fenceChar)) continue
      // Backtick fences can't have backticks in the info string.
      if (fenceChar === "`" && tail.includes("`")) continue

      openFence = { char: fenceChar, minLength: fence.length }
      continue
    }

    const closeMatch = line.match(/^\s*([`~]{3,})\s*$/)
    if (!closeMatch) continue

    const closeFence = closeMatch[1]
    const closeChar = closeFence[0]
    if (!isSingleCharSequence(closeFence, closeChar)) continue

    if (
      closeChar === openFence.char &&
      closeFence.length >= openFence.minLength
    ) {
      return true
    }
  }

  return false
}

// Most branches below decide what to print by looking at the node's own source
// text, which needs both its offsets and `originalText`. A node the parser gave
// no position, or a run without `originalText`, gets `null` here and falls
// through to the built-in printer.
const getNodeSlice = (node, options) => {
  const start = node?.position?.start?.offset
  const end = node?.position?.end?.offset
  if (!options?.originalText || start == null || end == null) return null
  return { start, end, raw: options.originalText.slice(start, end) }
}

const getOriginalNodeRaw = (node, options) =>
  getNodeSlice(node, options)?.raw ?? null

const dropSpaceBeforeClosingPipe = (str) => {
  if (str.includes("|")) {
    return str.replace(/([^|\s])(\s+)(\|)/g, "$1$3")
  }
  return str.trimEnd()
}

// Code spans, HTML tags and entities are lifted out before runs of spaces are
// collapsed: the spacing inside them is content, not layout.
const collapseSpaceRuns = (str) => {
  const placeholders = []
  let placeholderIndex = 0
  const prefix = createPlaceholderPrefix(str)
  const addPlaceholder = (value, kind) => {
    const token = `${prefix}${kind}_${placeholderIndex}__`
    placeholders.push({ token, value })
    placeholderIndex++
    return token
  }

  let processedText = replaceCodeSpans(str, (match) =>
    addPlaceholder(match, "CODE")
  )

  processedText = processedText.replace(/<[^>]+>/g, (match) =>
    addPlaceholder(match, "TAG")
  )

  processedText = processedText.replace(/&[#\w]+;/g, (match) =>
    addPlaceholder(match, "ENTITY")
  )

  processedText = processedText.replace(/[ \u00A0]{2,}/g, " ")

  let result = processedText
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const { token, value } = placeholders[i]
    result = result.replaceAll(token, value)
  }

  return result
}

const normalizeCellText = (str) =>
  dropSpaceBeforeClosingPipe(collapseSpaceRuns(str))

const { parsers: coreParsers, printers: corePrinters } = markdownPlugin
const mdastPrinterOrig = corePrinters.mdast

// The parsers are passed through untouched. Declaring them is still required:
// a plugin that only contributes a printer is not consulted when the built-in
// Markdown plugin already answers for the parser.
const parsers = coreParsers

// A trailing pipe closes the cell only when it is not escaped. The backslashes
// in front of it escape each other in pairs, so an even count leaves the pipe
// itself unescaped.
const endsWithUnescapedPipe = (text) => {
  if (!text.endsWith("|")) return false

  let backslashes = 0
  for (let i = text.length - 2; i >= 0 && text[i] === "\\"; i -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 0
}

// Only ASCII spacing separates a cell from its pipes. Unicode spaces such as
// NBSP or U+3000 are cell content, so `String.prototype.trim` must not be used
// here: it would drop them.
const trimAsciiSpace = (text) =>
  text.replace(/^[\t\n\v\f\r ]+/, "").replace(/[\t\n\v\f\r ]+$/, "")

// Prettier 3.9 changed tableCell positions to cover the surrounding pipes
// (`| A ` instead of `A`), so the raw slice is unwrapped before it is
// normalized. On 3.5 through 3.8 a cell slice never starts or ends with an
// unescaped pipe, which makes this a no-op there. Exported for tests: the
// repository runs on a Prettier version that never produces the wrapped shape.
export const unwrapTableCellRaw = (raw) => {
  // The last cell of a row also carries whatever follows the closing pipe, so
  // the edges are trimmed first. Otherwise trailing spaces or tabs hide the
  // closing pipe and it survives as cell content.
  let out = trimAsciiSpace(raw)
  if (out.startsWith("|")) out = out.slice(1)
  if (endsWithUnescapedPipe(out)) out = out.slice(0, -1)
  return trimAsciiSpace(out)
}

function compactTablesPrint(path, options, print) {
  const node = path.node

  const slice = getNodeSlice(node, options)

  if (slice) {
    const ranges = getMdxCommentRanges(options.originalText)

    if (isNodeFullyInsideMdxComment(ranges, slice.start, slice.end)) {
      return slice.raw
    }

    const fixed = fixLeakedPipeAfterMdxCommentClose(
      ranges,
      slice.start,
      slice.raw
    )
    if (fixed !== slice.raw) return fixed
  }

  if (node?.type === "tableRow" && slice) {
    return normalizeCellText(slice.raw.replace(/([^|\s])(\s+)(\|)/g, "$1$3"))
  }

  if (node?.type === "tableCell" && slice) {
    return normalizeCellText(unwrapTableCellRaw(slice.raw))
  }

  const mdxCommentTargetTypes = [
    "paragraph",
    "heading",
    "text",
    "emphasis",
    "strong",
    "inlineCode",
  ]
  if (mdxCommentTargetTypes.includes(node?.type) && slice) {
    if (/\{\/\*|\*\/\}/.test(slice.raw)) {
      return slice.raw
    }
  }

  if (node?.type === "paragraph" && slice) {
    const lines = slice.raw.split("\n")
    const allPipe = lines.every((l) => /^\s*\|/.test(l))
    const hasSeparator = lines.some((l) => /^\s*\|?\s*:?-{3,}:?\s*\|/.test(l))

    if (allPipe && !hasSeparator) {
      return slice.raw
    }
  }

  if (node?.type === "html") {
    const raw = node.value ?? ""
    // An HTML table is printed exactly as written: reflowing it risks breaking
    // a structure Prettier does not model.
    if (isHtmlTable(raw)) return raw
  }

  if (node?.type === "jsx") {
    const raw = getOriginalNodeRaw(node, options) ?? node.value ?? ""
    if (/<table[\s>]/i.test(raw) && /<\/table>/i.test(raw)) {
      return raw
    }
    if (hasFencedCodeBlock(raw)) return raw
  }

  if (
    node?.type === "mdxJsxTextElement" ||
    node?.type === "mdxJsxFlowElement"
  ) {
    const raw = getOriginalNodeRaw(node, options)
    if (raw != null) {
      if (
        node.name === "table" ||
        node.name === "td" ||
        node.name === "th" ||
        isHtmlTable(raw)
      ) {
        return raw
      }
      if (hasFencedCodeBlock(raw)) return raw
      return normalizeCellText(raw)
    }
  }

  if (node?.type === "table") {
    const rows = node.children || []
    if (!rows.length) return ""

    const rowLengths = rows.map((row) => row.children?.length ?? 0)
    const headerCount = rowLengths[0] ?? 0
    if (!headerCount) return mdastPrinterOrig.print(path, options, print)
    const mdxCommentRanges = options.originalText
      ? getMdxCommentRanges(options.originalText)
      : []
    const commentRowSlice = (row) => {
      const rowSlice = getNodeSlice(row, options)
      if (!rowSlice) return null
      return isNodeFullyInsideMdxComment(
        mdxCommentRanges,
        rowSlice.start,
        rowSlice.end
      )
        ? rowSlice
        : null
    }

    if (
      rowLengths.some(
        (len, idx) => !commentRowSlice(rows[idx]) && len !== headerCount
      )
    ) {
      // Don't try to normalize malformed tables. Preserve the raw text so we
      // don't introduce extra padding pipes/spaces.
      if (slice) return slice.raw
      return mdastPrinterOrig.print(path, options, print)
    }
    const align = node.align || []

    const buildRow = (rowIdx) => {
      const rowSlice = commentRowSlice(rows[rowIdx])
      if (rowSlice) {
        return fixLeakedPipeAfterMdxCommentClose(
          mdxCommentRanges,
          rowSlice.start,
          rowSlice.raw
        )
      }

      return [
        "| ",
        path.call(
          (rowPath) => join(" | ", rowPath.map(print, "children")),
          "children",
          rowIdx
        ),
        " |",
      ]
    }

    const headerDoc = buildRow(0)
    const toDocArray = (value) => (Array.isArray(value) ? value : [value])

    const sepCells = Array.from({ length: headerCount }, (_, i) => {
      switch (align[i]) {
        case "left":
          return ":--"
        case "right":
          return "--:"
        case "center":
          return ":-:"
        default:
          return "---"
      }
    })
    const sepDoc = ["| ", sepCells.join(" | "), " |"]

    const bodyDocs = rows
      .slice(1)
      .flatMap((_, idx) => [hardline, buildRow(idx + 1)])

    return [...toDocArray(headerDoc), hardline, ...sepDoc, ...bodyDocs]
  }

  return mdastPrinterOrig.print(path, options, print)
}

const customPrinter = {
  ...mdastPrinterOrig,
  print: compactTablesPrint,
  embed: (path, options) => {
    const node = path.node
    if (
      node?.type === "jsx" &&
      typeof node.value === "string" &&
      /<table[\s>]/i.test(node.value) &&
      /<\/table>/i.test(node.value)
    ) {
      return null
    }
    if (node?.type === "jsx" && typeof node.value === "string") {
      const raw = getOriginalNodeRaw(node, options) ?? node.value
      if (hasFencedCodeBlock(raw)) return null
    }
    if (
      (node?.type === "mdxJsxTextElement" ||
        node?.type === "mdxJsxFlowElement") &&
      options?.originalText
    ) {
      const raw = getOriginalNodeRaw(node, options)
      if (raw && hasFencedCodeBlock(raw)) return null
    }
    return mdastPrinterOrig.embed ? mdastPrinterOrig.embed(path, options) : null
  },
}

const plugin = {
  parsers,
  printers: { mdast: customPrinter },
  languages: markdownPlugin.languages,
}

export default plugin
