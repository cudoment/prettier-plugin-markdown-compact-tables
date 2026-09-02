import { describe, it, expect } from "vitest"
import { compile } from "@mdx-js/mdx"
import {
  formatWithPlugin,
  formatWithoutPlugin,
  expectTableStructure,
  expectBrTagNormalization,
  expectMdxCommentPreservation,
  expectTableAlignment,
  expectIncompletePipeTablePreservation,
  expectMdxJsxPreservation,
  readFixture,
} from "./helpers/test-utils.js"
import {
  brTagTestCases,
  tableTestCases,
  mdxCommentTestCases,
  incompletePipeTableTestCases,
  mdxJsxTestCases,
  textNormalizationTestCases,
  integrationTestCases,
  replacementOptions,
} from "./helpers/test-data.js"

describe("prettier-plugin-markdown-compact-tables 종합 테스트", () => {
  describe("1. BR 태그 정규화", () => {
    brTagTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)
        expectBrTagNormalization(result)
        expect(result.trim()).toBe(testCase.expected)
      })
    })
  })

  describe("2. 테이블 포맷팅", () => {
    tableTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)

        // 테이블 구조 검증
        expect(result).toContain("|")
        expectTableAlignment(result)

        // BR 태그가 포함된 경우 정규화 검증
        if (testCase.input.includes("<br")) {
          expectBrTagNormalization(result)
        }

        // 특정 헤더 검증
        if (testCase.expected) {
          expect(result).toContain(testCase.expected.split("\n")[0])
        }

        // 정렬 테이블의 경우 전체 테이블 검증
        if (testCase.expectedHeaders) {
          expectTableStructure(result, testCase.expectedHeaders)
        }
      })
    })

    it("테이블 셀의 끝 공백을 제거해야 함", async () => {
      const input = "| A  | B   |\n| --- | --- |\n| C  | D   |"
      const result = await formatWithPlugin(input)

      expect(result).toContain("| A | B |")
      expect(result).toContain("| C | D |")
      expect(result).not.toContain("| A  | B   |")
    })

    it("테이블 셀의 중복 공백 정리와 코드/태그 보존", async () => {
      const input = `| H | V |
| --- | --- |
| A  B | \`code  span\` <span  class="x">tag</span> &nbsp;  |`

      const result = await formatWithPlugin(input)

      expect(result).toContain("| A B |")
      expect(result).toContain("`code  span`")
      expect(result).toContain('<span  class="x">tag</span>')
      expect(result).toContain("&nbsp;")
    })
  })

  describe("3. MDX 주석 보존", () => {
    mdxCommentTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)
        expectMdxCommentPreservation(result, [testCase.expected])
      })
    })

    it("MDX 주석과 일반 텍스트 혼합", async () => {
      const input = "일반 텍스트\n{/* 주석 */}\n더 많은 텍스트"
      const result = await formatWithPlugin(input)

      expect(result).toContain("일반 텍스트")
      expect(result).toContain("{/* 주석 */}")
      expect(result).toContain("더 많은 텍스트")
      expectMdxCommentPreservation(result, ["{/* 주석 */}"])
    })

    it("테이블 행을 주석 처리한 경우 원문을 보존해야 함", async () => {
      const input = `| 카테고리 상세 | API |
| --- | --- |
{/* | 채널 메시지 | [사용자 정의 템플릿으로 메시지 발송](/docs/latest/ko/channel-message/rest-api) | */}`

      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain(
        "{/* | 채널 메시지 | [사용자 정의 템플릿으로 메시지 발송](/docs/latest/ko/channel-message/rest-api) | */}"
      )
      expect(result).not.toContain("| {/*")
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("MDX 주석 안에 테이블이 있어도 변형되지 않아야 함", async () => {
      const input = `{/* ## 채널 메시지 발송기 (#channel-message-batch)

| 카테고리 상세 | API |
| --- | --- |
| 채널 메시지 발송기 | [메시지 대량 발송](/docs/latest/ko/platform/rest-api#channel-message-broadcast) | */}`

      const result = await formatWithPlugin(input, "mdx")

      // 주석 경계 밖으로 파이프가 새지 않아야 함 (회귀 방지)
      expect(result).not.toContain("*/} |")
      expect(result.trim()).toBe(input)

      // 결과물이 실제 MDX 파서에서도 유효해야 함
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("깨진 `*/} |` 케이스는 자동으로 복구되어야 함", async () => {
      const broken = `{/* ## 채널 메시지 발송기 (#channel-message-batch)

| 카테고리 상세 | API |
| --- | --- |
| 채널 메시지 발송기 | [메시지 대량 발송](/docs/latest/ko/platform/rest-api#channel-message-broadcast) | */} |`

      const fixed = `{/* ## 채널 메시지 발송기 (#channel-message-batch)

| 카테고리 상세 | API |
| --- | --- |
| 채널 메시지 발송기 | [메시지 대량 발송](/docs/latest/ko/platform/rest-api#channel-message-broadcast) | */}`

      const result = await formatWithPlugin(broken, "mdx")

      expect(result).not.toContain("*/} |")
      expect(result.trim()).toBe(fixed)

      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })
  })

  describe("4. 불완전한 파이프 테이블 보존", () => {
    incompletePipeTableTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)
        expectIncompletePipeTablePreservation(result, testCase.input)
      })
    })

    it("컬럼 수 불일치 테이블은 원문 보존", async () => {
      const input = `| A | B |
| --- | --- |
| 1 |`
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
      expect(result).not.toContain("| A   | B   |")
    })

    it("컬럼 수 초과 행도 원문 보존", async () => {
      const input = `| A | B |
| --- | --- |
| 1 | 2 | 3 |`
      const result = await formatWithPlugin(input)

      expect(result.trim()).toBe(input)
    })
  })

  describe("5. MDX JSX 엘리먼트 처리", () => {
    mdxJsxTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input, "mdx")
        expectMdxJsxPreservation(result, [testCase.expected])
      })
    })

    it("MDX JSX table 내부 <br> 정규화", async () => {
      const input =
        "<table><tr><td>값<br>줄</td></tr></table>\n<table><tr><th>헤더<br/>줄</th></tr></table>"
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain("<br />")
      expect(result).not.toContain("<br>")
      expect(result).not.toContain("<br/>")
    })

    it("MDX JSX 일반 요소에서도 중복 공백 정리", async () => {
      const input = "<InfoBox>값  값</InfoBox>"
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain("<InfoBox>값 값</InfoBox>")
    })

    it("MDX JSX 내부 fenced code block 줄바꿈은 보존해야 함", async () => {
      const input = `<Tabs>
  <TabsContent value={"header"} label={'헤더'}>
    \`\`\`
    code영역
    code영역
    code영역
    code영역
    code영역
    \`\`\`
  </TabsContent>
  <TabsContent value={"payload"} label={'페이로드'}>탭제목 2의 컨텐츠</TabsContent>
</Tabs>`
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain(`\`\`\`
    code영역
    code영역
    code영역
    code영역
    code영역
    \`\`\``)
      expect(result).not.toContain("``` code영역")
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })
  })

  describe("6. 텍스트 정규화", () => {
    textNormalizationTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(
          testCase.input,
          testCase.parser ?? "markdown",
          testCase.options ?? {}
        )
        expect(result).toContain(testCase.expected)
      })
    })

    it("인라인 코드와 코드 블록은 정규화 대상이 아님", async () => {
      const input = "동의 항목\n`동의 항목`\n\n```\n동의 항목\n```"
      const result = await formatWithPlugin(
        input,
        "markdown",
        replacementOptions
      )

      expect(result).toContain("동의항목")
      expect(result).toContain("`동의 항목`")
      expect(result).toContain("```\n동의 항목\n```")
    })

    it("이스케이프된 대괄호는 코드/주석 구간을 제외하고만 정규화해야 함", async () => {
      const input = `\\[예시
\`\\\\[코드]\`

\`\`\`
\\\\[펜스]
\`\`\`

{/* \\[주석예시] */}`
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain("[예시")
      expect(result).toContain("`\\\\[코드]`")
      expect(result).not.toContain("`[코드]`")
      expect(result).toContain("```\n\\\\[펜스]\n```")
      expect(result).not.toContain("```\n[펜스]\n```")
      expect(result).toContain("{/* \\[주석예시] */}")
      expect(result).not.toContain("{/* [주석예시] */}")
    })

    it("링크가 함께 있는 본문에서도 이스케이프된 대괄호를 정규화해야 함", async () => {
      const input =
        "On the [app management page](https://developers.example.com/console/app), you can check and modify the basic information registered when [creating a Developers app](../tutorial/start#create) in \\[App] > \\[General] > \\[App basic information]."
      const result = await formatWithPlugin(input, "mdx")

      expect(result).toContain(
        "in [App] > [General] > [App basic information]."
      )
      expect(result).not.toContain("\\[App]")
      expect(result).toContain(
        "[app management page](https://developers.example.com/console/app)"
      )
      expect(result).toContain(
        "[creating a Developers app](../tutorial/start#create)"
      )
    })
  })

  describe("7. 파서 호환성", () => {
    it("마크다운 파서", async () => {
      const input = "| A | B |\n| --- | --- |\n| 1 | 2 |"
      const result = await formatWithPlugin(input, "markdown")
      expectTableStructure(result, ["| A | B |"])
    })

    it("MDX 파서", async () => {
      const input =
        "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n<Button>클릭</Button>"
      const result = await formatWithPlugin(input, "mdx")
      expectTableStructure(result, ["| A | B |"])
      expect(result).toContain("<Button>클릭</Button>")
    })
  })

  describe("8. 통합 시나리오", () => {
    integrationTestCases.forEach((testCase) => {
      it(testCase.name, async () => {
        const result = await formatWithPlugin(testCase.input)

        testCase.expectedContains.forEach((expected) => {
          expect(result).toContain(expected)
        })

        // 종합적인 검증
        if (result.includes("<br")) {
          expectBrTagNormalization(result)
        }
        if (result.includes("{/*")) {
          expectMdxCommentPreservation(result, ["{/* API 호출 예시 */}"])
        }
        if (result.includes("|")) {
          expectTableAlignment(result)
        }
      })
    })
  })

  describe("9. 에지 케이스", () => {
    it("빈 입력", async () => {
      const result = await formatWithPlugin("")
      expect(result.trim()).toBe("")
    })

    it("공백만 있는 입력", async () => {
      const result = await formatWithPlugin("   \n   \n   ")
      expect(result.trim()).toBe("")
    })

    it("복잡한 혼합 콘텐츠", async () => {
      const input = `# 제목

{/* 주석 */}

| 헤더 | 내용<br>서브 |
| --- | --- |
| **굵게** | \`코드\` |

<InfoBox type="note">
정보박스
</InfoBox>

동의 항목 확인`

      const result = await formatWithPlugin(input, "mdx", replacementOptions)

      expect(result).toContain("# 제목")
      expectMdxCommentPreservation(result, ["{/* 주석 */}"])
      expectTableStructure(result, ["| 헤더 | 내용<br />서브 |"])
      expectBrTagNormalization(result)
      expect(result).toContain('<InfoBox type="note">')
      expect(result).toContain("동의항목 확인")
    })

    it("매우 긴 테이블", async () => {
      const longTableInput = `| ${"A".repeat(100)} | ${"B".repeat(100)} |
| --- | --- |
| ${"데이터1".repeat(50)} | ${"데이터2".repeat(50)} |`

      const result = await formatWithPlugin(longTableInput)
      expectTableStructure(result, [
        `| ${"A".repeat(100)} | ${"B".repeat(100)} |`,
      ])
    })
  })

  describe("10. HTML 테이블 정규화", () => {
    it("HTML table 내부 <br> 정규화", async () => {
      const input = "<table><tr><td>a<br>b</td></tr></table>"
      const result = await formatWithPlugin(input, "markdown")

      expect(result).toContain("<br />")
      expect(result).not.toContain("<br>")
      expect(result).not.toContain("<br/>")
    })
  })

  describe("11. 실문서 기반 표 회귀 테스트", () => {
    const realWorldTableFixtures = [
      {
        name: "에러 코드 표의 링크와 장문 셀을 유지해야 함",
        filename: "real-error-code-table.mdx",
        expectedLines: [
          "| Error Code | Status Code | Cause | Solution |",
          "| `-3` | `403` | If the required feature activation (simple sign-up, consent items, service settings, etc.) is not completed or the allow call is not enabled in the [Available APIs](../app-setting/app#admin-key-api) for using this API. | After completing the required settings in the [app management page](https://developers.example.com/console/app), request again. |",
        ],
      },
      {
        name: "앱 설정 표의 강조와 링크를 유지해야 함",
        filename: "real-app-setting-table.mdx",
        expectedLines: [
          "| Setting item | Allowed target | Usage example |",
          "| [Only specific APIs allowed] | Allows calling **only selected APIs** among [Admin key: API category](../reference/admin-key-api). | Use this when you want to separate and control sensitive APIs. |",
        ],
      },
      {
        name: "채널 안내 표의 인라인 코드와 긴 링크를 유지해야 함",
        filename: "real-channel-method-table.mdx",
        expectedLines: [
          "| Implementation method | Method name | Service page retention | Result check |",
          "| [Channel Add](#channel-add) | `addChannel()` | Redirects to the channel page in Messenger via a connection page, and adds the channel **after leaving the service page with user consent** | Requires a separate check via [Retrieve Channel relationship](#status-check-relationship) request |",
        ],
      },
      {
        name: "브라우저 지원 표의 마크다운 이스케이프 성격 문자를 유지해야 함",
        filename: "real-browser-support-table.mdx",
        expectedLines: [
          "| Chrome* | O | O | O | O |",
          "| Internet Explorer (IE) | X | X | X | O** |",
        ],
      },
    ]

    realWorldTableFixtures.forEach((fixture) => {
      it(fixture.name, async () => {
        const input = readFixture(fixture.filename)
        const result = await formatWithPlugin(input, "mdx")

        expect(result.trim()).toBe(input.trim())
        fixture.expectedLines.forEach((line) => {
          expect(result).toContain(line)
        })
      })
    })

    it("기본 Prettier보다 표 셀의 의미 있는 마크다운 문자를 더 잘 보존해야 함", async () => {
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

  describe("12. 실문서 기반 MDX 회귀 테스트", () => {
    it("주석 처리된 JSX 블록은 원문 그대로 보존해야 함", async () => {
      const input = readFixture("commented-jsx-table.mdx")
      const result = await formatWithPlugin(input, "mdx")

      expect(result.trim()).toBe(input.trim())
      expectMdxCommentPreservation(result, ["{/* <Table>"])
      expect(result).toContain(
        "[Android](../social-login/android#login-with-messenger)<br />[iOS](../social-login/ios#login-with-messenger)<br />[Flutter](../social-login/flutter#login-with-messenger)"
      )
      await expect(compile(result, { jsx: true })).resolves.toBeTruthy()
    })

    it("기본 Prettier보다 주석 처리된 JSX 블록을 더 안전하게 보존해야 함", async () => {
      const input = readFixture("commented-jsx-table.mdx")
      const baseResult = await formatWithoutPlugin(input, "mdx")
      const pluginResult = await formatWithPlugin(input, "mdx")

      expect(baseResult).toContain("{/\\* <Table>")
      expect(pluginResult).toContain("{/* <Table>")
      expect(pluginResult.trim()).toBe(input.trim())
      await expect(compile(pluginResult, { jsx: true })).resolves.toBeTruthy()
    })

    it("실문서 형태의 Tabs/DocDataEmbed 구조를 유지해야 함", async () => {
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
  })
})
