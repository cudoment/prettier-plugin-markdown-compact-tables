import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import prettier from "prettier"
import plugin from "../../index.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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

// 테이블 구조 검증
export function expectTableStructure(result, expectedHeaders) {
  expectedHeaders.forEach((header) => {
    expect(result).toContain(header)
  })
}

// MDX 주석 보존 검증
export function expectMdxCommentPreservation(result, expectedComments) {
  expectedComments.forEach((comment) => {
    expect(result).toContain(comment)
  })
  // HTML 주석으로 변환되지 않았는지 확인
  expect(result).not.toContain("<!--")
  expect(result).not.toContain("-->")
}

// 테이블 정렬 검증
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
    // 테이블 구분선이 존재하고 파이프로 시작하고 끝나는지 확인
    expect(separatorLine.trim()).toMatch(/^\|.*\|$/)
    // 기본 구분자나 정렬 구분자가 포함되어 있는지 확인
    expect(separatorLine).toMatch(/(-{2,}|:--?|--?:)/)
  }
}

// 불완전한 파이프 테이블 보존 검증
export function expectIncompletePipeTablePreservation(result, originalInput) {
  // 원본의 줄바꿈이 보존되었는지 확인
  const originalLines = originalInput.split("\n")
  const resultLines = result.trim().split("\n")

  expect(resultLines.length).toBe(originalLines.length)

  // 모든 줄이 파이프로 시작하는지 확인
  resultLines.forEach((line) => {
    if (line.trim()) {
      expect(line.trim()).toMatch(/^\|/)
    }
  })
}

// 텍스트 정규화 검증
export function expectTextNormalization(result, transformations) {
  Object.entries(transformations).forEach(([original, expected]) => {
    if (result.includes(original)) {
      expect(result).toContain(expected)
    }
  })
}

// MDX JSX 엘리먼트 보존 검증
export function expectMdxJsxPreservation(result, expectedElements) {
  expectedElements.forEach((element) => {
    expect(result).toContain(element)
  })
}

// 테이블 관련 검증 헬퍼들
export function expectValidTableFormat(result) {
  const lines = result.split("\n")
  const tableLines = lines.filter((line) => line.trim().startsWith("|"))

  if (tableLines.length > 0) {
    // 모든 테이블 행이 |로 시작하고 끝나는지 확인
    tableLines.forEach((line) => {
      expect(line.trim()).toMatch(/^\|.*\|$/)
    })
  }
}

// HTML 태그 검증 헬퍼
export function expectHtmlTagsPreserved(result, tags) {
  tags.forEach((tag) => {
    expect(result).toContain(tag)
  })
}

// 테스트 케이스 생성 헬퍼
export function createTestCase(
  name,
  input,
  expectedOutput,
  parser = "markdown",
  options = {}
) {
  return {
    name,
    input,
    expectedOutput,
    parser,
    options,
  }
}

// 여러 테스트 케이스 실행 헬퍼
export async function runTestCases(testCases, testFunction) {
  for (const testCase of testCases) {
    await testFunction(testCase)
  }
}

// 픽스처 기반 테스트 케이스 생성
export function createFixtureTestCase(filename, name = null) {
  const content = readFixture(filename)
  return createTestCase(
    name || `${filename} 처리`,
    content,
    null, // 기대값은 테스트에서 정의
    "markdown"
  )
}

// 성능 테스트 헬퍼
export async function measureFormatTime(content, iterations = 1) {
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    await formatWithPlugin(content)
  }

  const end = performance.now()
  return (end - start) / iterations
}

// 스냅샷 테스트 헬퍼 (선택적으로 사용)
export function createSnapshot(name, result) {
  return {
    name,
    result: result.trim(),
    timestamp: new Date().toISOString(),
  }
}

// 테스트 그룹 생성 헬퍼
export function createTestGroup(name, testCases) {
  return {
    name,
    testCases,
    run: async function (testFunction) {
      await runTestCases(this.testCases, testFunction)
    },
  }
}
