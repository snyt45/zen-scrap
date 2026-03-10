# UI改善デザイン: Zennスクラップ風の表示・編集体験

## 概要

Zennのスクラップ画面を参考に、一覧・詳細画面のUIを5項目改善する。
タイムライン表示にzenn-markdown-html + zenn-content-cssを導入し、コードブロック等の見た目をZennと揃える。

## 変更項目

### 1. 一覧のフラット化

- `.zen-scrap-list-item` の `border` を削除
- hover時に `background` のみ変化
- アイテム間は `border-bottom` の薄い線で区切り
- CSSのみの変更

### 2. タイムライン表示をzenn-markdown-htmlに切り替え

- `zenn-markdown-html` と `zenn-content-css` をnpm依存に追加
- `scrap-detail-view.ts` の `renderTimeline` で `MarkdownRenderer.render()` を `markdownToHtml()` に置き換え
- エントリ本文を `<div class="znc">` で囲んで zenn-content-css のスタイルを適用
- コードブロック: シンタックスハイライト + ダーク背景 + 横スクロール + 角丸
- インラインコード: 背景付きpill風

### 3. Markdown/Preview切り替えタブ

- 投稿エリアに「Markdown | Preview」のタブUIを追加
- Markdownタブ: 既存のtextarea
- Previewタブ: `markdownToHtml()` + `znc` クラスでプレビュー表示
- 投稿前にレンダリング結果を確認できる

### 4. エントリの折りたたみ

- 各エントリのヘッダー右端にV字ボタン追加
- クリックでエントリ本文の表示/非表示を切り替え
- 折りたたみ状態はメモリ上のみ（永続化しない）
- デフォルトは展開状態

## 対象外

- コメント・返信機能（ソロ利用のため不要）
- クローズ時のUI変更
