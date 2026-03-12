# Zen Scrap

[Zenn のスクラップ機能](https://zenn.dev/scraps)にインスパイアされた Obsidian プラグイン。思いついたことをスレッド形式で時系列に書き溜められる。

## インストール

1. [Releases](https://github.com/snyt45/zen-scrap/releases) から最新の `main.js`、`styles.css`、`manifest.json` をダウンロード
2. Vault の `.obsidian/plugins/zen-scrap/` フォルダを作成し、3ファイルを配置
3. Obsidian を再起動して「設定 > コミュニティプラグイン」から Zen Scrap を有効化

## 使い方

### スクラップを開く

- サイドバーのメッセージアイコンをクリック
- コマンドパレットから「Open Zen Scrap」を実行

### スクラップの作成

一覧画面の「新規スクラップ」ボタンからタイトルとタグを入力して作成する。タグはカンマ区切りで複数指定できる。

### エントリのポスト

詳細画面下部のテキストエリアにMarkdownを書いて「ポストする」をクリック。`Cmd/Ctrl + Enter` でもポストできる。

### Markdownエディタ

- Markdown / Preview タブで編集とプレビューを切り替え
- `Cmd/Ctrl + Enter` でポスト・更新をショートカット実行
- 「Markdownガイド」リンクから対応記法の一覧を確認できる
- 「画像」ボタンで画像をアップロード、またはテキストエリアに画像をドラッグ&ドロップ
- 「+ 埋め込み」ボタンから外部コンテンツを挿入
- Obsidian リンク `[[ノート名]]` や `[[ノート名|表示テキスト]]` がリンクとしてレンダリングされ、クリックで該当ノートを開く

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
| Closed | 完了・終了。詳細画面の「操作」メニューから切り替え。クローズ済みスクラップにはクローズ日のバナーが表示される |
| Archived | 非表示。一覧のメニューからアーカイブする。一覧のフィルターを「Archived」にすると表示される |

### 一覧画面の操作

- 公開状態フィルター（All / Open / Closed / Archived）
- 並び替え（作成日 / 更新日）
- 全文検索
- タグクリックでタグフィルタリング
- ピン留めしたスクラップは一覧の上部に表示される
- 各スクラップのメニューからピン留め/解除・アーカイブ・削除

### 詳細画面の操作

- 「操作」ドロップダウンからクローズ/オープン切替、ピン留め/解除、JSONコピー、ファイルを開く、削除
- タイトル横の編集アイコンでタイトル変更
- タグの表示・インライン編集（タグ行の編集アイコンから）
- 各エントリの編集・削除・上下並び替え

### 設定

Obsidian の「設定 > Zen Scrap」から以下を変更できる。

| 設定項目 | デフォルト値 | 説明 |
| --- | --- | --- |
| スクラップの保存フォルダ | `Scraps` | スクラップファイルの保存先 |
| 画像の保存フォルダ | `Scraps/images` | アップロード画像の保存先 |

### 外部変更の自動反映

Vault 内のスクラップファイルを外部エディタで編集した場合、変更が自動的に検知されて画面に反映される。

## データの保存形式

スクラップは Vault 内の `Scraps/` フォルダ（設定で変更可能）に Markdown ファイルとして保存される。frontmatter にメタ情報、本文にエントリが `### タイムスタンプ` + `---` 区切りで並ぶ構造。通常の Markdown ファイルなので、他のエディタやツールからも読み書きできる。

```markdown
---
title: スクラップタイトル
status: open
tags: [react, frontend]
created: 2026-03-10T14:00:00.000Z
updated: 2026-03-10T14:30:00.000Z
archived: false
pinned: false
---

### 2026-03-10 14:00

最初のエントリ

---

### 2026-03-10 14:30

追加のエントリ

---
```

## 開発

Fork して手元で開発する場合の手順。

```bash
npm install
cp .env.example .env
```

`.env` の `OBSIDIAN_PLUGIN_DIR` を自分の Vault のプラグインディレクトリに書き換える。

```
OBSIDIAN_PLUGIN_DIR=/path/to/vault/.obsidian/plugins/zen-scrap
```

設定後、`npm run dev` でビルド＆ファイル監視が起動し、変更のたびにプラグインディレクトリへ自動コピーされる。

```bash
npm run dev    # 開発モード（ファイル監視 + 自動コピー）
npm run build  # 本番ビルド
```
