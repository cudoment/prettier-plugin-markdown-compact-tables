import markdownPlugin from "prettier/plugins/markdown.js"
import { doc } from "prettier"

const {
  builders: { join, hardline },
} = doc

const PLACEHOLDER_PREFIX = "__COMPACT_TABLES_PLACEHOLDER_"

const createPlaceholderPrefix = (input) => {
  let prefix
  do {
    prefix = `${PLACEHOLDER_PREFIX}${Math.random().toString(36).slice(2, 8)}__`
  } while (input.includes(prefix))
  return prefix
}

// `String.prototype.replaceAll` reads `$&`, `` $` ``, `$'` and `$$` in the
// replacement as substitution patterns, even when the pattern it searches for
// is a plain string. The caller below puts back the source of a protected
// region, which is text an author wrote, so a `$` in it has to land verbatim.
// `split`/`join` is what guarantees that. Do not "simplify" this to
// `replaceAll`.
const replaceAllLiteral = (text, token, value) => text.split(token).join(value)

// Calls `onSpan(start, end)` for every code span in `text`, where `end` is the
// offset just past the closing backticks. Follows CommonMark: a run of N
// backticks is closed only by the next run of exactly N backticks, a run of a
// different length in between is content, and an opening run that finds no
// closer is literal text.
const forEachCodeSpan = (text, onSpan) => {
  const runLength = (from) => {
    let length = 0
    while (text[from + length] === "`") length += 1
    return length
  }

  let i = text.indexOf("`")
  while (i !== -1) {
    const open = runLength(i)
    let j = text.indexOf("`", i + open)
    while (j !== -1) {
      const run = runLength(j)
      if (run === open) break
      j = text.indexOf("`", j + run)
    }

    if (j === -1) {
      i = text.indexOf("`", i + open)
      continue
    }
    onSpan(i, j + open)
    i = text.indexOf("`", j + open)
  }
}

const replaceCodeSpans = (input, replace) => {
  let result = ""
  let last = 0
  forEachCodeSpan(input, (start, end) => {
    result += input.slice(last, start) + replace(input.slice(start, end))
    last = end
  })
  return result + input.slice(last)
}

// A fence is three or more backticks or tildes at the start of a line, after
// optional indentation. A backtick fence cannot carry a backtick in its info
// string. Returns the fence, or `null` when the line opens none.
const matchFenceOpen = (line) => {
  const match = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
  if (!match) return null
  const [, fence, info] = match
  if (fence[0] === "`" && info.includes("`")) return null
  return { char: fence[0], length: fence.length }
}

