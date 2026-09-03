import markdownPlugin from "prettier/plugins/markdown.js"
import { doc } from "prettier"

const {
  builders: { join, hardline },
} = doc

// Markdown escape normalization the plugin always applies. Vocabulary-level
// replacements are project-specific, so they come from the
// `compactTablesReplacements` option instead of being hardcoded here.
const CORE_TEXT_REPLACEMENTS = [
  {
    pattern: /\\\[/g,
    to: "[",
  },
]

const REPLACEMENT_SEPARATOR = "=>"
const EMPTY_REPLACEMENTS = []
const optionReplacementsCache = new WeakMap()

const REGEX_FLAGS_PATTERN = /^[dgimsuvy]*$/

// Finds the closing delimiter of a leading `/pattern/` literal, skipping
// escapes and slashes inside a character class. Returns -1 when the entry does
// not open with a regular expression.
const findRegexBodyEnd = (entry) => {
  if (!entry.startsWith("/")) return -1

  let insideCharacterClass = false
  for (let index = 1; index < entry.length; index += 1) {
    const char = entry[index]
    if (char === "\\") {
      index += 1
      continue
    }
    if (char === "[") insideCharacterClass = true
    else if (char === "]") insideCharacterClass = false
    else if (char === "/" && !insideCharacterClass) return index
  }

  return -1
}

// `/pattern/flags=>replacement`. Returns null when the entry is not a valid
// regular expression rule, so the caller can fall back to a literal rule. That
// keeps a literal replacement starting with `/` (a URL path, for example)
// working.
const parseRegexEntry = (entry) => {
  const bodyEnd = findRegexBodyEnd(entry)
  if (bodyEnd <= 1) return null

  const separatorIndex = entry.indexOf(REPLACEMENT_SEPARATOR, bodyEnd + 1)
  if (separatorIndex === -1) return null

  const flags = entry.slice(bodyEnd + 1, separatorIndex)
  if (!REGEX_FLAGS_PATTERN.test(flags)) return null

  try {
    return {
      // Replacing every occurrence is the only useful behavior here, so `g` is
      // added when the rule omits it.
      pattern: new RegExp(
        entry.slice(1, bodyEnd),
        flags.includes("g") ? flags : `${flags}g`
      ),
      to: entry.slice(separatorIndex + REPLACEMENT_SEPARATOR.length),
    }
  } catch {
    return null
  }
}

// `from=>to`. The separator is matched at its first occurrence, so the
// replacement may itself contain `=>`. Nothing is trimmed: leading and
// trailing spaces are part of the rule.
const parseLiteralEntry = (entry) => {
  const separatorIndex = entry.indexOf(REPLACEMENT_SEPARATOR)
  // A missing separator (-1) or an empty left side (0) is not a usable rule.
  if (separatorIndex <= 0) return null
  return {
    from: entry.slice(0, separatorIndex),
    to: entry.slice(separatorIndex + REPLACEMENT_SEPARATOR.length),
  }
}

const parseReplacementEntries = (entries) =>
  entries.flatMap((entry) => {
    if (typeof entry !== "string") return []
    const rule = parseRegexEntry(entry) ?? parseLiteralEntry(entry)
    return rule ? [rule] : []
  })

const getOptionReplacements = (options) => {
  const entries = options?.compactTablesReplacements
  if (!Array.isArray(entries) || !entries.length) return EMPTY_REPLACEMENTS

  const cached = optionReplacementsCache.get(entries)
  if (cached) return cached

  const parsed = parseReplacementEntries(entries)
  optionReplacementsCache.set(entries, parsed)
  return parsed
}

const createPlaceholderPrefix = (input) => {
  let prefix = `__COMPACT_TABLES_PLACEHOLDER_${Math.random()
    .toString(36)
    .slice(2, 8)}__`
  while (input.includes(prefix)) {
    prefix = `__COMPACT_TABLES_PLACEHOLDER_${Math.random().toString(36).slice(2, 8)}__`
  }
  return prefix
}

const replaceAllLiteral = (text, token, value) => text.split(token).join(value)

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

const replaceMdxComments = (input, replace) => {
  const ranges = getMdxCommentRanges(input)
  if (!ranges.length) return input

  let result = ""
  let cursor = 0
  for (const range of ranges) {
    result += input.slice(cursor, range.start)
    result += replace(input.slice(range.start, range.end))
    cursor = range.end
  }
  result += input.slice(cursor)
  return result
}

const mdxCommentRangesCache = new Map()

const getMdxCommentRanges = (input) => {
  if (!input) return []
  const cached = mdxCommentRangesCache.get(input)
  if (cached) return cached

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

  mdxCommentRangesCache.set(input, ranges)
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

const getOriginalNodeRaw = (node, options) => {
  if (
    !options?.originalText ||
    node?.position?.start?.offset == null ||
    node?.position?.end?.offset == null
  ) {
    return null
  }
  return options.originalText.slice(
    node.position.start.offset,
    node.position.end.offset
  )
}

const normalizeInlineBreaksInCell = (raw, tagName) => {
  const openTag = tagName === "th" ? "<th" : "<td"
  const closeTag = tagName === "th" ? "</th>" : "</td>"
  const match = raw.match(
    new RegExp(`^(\\s*${openTag}[^>]*>)([\\s\\S]*?)(${closeTag}\\s*)$`, "i")
  )
  if (!match) return normalizeTableBreaks(raw)
  const [, open, innerRaw, close] = match
  const normalizedInner = innerRaw.replace(/\s*<br\s*\/?>\s*/gi, "<br />")
  return `${open}${normalizedInner}${close}`
}

const normalizeTableBreaks = (raw) =>
  raw.replace(/\s*<br\s*\/?>\s*/gi, "<br />")

const builtInTransforms = {
  tableCellTrailingSpace: (str) => {
    if (str.includes("|")) {
      return str.replace(/([^|\s])(\s+)(\|)/g, "$1$3")
    }
    return str.trimEnd()
  },
  collapseMultipleSpaces: (str) => {
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
      result = replaceAllLiteral(result, token, value)
    }

    return result
  },
}

const applyTextReplacements = (str, replacements = EMPTY_REPLACEMENTS) => {
  let result = str

  for (const rule of [...CORE_TEXT_REPLACEMENTS, ...replacements]) {
    result = rule.pattern
      ? result.replace(rule.pattern, rule.to)
      : replaceAllLiteral(result, rule.from, rule.to)
  }

  return result
}

const applyTextReplacementsSafely = (
  str,
  { applyBr = false, replacements = EMPTY_REPLACEMENTS } = {}
) => {
  const placeholders = []
  let placeholderIndex = 0
  const prefix = createPlaceholderPrefix(str)
  const addPlaceholder = (value, kind) => {
    const token = `${prefix}${kind}_${placeholderIndex}__`
    placeholders.push({ token, value })
    placeholderIndex++
    return token
  }

  let processed = replaceMdxComments(str, (match) =>
    addPlaceholder(match, "COMMENT")
  )
  processed = replaceCodeSpans(processed, (match) =>
    addPlaceholder(match, "CODE")
  )

  if (applyBr) {
    processed = processed.replace(/<br\s*\/?>/gi, "<br />")
  }

  processed = applyTextReplacements(processed, replacements)

  // A broad pattern can consume the placeholder tokens themselves. Restoring
  // afterwards would leak an internal token into the document, so the safest
  // result is the untouched original text.
  if (placeholders.some(({ token }) => !processed.includes(token))) return str

  let result = processed
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const { token, value } = placeholders[i]
    result = replaceAllLiteral(result, token, value)
  }

  return result
}

