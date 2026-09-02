import { describe, it, expect } from "vitest"
import prettier from "prettier"
import { formatWithPlugin } from "./helpers/test-utils.js"

describe("prettier-plugin-markdown-compact-tables 핵심 기능 단위 테스트", () => {
  describe("정규화 함수 테스트", () => {
    it("BR 태그 정규화", async () => {
      const testCases = [
        { input: "<br>", expected: "<br />" },
        { input: "<br/>", expected: "<br />" },
        { input: "<BR>", expected: "<br />" },
        { input: "<br >", expected: "<br />" },
      ]

      for (const testCase of testCases) {
        const result = await formatWithPlugin(testCase.input)
        expect(result).toContain(testCase.expected)
        expect(result).not.toContain(testCase.input)
      }
    })

    it("표 셀 안 코드 스팬의 BR 표기는 보존", async () => {
      const input = "| A | B |\n| --- | --- |\n| `<br>` | 값<br>줄 |"
      const result = await formatWithPlugin(input)

      expect(result).toContain("`<br>`")
      expect(result).toContain("값<br />줄")
    })

    it("이스케이프된 대괄호 정규화", async () => {
      const result = await formatWithPlugin("\\[예시")
      expect(result).toContain("[예시")
    })
  })

  describe("단어 치환 옵션", () => {
    const withReplacements = (entries) => ({
      compactTablesReplacements: entries,
    })

    it("옵션이 없으면 단어 치환을 하지 않는다", async () => {
      const result = await formatWithPlugin("동의 항목을 확인하세요")
      expect(result).toContain("동의 항목을 확인하세요")
    })

    it("본문과 표 셀에 모두 적용된다", async () => {
      const input = `| 동의 항목 | 값 |
| --- | --- |
| 동의 항목 | 1 |

동의 항목을 확인하세요`
      const result = await formatWithPlugin(
        input,
        "markdown",
        withReplacements(["동의 항목=>동의항목"])
      )

      expect(result).toContain("| 동의항목 | 값 |")
      expect(result).toContain("| 동의항목 | 1 |")
      expect(result).toContain("동의항목을 확인하세요")
      expect(result).not.toContain("동의 항목")
    })

    it("치환할 문자열 안에 구분자가 있으면 첫 구분자만 기준으로 삼는다", async () => {
      const result = await formatWithPlugin(
        "화살표",
        "markdown",
        withReplacements(["화살표=>a=>b"])
      )
      expect(result).toContain("a=>b")
    })

    it("구분자가 없거나 좌변이 빈 항목은 무시한다", async () => {
      const result = await formatWithPlugin(
        "구분자없음 좌변없음 정상",
        "markdown",
        withReplacements(["구분자없음", "=>좌변없음", "정상=>치환됨"])
      )

      expect(result).toContain("구분자없음")
      expect(result).toContain("좌변없음")
      expect(result).toContain("치환됨")
    })

    it("여러 규칙은 등록한 순서대로 이어서 적용된다", async () => {
      const result = await formatWithPlugin(
        "가나다 중 첫 글자",
        "markdown",
        withReplacements(["가나다=>나다가", "나다가=>다가나"])
      )
      expect(result).toContain("다가나")
    })

    it("표 셀 안 코드 스팬은 치환하지 않는다", async () => {
      const input =
        "| 이름 | 설명 |\n| --- | --- |\n| `동의 항목` | 동의 항목 확인 |"
      const result = await formatWithPlugin(
        input,
        "markdown",
        withReplacements(["동의 항목=>동의항목"])
      )

      expect(result).toContain("| `동의 항목` | 동의항목 확인 |")
    })

    it("인라인 코드와 코드 블록은 치환하지 않는다", async () => {
      const input = "동의 항목\n`동의 항목`\n\n```\n동의 항목\n```"
      const result = await formatWithPlugin(
        input,
        "markdown",
        withReplacements(["동의 항목=>동의항목"])
      )

      expect(result).toContain("`동의 항목`")
      expect(result).toContain("```\n동의 항목\n```")
    })
  })

  describe("정규식 치환 규칙", () => {
    const withReplacements = (entries) => ({
      compactTablesReplacements: entries,
    })

    it("정규식 형식과 캡처 그룹을 지원한다", async () => {
      const result = await formatWithPlugin(
        "버전 3과 버전 11 기준입니다",
        "markdown",
        withReplacements(["/버전 ([0-9]+)/g=>v$1"])
      )
      expect(result).toContain("v3과 v11 기준입니다")
    })

    it("g 플래그가 없으면 자동으로 붙여 모든 위치를 바꾼다", async () => {
      const result = await formatWithPlugin(
        "가가가",
        "markdown",
        withReplacements(["/가/=>나"])
      )
      expect(result).toContain("나나나")
    })

    it("다른 플래그도 그대로 쓴다", async () => {
      const result = await formatWithPlugin(
        "Api와 api 표기",
        "markdown",
        withReplacements(["/api/gi=>API"])
      )
      expect(result).toContain("API와 API 표기")
    })

    it("코드 스팬은 정규식 치환에서도 보호된다", async () => {
      const input =
        "| 이름 | 설명 |\n| --- | --- |\n| `최대 50개` | 최대 50개 |"
      const result = await formatWithPlugin(
        input,
        "markdown",
        withReplacements(["/최대 ([0-9]+)개/g=>최대: $1개"])
      )
      expect(result).toContain("| `최대 50개` | 최대: 50개 |")
    })

    it("슬래시로 시작하지만 정규식이 아닌 항목은 문자열 규칙으로 처리한다", async () => {
      const result = await formatWithPlugin(
        "경로는 /docs/guide 입니다",
        "markdown",
        withReplacements(["/docs/guide=>/docs/tutorial"])
      )
      expect(result).toContain("/docs/tutorial")
    })

    it("문법이 잘못된 정규식은 무시한다", async () => {
      const result = await formatWithPlugin(
        "정상 문장",
        "markdown",
        withReplacements(["/a**/g=>x", "정상=>올바른"])
      )
      expect(result).toContain("올바른 문장")
    })

    it("보호 구간까지 삼키는 넓은 패턴은 해당 문단을 그대로 둔다", async () => {
      const result = await formatWithPlugin(
        "값 `code` 사이",
        "markdown",
        withReplacements(["/[A-Za-z_]+/g=>X"])
      )
      expect(result).toContain("값 `code` 사이")
    })
  })

  describe("파서 전처리 테스트", () => {
    it("MDX 주석 임시 변환", async () => {
      const input = "{/* 테스트 주석 */}"
      const result = await formatWithPlugin(input)

      expect(result).toContain("{/* 테스트 주석 */}")
      expect(result).not.toContain("<!--")
      expect(result).not.toContain("-->")
    })
  })

  describe("프린터 핵심 로직 테스트", () => {
    it("테이블 정렬 처리", async () => {
      const input =
        "| 왼쪽 | 가운데 | 오른쪽 |\n| :-- | :-: | --: |\n| A | B | C |"
      const result = await formatWithPlugin(input)

      expect(result).toContain(":--")
      expect(result).toContain(":-:")
      expect(result).toContain("--:")
    })

    it("불완전한 파이프 테이블 보존", async () => {
      const input = "| 헤더1 | 헤더2 |\n| 데이터1 | 데이터2 |"
      const result = await formatWithPlugin(input)

      // 원본 형태가 보존되어야 함 (구분선이 없으므로)
      expect(result.trim()).toBe(input)
    })

    it("MDX JSX 엘리먼트 보존", async () => {
      const input = '<Button type="primary">클릭하세요</Button>'
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain('<Button type="primary">클릭하세요</Button>')
    })
  })

  describe("성능 및 안정성 테스트", () => {
    it("대용량 테이블 처리", async () => {
      const largeTable = Array(100)
        .fill(0)
        .map((_, i) => `| 데이터${i} | 값${i} |`)
        .join("\n")
      const input = "| 헤더1 | 헤더2 |\n| --- | --- |\n" + largeTable

      const result = await formatWithPlugin(input)
      expect(result).toContain("| 헤더1 | 헤더2 |")
      expect(result).toContain("| 데이터99 | 값99 |")
    })

    it("특수 문자 처리", async () => {
      const input = "| 특수문자 | 값 |\n| --- | --- |\n| & < > \" ' | 테스트 |"
      const result = await formatWithPlugin(input)

      expect(result).toContain("| 특수문자 | 값 |")
      expect(result).toContain("| & < > \" ' | 테스트 |")
    })
  })

  describe("회귀 테스트", () => {
    it("인라인 코드 공백 보존", async () => {
      const input = `| A | B |
| --- | --- |
| \`a  b\` | c |`
      const result = await formatWithPlugin(input)
      expect(result).toContain("`a  b`")
    })

    it("플레이스홀더 충돌 방지", async () => {
      const input = `| H | V |
| --- | --- |
| \`__TAG_0__\` <span>hi</span> | ok |`
      const result = await formatWithPlugin(input)
      expect(result).toContain("`__TAG_0__`")
      expect(result).toContain("<span>hi</span>")
    })

    it("비교 연산자와 BR 태그가 함께 있어도 인라인 코드 플레이스홀더가 복구된다", async () => {
      const input = `| H | V |
| --- | --- |
| \`-1435\` < reminder value <= \`43200\` <br />next | ok |`
      const result = await formatWithPlugin(input)

      expect(result).toContain("`-1435`")
      expect(result).toContain("`43200`")
      expect(result).not.toContain("__COMPACT_TABLES_PLACEHOLDER_")
    })

    it("컬럼 수 불일치 테이블은 원문 보존", async () => {
      const input = `| A | B |
| --- | --- |
| 1 |`
      const withPlugin = await formatWithPlugin(input)
      expect(withPlugin.trim()).toBe(input)
    })
  })
})
