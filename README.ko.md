# prettier-plugin-markdown-compact-tables

[![CI](https://github.com/cspidar/prettier-plugin-markdown-compact-tables/actions/workflows/ci.yml/badge.svg)](https://github.com/cspidar/prettier-plugin-markdown-compact-tables/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Prettier 3](https://img.shields.io/badge/prettier-3.x-1A2B34?logo=prettier&logoColor=F7B93E)](https://prettier.io) [![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)

[English](./README.md) | **한국어**

Markdown과 MDX의 표를 정렬 패딩 없이 압축된 형태로 출력하는 [Prettier](https://prettier.io) 플러그인입니다. Prettier 3의 `markdown`, `mdx` 파서에 적용됩니다.

파이프 양옆의 공백을 한 칸으로 고정하고, 컬럼 너비를 맞추는 정렬 패딩을 넣지 않습니다.

## 목차

- [왜 필요한가](#왜-필요한가)
- [요구 사항](#요구-사항)
- [설치](#설치)
- [설정](#설정)
- [실행](#실행)
- [표 압축](#표-압축)
- [짝이 되는 플러그인](#짝이-되는-플러그인)
- [호환성](#호환성)
- [개발](#개발)
- [라이선스](#라이선스)

## 왜 필요한가

Prettier의 기본 마크다운 프린터는 표가 `printWidth` 안에 들어갈 때 컬럼 너비를 맞춰 셀을 공백으로 채웁니다. 표가 폭 제한을 넘어설 때에만 압축된 형태로 출력합니다. 그래서 문장이 줄바꿈되지 않도록 `printWidth`를 크게 설정하는 문서 프로젝트에서는 모든 표가 정렬 패딩을 받게 됩니다.

셀 안에 `<br />`로 여러 줄을 담고 목록과 코드를 함께 표기하는 표에서는, 그 셀 하나가 표 전체의 폭을 결정합니다. 아래 표는 `send_mode`의 설명만 길고, `title`과 `is_public`의 설명은 다섯 자에 불과합니다.

**작성한 표**

<!-- prettier-ignore -->
```md
| 이름 | 타입 | 설명 | 필수 |
| --- | --- | --- | --- |
| title | `String` | 알림 제목 | O |
| send_mode | `Integer` | 발송 방식<br />- `0`: 즉시 발송<br />- `1`: 예약 발송<br />--예약 시각은 `send_at`으로 전달<br />- `2`: 발송하지 않음<br />**주의**: 생략하면 `0`이 적용됩니다 | X |
| is_public | `Boolean` | 공개 여부 | X |
```

**기본 프린터가 포맷한 결과**

<!-- prettier-ignore -->
```md
| 이름      | 타입      | 설명                                                                                                                                                           | 필수 |
| --------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| title     | `String`  | 알림 제목                                                                                                                                                      | O    |
| send_mode | `Integer` | 발송 방식<br />- `0`: 즉시 발송<br />- `1`: 예약 발송<br />--예약 시각은 `send_at`으로 전달<br />- `2`: 발송하지 않음<br />**주의**: 생략하면 `0`이 적용됩니다 | X    |
| is_public | `Boolean` | 공개 여부                                                                                                                                                      | X    |
```

`title`과 `is_public` 행의 설명 칸이 `send_mode` 설명의 폭까지 공백으로 채워집니다.

**이 플러그인이 포맷한 결과**

<!-- prettier-ignore -->
```md
| 이름 | 타입 | 설명 | 필수 |
| --- | --- | --- | --- |
| title | `String` | 알림 제목 | O |
| send_mode | `Integer` | 발송 방식<br />- `0`: 즉시 발송<br />- `1`: 예약 발송<br />--예약 시각은 `send_at`으로 전달<br />- `2`: 발송하지 않음<br />**주의**: 생략하면 `0`이 적용됩니다 | X |
| is_public | `Boolean` | 공개 여부 | X |
```

**줄 길이 비교**

| 줄 | 기본 프린터 | 이 플러그인 |
| --- | --- | --- |
| 헤더 | 185자 | 21자 |
| 구분선 | 193자 | 25자 |
| `title` 행 | 189자 | 32자 |
| `send_mode` 행 | 154자 | 151자 |
| `is_public` 행 | 189자 | 37자 |

기본 프린터의 글자 수가 줄마다 다른 이유는, 정렬의 기준이 글자 수가 아니라 화면에 표시되는 폭이기 때문입니다. 한글은 한 글자가 두 칸을 차지하므로, 위 다섯 줄의 표시 폭은 193칸으로 모두 같고 글자 수만 서로 다릅니다.

내용은 한 글자도 늘지 않았으나 짧은 줄은 다섯 배에서 아홉 배까지 길어지며, 늘어난 자리는 모두 공백입니다.

리뷰에도 영향을 미칩니다. `send_mode` 설명에 한 문장을 추가하면 컬럼 너비가 다시 계산되므로, 기본 프린터에서는 표의 다섯 줄이 모두 diff에 표시됩니다. 이 플러그인을 적용하면 실제로 수정한 한 줄만 표시됩니다.

## 요구 사항

| 항목 | 버전 |
| --- | --- |
| Node.js | 18 이상 |
| Prettier | 3.0 이상 |

Prettier 3의 모든 마이너 버전을 테스트로 확인했습니다. 자세한 내용은 [호환성](#호환성)에 있습니다.

## 설치

Prettier와 함께 개발 의존성으로 설치합니다.

```sh
# npm
npm install --save-dev prettier prettier-plugin-markdown-compact-tables

# yarn
yarn add --dev prettier prettier-plugin-markdown-compact-tables

# pnpm
pnpm add --save-dev prettier prettier-plugin-markdown-compact-tables
```

이 플러그인은 ESM 전용이므로 `require()`로 불러올 수 없습니다. Prettier 3의 플러그인 로더는 ESM을 그대로 처리하므로 설정 파일에 이름만 적으면 됩니다.

## 설정

[Prettier 설정 파일](https://prettier.io/docs/configuration)의 `plugins`에 패키지 이름을 추가합니다.

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables"]
}
```

패키지로 설치하지 않고 저장소 안에 두고 쓴다면 경로를 지정합니다.

```json
{
  "plugins": ["./tools/prettier-plugin-markdown-compact-tables/index.js"]
}
```

### 권장 설정

이 플러그인은 `printWidth`와 무관하게 표를 항상 압축하므로, 표 때문에 `printWidth`를 조정할 필요가 없습니다. 아래 옵션은 표 주변의 산문을 다루기 위한 것입니다. `overrides`로 적용하면 저장소의 나머지 파일은 기존 방식대로 포맷됩니다.

| 옵션 | 권장 값 | 이유 |
| --- | --- | --- |
| `parser` | `.md`에는 `"markdown"`, `.mdx`에는 `"mdx"` | Prettier가 확장자로 이미 추론하지만, 명시해 두면 무엇을 재정의하는지 분명해집니다 |
| `proseWrap` | `"never"` | 한 문단을 한 줄로 유지하므로, 한 단어를 고쳐도 diff에는 한 줄만 표시됩니다 |
| `printWidth` | `99999` | 그 한 줄이 다시 접히지 않도록 막습니다. 표의 출력 형태에는 영향을 주지 않습니다 |

**Markdown을 쓰는 경우**

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables"],
  "overrides": [
    {
      "files": "*.md",
      "options": {
        "parser": "markdown",
        "printWidth": 99999,
        "proseWrap": "never"
      }
    }
  ]
}
```

**MDX를 쓰는 경우**

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables"],
  "overrides": [
    {
      "files": "*.mdx",
      "options": {
        "parser": "mdx",
        "printWidth": 99999,
        "proseWrap": "never"
      }
    }
  ]
}
```

두 형식을 함께 쓰는 프로젝트는 `overrides`에 두 항목을 모두 넣습니다.

## 실행

```sh
# 전체 파일을 포맷합니다
npx prettier --write .

# 문서만 포맷합니다
npx prettier --write "**/*.{md,mdx}"

# 포맷이 필요한 파일이 있는지 확인만 합니다
npx prettier --check "**/*.{md,mdx}"
```

에디터에서 저장할 때 함께 적용하려면 [Prettier 에디터 연동](https://prettier.io/docs/editors)을 따릅니다. VS Code에서는 [Prettier 확장](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)을 설치하고 다음 설정을 추가합니다.

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "prettier.documentSelectors": ["**/*.mdx"]
}
```

## 표 압축

표 압축에는 별도의 옵션이 없으며, 플러그인을 등록하면 항상 적용됩니다.

### 적용되는 규칙

| 대상 | 동작 |
| --- | --- |
| 파이프 양옆 공백 | 한 칸으로 고정하고, 컬럼 너비를 맞추는 패딩은 넣지 않습니다 |
| 셀 안의 연속된 ASCII 공백 | 한 칸으로 축약합니다 |
| 셀 안 유니코드 공백 | 줄바꿈 없는 공백과 전각 공백은 셀 끝에 있어도 내용으로 보고 그대로 둡니다 |
| 셀 끝의 ASCII 공백 | 제거합니다 |
| 정렬 지정 | `:--`, `:-:`, `--:`를 그대로 유지합니다 |

줄바꿈 태그와 셀 안의 문구는 원문 그대로 둡니다. 그런 보정은 별개의 관심사이며 [짝이 되는 플러그인](#짝이-되는-플러그인)이 담당합니다.

### 원문을 유지하는 경우

자동으로 교정하다가 표 구조를 깨뜨리는 것보다, 원문을 유지하는 편이 안전합니다. 다음 경우에는 손대지 않습니다.

- 인라인 코드 안의 내용. 공백과 태그 표기를 원문대로 유지합니다.
- 구분선이 없어서 표로 해석되지 않는 파이프 줄
- 헤더와 컬럼 수가 맞지 않는 표
- MDX 주석 `{/* ... */}` 안에 있는 표
- 코드 블록을 담고 있는 MDX/JSX 요소

### 프린터가 유일하게 손대는 복구

MDX 주석 안에 쓴 마크다운 표는 포맷을 거치면서 닫는 줄이 `*/} |` 형태로 나올 수 있습니다. 이 남은 파이프는 유효한 MDX가 아니어서 다음 번 파싱이 실패하므로, 프린터가 `*/}`로 되돌립니다.

배치 이외의 것을 바꾸는 곳은 여기뿐이며, 조건을 좁게 잡았습니다. 원문에서 찾은 주석 구간과 대조해 실제 주석의 닫는 위치에 붙은 파이프일 때에만, 그리고 행의 끝에서만 제거합니다. 저자가 쓴 내용을 고치는 것이 아니라 포맷터가 만들어 낸 손상을 복구하는 동작입니다. 이 복구가 없으면 한 번 포맷한 문서가 다시 파싱되지 않을 수 있습니다.

## 짝이 되는 플러그인

이 플러그인은 표를 어떻게 출력할지만 정합니다. 셀 안의 문구는 절대 바꾸지 않습니다.

표기를 바로잡거나 `<br>`와 `<br />` 중 하나로 통일하는 일은 [`prettier-plugin-markdown-replacements`](https://github.com/cspidar/prettier-plugin-markdown-replacements)가 담당합니다. 두 플러그인은 서로 독립적이어서 각각 단독으로도 동작하며, 함께 쓸 수도 있습니다.

Prettier는 한 언어에 파서를 하나만 쓰는데 두 플러그인이 모두 파서를 제공하므로, **치환 플러그인을 반드시 마지막에 두어야 합니다.** 앞에 두면 규칙이 조용히 무시됩니다.

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables", "prettier-plugin-markdown-replacements"],
  "markdownReplacements": ["어플리케이션=>애플리케이션"]
}
```

## 호환성

| Prettier | 상태 |
| --- | --- |
| 3.0 ~ 3.9 | 지원합니다. 3.0.3, 3.1.1, 3.2.5, 3.3.3, 3.4.2, 3.5.3, 3.6.2, 3.7.4, 3.8.1, 3.8.5, 3.9.0, 3.9.6에서 전체 테스트가 통과합니다 |

Prettier 3.9에서 `tableCell`의 위치 정보가 파이프를 포함하도록 바뀌었으며, 플러그인이 이를 처리합니다. 테스트 스위트가 지원하는 모든 버전에서 같은 출력이 나오는지 확인합니다.

Prettier 4 시험판은 선언된 peer dependency 범위 밖에 있으며 테스트하지 않았습니다.

파서는 Prettier에 내장된 `markdown`과 `mdx`를 모두 지원합니다. 이 플러그인은 내장 마크다운 플러그인의 프린터를 감싸는 방식으로 동작하므로, 표와 관련되지 않은 출력은 Prettier의 기본 동작을 그대로 따릅니다.

## 개발

```sh
# 의존성을 설치합니다
npm install

# 테스트를 한 번 실행합니다
npm run test:run

# 파일을 감시하면서 테스트를 실행합니다
npm test

# 이 저장소의 문서를 포맷합니다
npm run format
```

테스트는 [Vitest](https://vitest.dev)로 작성되어 있으며 `__tests__/`에 있습니다. `__tests__/fixtures/`에는 실제 문서에서 가져온 MDX 조각이 들어 있어서, 표 구조가 깨지지 않는지 확인하는 근거가 됩니다.

`.github/workflows/ci.yml`의 GitHub Actions 워크플로는 같은 테스트를 Node.js 18, 20, 22에서 실행하고, 지원하는 Prettier 마이너 버전마다 한 번씩 더 실행합니다.

## 라이선스

[MIT](./LICENSE)