const normalizeText = (
  str,
  {
    applyBr = false,
    collapseMultipleSpaces = false,
    trimTableCellTrailingSpace = false,
    replacements = EMPTY_REPLACEMENTS,
  } = {}
) => {
  // Code spans and MDX comments must survive verbatim, so the <br />
  // normalization and the configured replacements both run through the
  // placeholder-protected path. Table cells rely on this too: their contents
  // are full of code spans that document real values.
  let normalized = applyTextReplacementsSafely(str, { applyBr, replacements })

  if (collapseMultipleSpaces) {
    normalized = builtInTransforms.collapseMultipleSpaces(normalized)
  }

  if (trimTableCellTrailingSpace) {
    normalized = builtInTransforms.tableCellTrailingSpace(normalized)
  }

  return normalized
}

const normalizeTextNodes = (node, replacements = EMPTY_REPLACEMENTS) => {
  if (!node || typeof node !== "object") return

  if (node.type === "text" && typeof node.value === "string") {
    node.value = normalizeText(node.value, { replacements })
  }

  if (node.type === "jsx" && typeof node.value === "string") {
    if (/<table[\s>]/i.test(node.value) && /<\/table>/i.test(node.value)) {
      node.value = normalizeTableBreaks(node.value)
    }
  }

  if (node.type === "html" && typeof node.value === "string") {
    if (isHtmlTable(node.value)) {
      node.value = normalizeTableBreaks(node.value)
    }
  }

  if (node.type === "code" || node.type === "inlineCode") return

  const children = node.children
  if (Array.isArray(children)) {
    children.forEach((child) => normalizeTextNodes(child, replacements))
  }
}

