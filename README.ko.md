# prettier-plugin-markdown-compact-tables

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![Prettier 3.5 ~ 3.8](https://img.shields.io/badge/prettier-3.5%20~%203.8-1A2B34?logo=prettier&logoColor=F7B93E)](https://prettier.io) [![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18-5FA04E?logo=node.js&logoColor=white)](https://nodejs.org)

[English](./README.md) | **한국어**

Markdown과 MDX의 표를 정렬 패딩 없이 압축된 형태로 출력하는 [Prettier](https://prettier.io) 플러그인입니다. Prettier 3의 `markdown`, `mdx` 파서에 적용되며 두 가지 일을 합니다.

- **표 압축**: 파이프 양옆의 공백을 한 칸으로 고정하고, 컬럼 너비를 맞추는 정렬 패딩을 넣지 않습니다.
- **단어 보정**: 자주 틀리는 표기를 문자열이나 정규식으로 등록해 두면 저장할 때 함께 보정합니다.

## 목차

- [왜 필요한가](#왜-필요한가)
- [요구 사항](#요구-사항)
- [설치](#설치)
- [설정](#설정)
- [실행](#실행)
- [표 압축](#표-압축)
- [단어 보정](#단어-보정)
- [옵션](#옵션)
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

내용은 한 글자도 늘지 않았으나 짧은 줄의 길이가 여섯 배 가까이 늘어나며, 추가된 자리는 모두 공백입니다.

리뷰에도 영향을 미칩니다. `send_mode` 설명에 한 문장을 추가하면 컬럼 너비가 다시 계산되므로, 기본 프린터에서는 표의 다섯 줄이 모두 diff에 표시됩니다. 이 플러그인을 적용하면 실제로 수정한 한 줄만 표시됩니다.

## 요구 사항

| 항목 | 버전 |
| --- | --- |
| Node.js | 18 이상 |
| Prettier | 3.5.3 이상 3.9.0 미만 |

Prettier 3.9부터는 표 출력이 어긋납니다. 자세한 내용은 [호환성](#호환성)에 있습니다.

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

이 플러그인은 `printWidth`와 무관하게 표를 항상 압축하므로, 표 때문에 `printWidth`를 조정할 필요가 없습니다. 산문이 줄바꿈되지 않기를 원한다면 Markdown과 MDX에만 다음 설정을 적용합니다.

```json
{
  "plugins": ["prettier-plugin-markdown-compact-tables"],
  "compactTablesReplacements": ["어플리케이션=>애플리케이션", "메세지=>메시지"],
  "overrides": [
    {
      "files": "*.md",
      "options": {
        "parser": "markdown",
        "printWidth": 99999,
        "proseWrap": "never"
      }
    },
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

`proseWrap: "never"`는 한 문단을 한 줄로 유지합니다. `printWidth`를 크게 잡는 것은 그 문단이 다시 접히지 않도록 하기 위한 설정이며, 표의 출력 형태에는 영향을 주지 않습니다.

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
| 셀 안 연속 공백 | 한 칸으로 축약합니다 |
| 셀 끝 공백 | 제거합니다 |
| 정렬 지정 | `:--`, `:-:`, `--:`를 그대로 유지합니다 |
| 셀 안 줄바꿈 태그 | 표기 형태와 무관하게 `<br />`로 통일합니다 |

`<br>`, `<br/>`, `<BR>`, `<br >`는 모두 `<br />`로 바뀝니다.

### 원문을 유지하는 경우

자동으로 교정하다가 표 구조를 깨뜨리는 것보다, 원문을 유지하는 편이 안전합니다. 다음 경우에는 손대지 않습니다.

- 인라인 코드 안의 내용. 공백과 태그 표기를 원문대로 유지합니다.
- 구분선이 없어서 표로 해석되지 않는 파이프 줄
- 헤더와 컬럼 수가 맞지 않는 표
- MDX 주석 `{/* ... */}` 안에 있는 표
- 코드 블록을 담고 있는 MDX/JSX 요소

## 단어 보정

자주 틀리는 표기를 `compactTablesReplacements`에 등록하면 저장할 때 함께 보정합니다. 기본값이 비어 있으므로, 규칙을 등록하지 않으면 치환을 수행하지 않습니다.

**설정**

<!-- prettier-ignore -->
```json
{
  "compactTablesReplacements": ["어플리케이션=>애플리케이션", "메세지=>메시지"]
}
```

**적용 전**

<!-- prettier-ignore -->
```md
어플리케이션에서 메세지를 발송합니다.

| 필드 | 설명 |
| --- | --- |
| `메세지` | 메세지 상태 |
```

**적용 후**

<!-- prettier-ignore -->
```md
애플리케이션에서 메시지를 발송합니다.

| 필드 | 설명 |
| --- | --- |
| `메세지` | 메시지 상태 |
```

본문과 표 셀의 문장은 보정하지만, 코드 표기로 감싼 값은 원문대로 유지합니다.

### 규칙 형식

| 형식 | 예시 | 동작 |
| --- | --- | --- |
| 문자열 | `메세지=>메시지` | 문자열을 그대로 비교하고, 등장하는 모든 위치를 바꿉니다 |
| 정규식 | `/최대 ([0-9]+)개/g=>최대: $1개` | `/패턴/플래그` 형식으로 쓰고, `$1` 같은 캡처 참조를 쓸 수 있습니다 |

위 정규식을 등록하면 `최대 50개`가 `최대: 50개`로 치환됩니다. `g` 플래그는 생략해도 자동으로 적용되므로, 등장하는 모든 위치가 치환됩니다.

### 공통 사항

- 인라인 코드, 코드 블록, MDX 주석 안은 두 형식 모두 치환하지 않습니다. API가 실제로 반환하는 값처럼 원문을 유지해야 하는 문자열은 코드 표기로 감싸 두면 보호됩니다.
- 앞뒤 공백을 다듬지 않으므로 공백까지 규칙에 포함됩니다.
- 구분자는 문자열 형식에서는 처음 나오는 `=>`, 정규식 형식에서는 플래그 뒤의 `=>`입니다. 바꿀 문자열에는 `=>`가 들어갈 수 있습니다.
- 여러 규칙은 배열 순서대로 이어서 적용됩니다. 앞 규칙의 결과가 뒤 규칙의 입력이 됩니다.
- 구분자가 없는 항목, 좌변이 빈 항목, 문법이 잘못된 정규식은 무시합니다. `/`로 시작하지만 정규식 형식이 아니면 문자열 규칙으로 처리하므로, `/docs/guide=>/docs/tutorial`처럼 경로를 치환하는 규칙도 정상적으로 동작합니다.
- 정규식은 문단과 셀 단위로 실행되므로 범위를 좁게 지정해야 합니다. `/[A-Za-z_]+/`처럼 범위가 넓은 패턴은 내부에서 사용하는 보호 표시자까지 치환하므로, 해당 문단에는 치환을 적용하지 않습니다.

### 항상 적용되는 보정

옵션과 무관하게, 이스케이프된 대괄호 `\[`를 `[`로 되돌립니다. 이 보정도 인라인 코드, 코드 블록, MDX 주석 안에는 적용하지 않습니다.

## 옵션

| 옵션 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `compactTablesReplacements` | `string[]` | `[]` | 코드 스팬, 코드 블록, MDX 주석 밖의 텍스트에 적용할 치환 규칙입니다. `"from=>to"`는 문자열 규칙, `"/pattern/flags=>to"`는 정규식 규칙입니다 |

명령줄에서도 지정할 수 있습니다.

```sh
npx prettier --write "**/*.md" --compact-tables-replacements "메세지=>메시지"
```

## 호환성

| Prettier | 상태 |
| --- | --- |
| 3.5.3 ~ 3.8.x | 지원합니다. 테스트 73건이 모두 통과합니다 |
| 3.9.0 이상 | 지원하지 않습니다. 표 출력이 어긋납니다 |

`peerDependencies`가 `>=3.5.3 <3.9.0`으로 지정되어 있으므로, 패키지 매니저가 지원하지 않는 조합을 경고합니다.

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

## 라이선스

[MIT](./LICENSE)