// A fence closes on a line that holds nothing but a run of the same character,
// at least as long as the opening run.
const closesFence = (line, fence) => {
  const match = line.match(/^\s*(`{3,}|~{3,})\s*$/)
  return (
    match !== null &&
    match[1][0] === fence.char &&
    match[1].length >= fence.length
  )
}

// `{/*` and `*/}` inside a code span or a fenced code block are characters a
// reader sees, not comment markers. Scanning for them without excluding code
// lets a `{/*` in a code sample pair with an unrelated `*/}` further down, and
// every table between the two is then mistaken for commented-out content. The
// mask blanks code regions while keeping the document's length, so the offsets
// the scan reports still index the original source.
const maskCodeRegions = (input) => {
  const chars = input.split("")
  const blank = (from, to) => {
    for (let i = from; i < to; i += 1) {
      if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " "
    }
  }

  let openFence = null
  let lineStart = 0
  while (lineStart <= input.length) {
    const newlineIdx = input.indexOf("\n", lineStart)
    const lineEnd = newlineIdx === -1 ? input.length : newlineIdx
    const line = input.slice(lineStart, lineEnd).replace(/\r$/, "")

    if (openFence) {
      blank(lineStart, lineEnd)
      if (closesFence(line, openFence)) openFence = null
    } else {
      openFence = matchFenceOpen(line)
      if (openFence) blank(lineStart, lineEnd)
    }

    if (newlineIdx === -1) break
    lineStart = newlineIdx + 1
  }

  // Code spans are scanned over the text whose fences are already blank, so
  // that a backtick inside a code block cannot open a span.
  forEachCodeSpan(chars.join(""), blank)

  return chars.join("")
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

  const scanned = maskCodeRegions(input)
  const ranges = []
  let idx = 0
  while (idx < scanned.length) {
    const start = scanned.indexOf("{/*", idx)
    if (start === -1) break
    const end = scanned.indexOf("*/}", start + 3)
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

// A Markdown table written inside a `{/* ... */}` comment can come out of a
// formatter with `*/} |` on its closing row. The stray pipe makes the document
// invalid MDX, so it is dropped back to `*/}`. Only a pipe that trails a real
// comment close, matched against the ranges found in the source, is touched.
const fixLeakedPipeAfterMdxCommentClose = (ranges, nodeStart, raw) => {
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
  /<(?:table|thead|tbody|tfoot|tr|td|th)[\s>]/i.test(raw)

// Only a fence that is opened and closed within the text counts, so that a
// lone fence line does not pass for a code block.
const hasFencedCodeBlock = (raw) => {
  if (typeof raw !== "string" || !raw.includes("\n")) return false

  let openFence = null
  for (const line of raw.split(/\r?\n/)) {
    if (!openFence) openFence = matchFenceOpen(line)
    else if (closesFence(line, openFence)) return true
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

// The built-in printer hands a `jsx` node to the JavaScript formatter, which
// reflows an HTML table and folds the line breaks of a fenced code block. A
// node holding either is printed as written instead.
const isJsxPrintedVerbatim = (node, options) => {
  const raw = getOriginalNodeRaw(node, options) ?? node.value ?? ""
  return (
    (/<table[\s>]/i.test(raw) && /<\/table>/i.test(raw)) ||
    hasFencedCodeBlock(raw)
  )
}

// Only ASCII spacing separates a cell from its pipes. Unicode spaces such as
// NBSP or U+3000 are cell content, so neither `String.prototype.trim` nor `\s`,
// which both match them, is used on the edges of a cell.
const trimAsciiSpace = (text) =>
  text.replace(/^[\t\n\v\f\r ]+/, "").replace(/[\t\n\v\f\r ]+$/, "")

const dropSpaceBeforeClosingPipe = (str) =>
  str.includes("|")
    ? str.replace(/([^|\t\n\v\f\r ])[\t\n\v\f\r ]+\|/g, "$1|")
    : str.replace(/[\t\n\v\f\r ]+$/, "")

// Runs of ASCII spaces collapse to one. Code spans, HTML tags and entities are
// lifted out first: the spacing inside them is content, not layout.
const collapseSpaceRuns = (str) => {
  const placeholders = []
  const prefix = createPlaceholderPrefix(str)
  const addPlaceholder = (value, kind) => {
    const token = `${prefix}${kind}_${placeholders.length}__`
    placeholders.push({ token, value })
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

  processedText = processedText.replace(/ {2,}/g, " ")

  let result = processedText
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const { token, value } = placeholders[i]
    result = replaceAllLiteral(result, token, value)
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

// Prettier 3.9 changed tableCell positions to cover the surrounding pipes
// (`| A ` instead of `A`), so the raw slice is unwrapped before it is
// normalized. On 3.0 through 3.8 a cell slice never starts or ends with an
// unescaped pipe, which makes this a no-op there. Exported so the unit tests
// can cover both shapes whichever Prettier version is installed.
export const unwrapTableCellRaw = (raw) => {
  // The last cell of a row also carries whatever follows the closing pipe, so
  // the edges are trimmed first. Otherwise trailing spaces or tabs hide the
  // closing pipe and it survives as cell content.
  let out = trimAsciiSpace(raw)
  if (out.startsWith("|")) out = out.slice(1)
  if (endsWithUnescapedPipe(out)) out = out.slice(0, -1)
  return trimAsciiSpace(out)
}

// A node of one of these types may carry MDX comment syntax in its source, in
// which case it is printed verbatim. The set is built once: the check below runs
// for every node of every document.
const MDX_COMMENT_TARGET_TYPES = new Set([
  "paragraph",
  "heading",
  "text",
  "emphasis",
  "strong",
  "inlineCode",
])

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

  if (node?.type === "tableCell" && slice) {
    return normalizeCellText(unwrapTableCellRaw(slice.raw))
  }

  if (MDX_COMMENT_TARGET_TYPES.has(node?.type) && slice) {
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

  if (node?.type === "jsx" && isJsxPrintedVerbatim(node, options)) {
    return getOriginalNodeRaw(node, options) ?? node.value ?? ""
  }

  // These two node types belong to a `remark-mdx` v2 or later tree, where an
  // MDX element is parsed into a named element node. Prettier's own `markdown`
  // and `mdx` parsers never build them: the `mdx` parser reports a whole MDX
  // element as the single `jsx` node the branch above handles, and the
  // `markdown` parser reports it as `html`. So this branch stays inert on
  // Prettier's built-in parsers and only runs when another plugin supplies a
  // parser that hands the printer a `remark-mdx` tree. It is kept because the
  // `jsx` branch above would not recognise a table in that shape, and a table
  // printed by the built-in printer instead of returned verbatim is exactly
  // the padding this plugin exists to avoid.
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
      // A table whose rows disagree with the header is not normalized. Its
      // source is kept so that no padding pipes or spaces are introduced.
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
    // Returning `null` keeps the node out of the JavaScript formatter, so that
    // `print` above can return its source as written.
    if (node?.type === "jsx" && isJsxPrintedVerbatim(node, options)) {
      return null
    }
    // Same `remark-mdx` node types as in `print`: unreachable through
    // Prettier's own parsers, and here so that a fenced code block inside such
    // an element is left to `print` rather than embedded.
    if (
      node?.type === "mdxJsxTextElement" ||
      node?.type === "mdxJsxFlowElement"
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