const { parsers: coreParsers, printers: corePrinters } = markdownPlugin
const mdastPrinterOrig = corePrinters.mdast

const parsers = Object.fromEntries(
  Object.entries(coreParsers).map(([name, parser]) => [
    name,
    {
      ...parser,
      parse: async (...args) => {
        const ast = await parser.parse(...args)
        // Prettier passes the resolved options as the last parse argument.
        normalizeTextNodes(ast, getOptionReplacements(args.at(-1)))
        return ast
      },
    },
  ])
)

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
  const node = path.getValue()
  const replacements = getOptionReplacements(options)

  if (
    options.originalText &&
    node?.position?.start?.offset != null &&
    node?.position?.end?.offset != null
  ) {
    const { start, end } = node.position
    const raw = options.originalText.slice(start.offset, end.offset)
    const ranges = getMdxCommentRanges(options.originalText)

    if (isNodeFullyInsideMdxComment(ranges, start.offset, end.offset)) {
      return raw
    }

    const fixed = fixLeakedPipeAfterMdxCommentClose(ranges, start.offset, raw)
    if (fixed !== raw) return fixed
  }

  if (
    node?.type === "tableRow" &&
    options.originalText &&
    node.position?.start?.offset != null &&
    node.position?.end?.offset != null
  ) {
    const { start, end } = node.position
    let raw = options.originalText.slice(start.offset, end.offset)
    raw = raw.replace(/([^|\s])(\s+)(\|)/g, "$1$3")
    return normalizeText(raw, {
      applyBr: true,
      collapseMultipleSpaces: true,
      trimTableCellTrailingSpace: true,
      replacements,
    })
  }

  if (
    node?.type === "tableCell" &&
    options.originalText &&
    node.position?.start?.offset != null &&
    node.position?.end?.offset != null
  ) {
    const { start, end } = node.position
    const raw = unwrapTableCellRaw(
      options.originalText.slice(start.offset, end.offset)
    )
    return normalizeText(raw, {
      applyBr: true,
      collapseMultipleSpaces: true,
      trimTableCellTrailingSpace: true,
      replacements,
    })
  }

  const mdxCommentTargetTypes = [
    "paragraph",
    "heading",
    "text",
    "emphasis",
    "strong",
    "inlineCode",
  ]
  if (
    mdxCommentTargetTypes.includes(node?.type) &&
    options.originalText &&
    node.position?.start?.offset != null &&
    node.position?.end?.offset != null
  ) {
    const { start, end } = node.position
    const raw = options.originalText.slice(start.offset, end.offset)
    if (/\{\/\*|\*\/\}/.test(raw)) {
      return raw
    }
  }

  if (
    (node?.type === "paragraph" || node?.type === "heading") &&
    options.originalText &&
    node.position?.start?.offset != null &&
    node.position?.end?.offset != null
  ) {
    const raw = options.originalText.slice(
      node.position.start.offset,
      node.position.end.offset
    )
    const normalizedRaw = applyTextReplacementsSafely(raw, {
      applyBr: true,
      replacements,
    })
    if (normalizedRaw !== raw) return normalizedRaw
  }

  if (node?.type === "paragraph" && options.originalText) {
    const { start, end } = node.position ?? {}
    if (start?.offset != null && end?.offset != null) {
      const raw = options.originalText.slice(start.offset, end.offset)
      const lines = raw.split("\n")
      const allPipe = lines.every((l) => /^\s*\|/.test(l))
      const hasSeparator = lines.some((l) => /^\s*\|?\s*:?-{3,}:?\s*\|/.test(l))

      if (allPipe && !hasSeparator) {
        return raw
      }
    }
  }

  if (node?.type === "html") {
    const raw = node.value ?? ""
    if (isHtmlTable(raw)) return normalizeTableBreaks(raw)
    const normalized = normalizeText(raw, { applyBr: true, replacements })
    if (normalized !== raw) return normalized
  }

  if (node?.type === "jsx") {
    const raw = getOriginalNodeRaw(node, options) ?? node.value ?? ""
    if (/<table[\s>]/i.test(raw) && /<\/table>/i.test(raw)) {
      return normalizeTableBreaks(raw)
    }
    if (hasFencedCodeBlock(raw)) return raw
  }

  if (node?.type === "text") {
    const normalized = normalizeText(node.value ?? "", { replacements })
    if (normalized !== node.value) return normalized

    const raw = getOriginalNodeRaw(node, options)
    if (raw != null) {
      const normalizedRaw = normalizeText(raw, { replacements })
      if (normalizedRaw !== raw) return normalizedRaw
    }
  }

  if (
    node?.type === "mdxJsxTextElement" ||
    node?.type === "mdxJsxFlowElement"
  ) {
    const raw = getOriginalNodeRaw(node, options)
    if (raw != null) {
      if (node.name === "table") {
        return normalizeTableBreaks(raw)
      }
      if (node.name === "td" || node.name === "th") {
        return normalizeInlineBreaksInCell(raw, node.name)
      }
      if (isHtmlTable(raw)) return normalizeTableBreaks(raw)
      if (hasFencedCodeBlock(raw)) return raw
      return normalizeText(raw, {
        applyBr: true,
        collapseMultipleSpaces: true,
        trimTableCellTrailingSpace: true,
        replacements,
      })
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
    const isCommentRow = (row) =>
      options.originalText &&
      row?.position?.start?.offset != null &&
      row?.position?.end?.offset != null &&
      isNodeFullyInsideMdxComment(
        mdxCommentRanges,
        row.position.start.offset,
        row.position.end.offset
      )

    if (
      rowLengths.some(
        (len, idx) => !isCommentRow(rows[idx]) && len !== headerCount
      )
    ) {
      // Don't try to normalize malformed tables. Preserve the raw text so we
      // don't introduce extra padding pipes/spaces.
      if (
        options.originalText &&
        node.position?.start?.offset != null &&
        node.position?.end?.offset != null
      ) {
        return options.originalText.slice(
          node.position.start.offset,
          node.position.end.offset
        )
      }
      return mdastPrinterOrig.print(path, options, print)
    }
    const align = node.align || []

    const buildRow = (rowIdx) => {
      const row = rows[rowIdx]
      if (
        options.originalText &&
        row?.position?.start?.offset != null &&
        row?.position?.end?.offset != null &&
        isNodeFullyInsideMdxComment(
          mdxCommentRanges,
          row.position.start.offset,
          row.position.end.offset
        )
      ) {
        const raw = options.originalText.slice(
          row.position.start.offset,
          row.position.end.offset
        )
        return fixLeakedPipeAfterMdxCommentClose(
          mdxCommentRanges,
          row.position.start.offset,
          raw
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
    const toDocArray = (doc) => (Array.isArray(doc) ? doc : [doc])

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
    const node = path.getValue()
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
  options: {
    ...(markdownPlugin.options || {}),
    compactTablesReplacements: {
      type: "string",
      array: true,
      default: [{ value: [] }],
      category: "Markdown Compact Tables",
      description:
        'Text replacements applied outside code spans, code blocks and MDX comments. Use "from=>to" for a literal rule or "/pattern/flags=>to" for a regular expression.',
    },
  },
}

export default plugin
