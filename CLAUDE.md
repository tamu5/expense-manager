# CLAUDE.md — 経費管理アプリ 開発ガイド

## 1. 技術スタック

| 技術 | 用途 |
|---|---|
| HTML5 | マークアップ・画面構造 |
| JavaScript (Vanilla) | ロジック・DOM操作（フレームワーク不使用） |
| Tailwind CSS (CDN) | スタイリング（`https://cdn.tailwindcss.com` 経由） |
| localStorage | データ永続化（サーバー・DB・外部API は一切使わない） |

ビルドツール・npm・Node.js は使用しない。ブラウザで `index.html` を直接開けば動く構成にする。

---

## 2. ディレクトリ構成

```
/
├── index.html   # HTML骨格・Tailwind CDN読み込み・スクリプト/スタイルの参照
├── app.js       # 全ロジック（即時実行関数で包む）
└── styles.css   # Tailwindで表現できないカスタムスタイルのみ記述
```

### 各ファイルの責務

- **index.html**: `<head>` の CDN 読み込み、ツーカラムの骨格 HTML、各ペイン・モードの `div` を配置。JS/CSS を参照するだけで実装コードは書かない。
- **app.js**: データ操作（CRUD）・画面切替・イベント登録をすべてここに書く。グローバル汚染を防ぐため即時実行関数 `(function() { ... })()` で全体を包む。
- **styles.css**: Tailwind クラスで賄えないスタイル（スクロールバー、カスタム配色変数など）のみ。原則として最小限に抑える。

---

## 3. コーディング規約

### 画面切替方式

右ペインは3モードを切り替える。それぞれ専用の `div` を用意し、表示する1枚だけ `class="block"` にして他は `class="hidden"` にする。モード切替は `switchPane(mode)` 関数1本で行う。

```
pane-empty   # 何も選んでいない初期状態
pane-detail  # 経費の詳細表示
pane-form    # 登録・編集フォーム
```

### ID 命名規則

- ペイン: `pane-empty` / `pane-detail` / `pane-form`
- 左ペイン要素: `summary-total` / `summary-pending` / `summary-settled` / `search-input` / `btn-new` / `expense-list`
- 詳細ペイン要素: `detail-date` / `detail-category` / `detail-amount` / `detail-memo` / `detail-status` / `btn-edit` / `btn-delete` / `btn-toggle-status`
- フォーム要素: `form-date` / `form-category` / `form-amount` / `form-memo` / `btn-save` / `btn-cancel`
- 経費カード: `card-{id}`（動的生成）

### 関数の長さ

1関数あたり **50行以内** を目安とする。処理が長くなる場合は責務ごとに関数を分割する。

### 変数宣言

- `const` を優先。再代入が必要な場合のみ `let` を使う。
- `var` は使用禁止。

### グローバル汚染禁止

`app.js` の全コードを即時実行関数で包む。

```js
(function () {
  'use strict';
  // ここに全コードを記述
})();
```

### コメント方針

- **なぜ** そうしているかが自明でない箇所にだけコメントを書く。
- 「何をしているか」をコードの繰り返しで説明するコメントは書かない。
- セクション区切りの見出しコメント（`// ── データ操作 ──` 等）は可。

---

## 4. データ構造

### 経費1件のオブジェクト定義

```js
{
  id:        String,   // 自動採番（Date.now() ベース）
  date:      String,   // 経費発生日 "YYYY-MM-DD"
  category:  String,   // "交通費" | "会議費" | "接待費" | "消耗品" | "通信費" | "その他"
  amount:    Number,   // 円（整数、1以上）
  memo:      String,   // 用途・訪問先など（空文字可）
  status:    String,   // "pending"（申請中）| "settled"（精算済）
  createdAt: String,   // ISO 8601 文字列（new Date().toISOString()）
}
```

### localStorage

- **キー**: `expense-records`
- **値**: 上記オブジェクトの配列を `JSON.stringify` した文字列
- 読み出しは `JSON.parse`。未設定の場合は空配列 `[]` をデフォルトとする。

---

## 5. デザイン規約

### 配色

| 用途 | 値 |
|---|---|
| アクセントカラー | `#c15f3c`（Claudeオレンジ） |
| 背景 | 白（`bg-white`） |
| 左ペイン背景 | ごく薄いグレー（`bg-gray-50`） |
| テキスト主色 | `text-gray-800` |
| テキスト補助色 | `text-gray-500` |

### ステータスバッジ

| ステータス | 見た目 |
|---|---|
| `pending`（申請中） | アンバー系（`bg-amber-100 text-amber-700`） |
| `settled`（精算済） | グリーン系（`bg-green-100 text-green-700`） |

### フォント

```css
font-family: "游ゴシック", "Yu Gothic", sans-serif;
```

`index.html` の `<body>` または `styles.css` で指定する。

### レイアウト

- 全体: `flex` のツーカラム、左ペイン幅は `380px` 固定、右ペインは `flex-1`
- 左ペインは縦スクロール可（経費カードが増えた場合）

### 角丸・影

- 角丸: `rounded-lg`（8px）で統一
- 影: `shadow-sm` を基本とし、過度な装飾はしない

### ボタン

- 主要ボタン（保存・新規登録）: アクセントカラー背景、白テキスト
- 副次ボタン（キャンセル・編集）: `bg-white border border-gray-300`
- 危険ボタン（削除）: `bg-red-500 text-white`
- ホバー時は `opacity-90` または対応する `hover:` クラスで視認性を確保

---

## 6. やってはいけないこと

| 禁止事項 | 理由 |
|---|---|
| `npm` / `yarn` / `pnpm` の使用 | ビルドレスが要件 |
| Webpack / Vite / Rollup 等のバンドラ使用 | 同上 |
| React / Vue / Svelte 等のフレームワーク使用 | Vanilla JS が要件 |
| サーバーサイド処理（Node.js サーバー含む） | ブラウザ完結が要件 |
| 外部 API への fetch / XMLHttpRequest | localStorage 完結が要件 |
| `var` の使用 | スコープ事故防止 |
| グローバルスコープへの直接定義 | 即時実行関数で包むこと |
| 1関数50行超え | 可読性・保守性のため分割すること |
