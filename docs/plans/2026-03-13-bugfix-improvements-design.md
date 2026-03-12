# バグ修正・改善 設計ドキュメント

## 概要

5つのバグ修正・改善を行う。

## 1. README に Cmd+Enter ショートカットの説明追加

Markdownエディタセクションに `Cmd/Ctrl + Enter` でポスト・更新できる旨を追記する。

対象ファイル: `README.md`

## 2. 全画面表示の不具合修正

症状: 全画面表示ボタンが反応しないときがある、全画面にした後に戻せない。

原因候補:
- ボタンのクリック領域が小さい（padding 4px 8px、SVGアイコンのみ）
- 状態管理がクロージャベースで、render()を経由していないため不整合が起きうる

修正方針:
- 全画面トグルを `render()` 経由にして状態管理を一元化
- ボタンのpadding を増加してクリック領域を拡大

対象ファイル: `src/views/detail/header-renderer.ts`, `styles.app.css`

## 3. Obsidian [[]] リンクのクリック移動

症状: [[]] リンクが表示されるがクリックしてもノートに移動しない。

原因候補:
- zenn-markdown-html が生成するリンクのデフォルト動作が先に走っている
- イベント伝搬が止められていない

修正方針:
- `addLinkHandler` で obsidian:// リンクのクリック時に `e.stopPropagation()` を追加
- 念のためリンクの `target` 属性を確認し、必要に応じて除去

対象ファイル: `src/views/detail/markdown-renderer.ts`

## 4. 画像ドラッグ&ドロップで挿入後すぐ消える

症状: テキストエリアに画像をドロップすると一瞬挿入されるが消える。

原因: `drop` イベントで `e.stopPropagation()` がないため、Obsidian本体のドロップハンドラが発火して textarea を上書き。

修正方針: `e.stopPropagation()` を追加する。

対象ファイル: `src/views/detail/input-area-renderer.ts`

## 5. エントリ並べ替えボタンの外出し

症状: ドロップダウンメニュー内の上下移動は連続操作しにくい。

修正方針:
- エントリヘッダーに常時表示の上下矢印アイコンボタンを追加
- muted色で控えめ表示、ホバーで通常色
- 先頭エントリは上ボタン非表示、末尾は下ボタン非表示
- ドロップダウンメニューから「上へ移動」「下へ移動」を削除

対象ファイル: `src/views/detail/timeline-renderer.ts`, `src/icons.ts`, `styles.app.css`
