# Zen Scrap

Zenn のスクラップ機能にインスパイアされた Obsidian プラグイン。思いついたことをスレッド形式で時系列に書き溜められる。

## 機能

- スクラップの作成・一覧表示・詳細表示
- エントリの追記（タイムライン形式で時系列表示）
- open / closed のステータス管理
- タグ付け
- エントリ内の Markdown レンダリング
- Cmd/Ctrl+Enter でエントリ投稿

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

## プロジェクト構成

```
src/
├── main.ts              # プラグインのエントリポイント
├── types.ts             # データ型定義
├── scrap-parser.ts      # Markdown との相互変換
├── scrap-repository.ts  # ファイル I/O と CRUD
├── scrap-list-view.ts   # 一覧ビュー
└── scrap-detail-view.ts # 詳細ビュー
```
