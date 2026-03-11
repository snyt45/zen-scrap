# UI/UX改善設計

Zennのスクラップ画面を参考にUI/UXを磨く。

## 1. エディタのテキストエリア改善

- min-height: 200px（現在100pxから拡大、Zenn準拠）
- JSでinput時にauto-grow、max-height: 500px でスクロールに切替
- resize: vertical は維持

## 2. マークダウンガイド

- docs/markdown-guide.md を作成（全パターン網羅 + 独自埋め込み記法）
- エディタのタブバー（Markdown/Previewの横）に「Markdownガイド」リンク追加（Zennと同じ配置）
- クリックでObsidian上でファイルを開く

## 3. カード幅制限 + フルスクリーン切替

- 一覧: max-width: 840px + margin: 0 auto
- 詳細: デフォルト max-width: 780px + margin: 0 auto
- 詳細ヘッダーにフルスクリーントグルボタン（クリックで max-width: 100% に切替）
- 値はZenn実測値に準拠

## 4. アクションボタンのpill化 + ファイル削除

- ステータストグル、JSONコピー、ファイルを開く、ファイル削除を1つのpillグループに
- 横並びで区切り線で分割するセグメントスタイル
- ファイル削除は確認ダイアログ付き、赤色で視覚的に区別

## 5. マークダウンレンダラー（方針B: data-theme同期）

- コンテナに data-theme="dark" / data-theme="light" をObsidianのテーマと同期
- zenn-content-cssのダークテーマ変数が全て有効になる
- 既存の .theme-dark での橋渡しCSS（インラインコード背景）は不要になるので削除

## 6. CSS整理

- styles.app.css のセクションコメントを統一・整理
- 構成:
  1. アプリUI（一覧・詳細・エディタ）
  2. 独自コンポーネント（埋め込みカード、コピーボタン）
  3. znc上書き（Obsidian環境適応）--- 1箇所にまとめる
- ファイル分割はしない（944行程度なのでセクションコメントで十分）
