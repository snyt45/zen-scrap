# Zen Scrap

[Zenn のスクラップ機能](https://zenn.dev/scraps)にインスパイアされた Obsidian プラグイン。思いついたことをスレッド形式で時系列に書き溜められる。

## インストール

### 手動インストール

1. [Releases](https://github.com/snyt45/zen-scrap/releases) から最新の `main.js`、`styles.css`、`manifest.json` をダウンロード
2. Vault の `.obsidian/plugins/zen-scrap/` フォルダを作成し、3ファイルを配置
3. Obsidian を再起動して「設定 > コミュニティプラグイン」から Zen Scrap を有効化

## 使い方

### スクラップを開く

- サイドバーのメッセージアイコンをクリック
- コマンドパレットから「Open Zen Scrap」を実行

### スクラップの作成

一覧画面の「新規スクラップ」ボタンからタイトルを入力して作成する。

### エントリの投稿

詳細画面下部のテキストエリアにMarkdownを書いて「投稿する」をクリック。`Cmd/Ctrl + Enter` でも投稿できる。

### Markdownエディタ

- Markdown / Preview タブで編集とプレビューを切り替え
- 「Markdownガイド」リンクから対応記法の一覧を確認できる
- 「画像」ボタンで画像をアップロード（`Scraps/images/` に保存される）
- 「+ 埋め込み」ボタンから外部コンテンツを挿入

### 埋め込み記法

エディタの「+ 埋め込み」ボタンから挿入するか、直接記法を書く。

```
@[tweet](https://x.com/ユーザー名/status/ツイートID)
@[youtube](https://youtu.be/動画ID)
@[card](https://example.com/記事URL)
@[github](https://github.com/owner/repo/blob/branch/path/to/file.ts#L10-L20)
```

### ステータス管理

スクラップには3つの状態がある。

| ステータス | 説明 |
| --- | --- |
| Open | 作業中。作成時のデフォルト |
| Closed | 完了・終了。詳細画面の「操作」メニューから切り替え |
| Archived | 非表示。一覧のメニューからアーカイブする。一覧のフィルターを「Archived」にすると表示される |

### 一覧画面の操作

- 公開状態フィルター（All / Open / Closed / Archived）
- 並び替え（作成日 / 更新日）
- 全文検索
- 各スクラップのメニューからアーカイブ・削除

### 詳細画面の操作

- 「操作」ドロップダウンからクローズ/オープン切替、JSONコピー、ファイルを開く、削除
- タイトル横の編集アイコンでタイトル変更
- 各エントリの編集・削除

## データの保存形式

スクラップは Vault 内の `Scraps/` フォルダに Markdown ファイルとして保存される。frontmatter にメタ情報、本文にエントリが `### タイムスタンプ` + `---` 区切りで並ぶ構造。

```markdown
---
title: スクラップタイトル
status: open
tags: [react, frontend]
created: 2026-03-10T14:00:00.000Z
updated: 2026-03-10T14:30:00.000Z
archived: false
---

### 2026-03-10 14:00

最初のエントリ

---

### 2026-03-10 14:30

追加のエントリ

---
```

通常の Markdown ファイルなので、他のエディタやツールからも読み書きできる。

## 開発

### セットアップ

```bash
npm install
```

### 開発モード

```bash
npm run dev
```

`.env` に `OBSIDIAN_PLUGIN_DIR` を設定しておくと、ビルド成果物がプラグインディレクトリへ自動コピーされる。

```
OBSIDIAN_PLUGIN_DIR=/path/to/vault/.obsidian/plugins/zen-scrap
```

### ビルド

```bash
npm run build
```

`main.js` と `styles.css` が生成される。`manifest.json` と合わせた3ファイルがプラグインの配布物。

### プロジェクト構成

```
src/
├── main.ts                    # プラグインのエントリポイント
├── assets.d.ts                # 静的アセット(md, png)のimport型定義
├── data/
│   ├── types.ts               # データ型定義
│   ├── scrap-parser.ts        # Markdownとの相互変換
│   └── scrap-repository.ts    # ファイルI/OとCRUD
├── events/
│   ├── constants.ts           # イベント名定数
│   ├── event-bus.ts           # イベントバス
│   ├── nav-handlers.ts        # 画面遷移ハンドラ
│   └── scrap-handlers.ts      # スクラップ操作ハンドラ
├── ui/
│   ├── title-prompt-modal.ts  # タイトル入力モーダル
│   ├── embed-modal.ts         # 埋め込みURL入力モーダル
│   └── embed-renderer.ts      # 埋め込みコンテンツのレンダリング
└── views/
    ├── scrap-list-view.ts     # 一覧ビュー
    └── scrap-detail-view.ts   # 詳細ビュー
docs/
└── markdown-guide.md          # Markdownガイド（ビルド時にバンドル）
assets/
└── sample.png                 # ガイド用サンプル画像（ビルド時にバンドル）
```

### 技術スタック

- TypeScript + esbuild
- [zenn-markdown-html](https://github.com/zenn-dev/zenn-editor) でMarkdownレンダリング
- Obsidian Plugin API
