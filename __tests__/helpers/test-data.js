// 테이블 포맷팅 테스트 케이스
export const tableTestCases = [
  {
    name: "기본 테이블",
    input: "| A | B |\n| --- | --- |\n| 1 | 2 |",
    expected: "| A | B |\n| --- | --- |\n| 1 | 2 |",
  },
  {
    name: "정렬 테이블",
    input: "| 왼쪽 | 가운데 | 오른쪽 |\n| :-- | :-: | --: |\n| L | C | R |",
    expectedHeaders: [
      "| 왼쪽 | 가운데 | 오른쪽 |",
      "| :-- | :-: | --: |",
      "| L | C | R |",
    ],
  },
  {
    name: "복잡한 테이블",
    input:
      "| 헤더1 | 헤더2<br/>서브 | 헤더3 |\n| --- | --- | --- |\n| **굵게** | `코드` | [링크](url) |",
    expected: "| 헤더1 | 헤더2<br/>서브 | 헤더3 |",
  },
]

// MDX 주석 테스트 케이스
export const mdxCommentTestCases = [
  {
    name: "단일 라인 MDX 주석",
    input: "{/* 이것은 주석입니다 */}",
    expected: "{/* 이것은 주석입니다 */}",
  },
  {
    name: "멀티라인 MDX 주석",
    input: "{/*\n여러 줄\n주석입니다\n*/}",
    expected: "{/*\n여러 줄\n주석입니다\n*/}",
  },
  {
    name: "텍스트와 함께 있는 MDX 주석",
    input: "일반 텍스트\n{/* 주석 */}\n더 많은 텍스트",
    expected: "{/* 주석 */}",
  },
]

// 불완전한 파이프 테이블 테스트 케이스
export const incompletePipeTableTestCases = [
  {
    name: "구분선 없는 파이프 테이블",
    input: "| 헤더1 | 헤더2 |\n| 데이터1 | 데이터2 |",
    expected: "| 헤더1 | 헤더2 |\n| 데이터1 | 데이터2 |",
  },
  {
    name: "공백이 있는 불완전한 테이블",
    input: " | 항목 | 값 |\n | A | B |",
    expected: " | 항목 | 값 |\n | A | B |",
  },
]

// MDX JSX 엘리먼트 테스트 케이스
export const mdxJsxTestCases = [
  {
    name: "MDX JSX 텍스트 엘리먼트",
    input: "<Button>클릭</Button>",
    expected: "<Button>클릭</Button>",
  },
  {
    name: "MDX JSX 플로우 엘리먼트",
    input: '<InfoBox type="note">정보</InfoBox>',
    expected: '<InfoBox type="note">정보</InfoBox>',
  },
]

// 통합 테스트 케이스
export const integrationTestCases = [
  {
    name: "개발자 문서 스타일",
    input: `## API 설명

| 매개변수 | 타입 | 설명 | 필수 |
| --- | --- | --- | --- |
| app_key | String | 앱 REST API 키<br>[애플리케이션] > [API 키]에서 확인 | O |
| user_id | Long | 사용자 ID<br>**주의**: 민감한 정보 | O |

{/* API 호출 예시 */}

\`\`\`json
{
  "status": "success"
}
\`\`\``,
    expectedContains: [
      "| 매개변수 | 타입 | 설명 | 필수 |",
      "<br>",
      "{/* API 호출 예시 */}",
      "```json",
    ],
  },
]
