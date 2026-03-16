# マーク機能廃止 & Inbox機能導入 設計

## 背景

マーク機能（エントリ単位のブックマーク）は、コレクション機能の導入により役割が曖昧になっていた。ユーザーの実際の使い方を分析すると「あとで読む」「しおり」「取り込み」の3つが混在しており、どの用途にも中途半端な状態だった。

6つの専門家エージェント（学習科学、UX行動デザイン、Obsidianエコシステム、プロダクト設計、PKM、ユーザー行動分析、ミニマリスト設計、スレッド形式メモ）の分析結果を踏まえ、マーク機能を廃止してInbox機能に置き換える。

## 設計方針

- Inboxはエントリへの参照型。エントリ・スクラップ・コレクションに一切影響しない
- 1タップで追加、チェックで消化というシンプルなライフサイクル
- しおり機能は別途対応（今回のスコープ外）
- 既存markedデータのマイグレーションは行わない（クリーンスタート）

## データモデル

### 新規：Inbox

```typescript
// src/data/inbox-types.ts
interface InboxItem {
  scrapPath: string;
  entryTimestamp: string;
  addedAt: string; // ISO 8601
}

interface InboxData {
  items: InboxItem[];
}
```

保存先: `Scraps/inbox.json`

参照型のためエントリ本体に触らない。コレクション（collections.json）と同じ設計思想。

### 廃止：ScrapEntry.marked

```typescript
// before
interface ScrapEntry {
  timestamp: string;
  body: string;
  marked?: boolean; // 削除
}
```

パーサーは既存ファイルの `[marked]` タグを読み飛ばす（エラーにしない）。書き込みは行わない。

## Inbox一覧画面

### タブ

- 「マーク」タブ → 「Inbox」タブに変更
- アイコンを受信箱アイコンに変更
- 配置: 一覧 | Inbox | コレクション
- 未処理件数のバッジを表示

### レイアウト

```
[タブナビ: 一覧 | Inbox | コレクション]
[検索バー]
─────────────────────────────
 □ エントリのプレビュー (120文字)
   スクラップタイトル · 2時間前に追加
─────────────────────────────
 □ エントリのプレビュー (120文字)
   スクラップタイトル · 3日前に追加
─────────────────────────────
```

### 操作

- チェックボックスタップ → 即消化（inbox.jsonから削除、エントリに影響なし）
- エントリクリック → スクラップ詳細画面に遷移
- 検索 → エントリ本文でフィルタリング
- ソート: addedAt降順（新しいものが上）

### 廃止するもの（現マーク一覧にあった機能）

- 複数選択 + まとめてコピー → コレクションの役割

## エントリからのInbox追加UI

### スクラップ詳細画面

現在のマークボタン（ブックマークアイコン）の位置に、Inboxボタンを配置。

- Inbox未追加時: 受信箱アイコン（薄い表示、ホバーで出現）
- Inbox追加済み時: 受信箱アイコン（アクティブ状態）。クリックでInboxから削除
- アイコンのみ（テキストなし）

### 廃止するもの

- マーク絞り込みトグル（ヘッダーのブックマークフィルターボタン）
- マーク絞り込み時の「まとめてコピー」バー

## ファイル構成

### 新規作成

| ファイル | 内容 |
|---------|------|
| `src/data/inbox-types.ts` | InboxItem, InboxData 型定義 |
| `src/data/inbox-repository.ts` | CRUD（load, add, remove, has） |
| `src/views/inbox-list-view.ts` | Inbox一覧画面 |

### 修正

| ファイル | 変更内容 |
|---------|---------|
| `src/main.ts` | ビュー登録をMarkedList→InboxListに差し替え |
| `src/data/types.ts` | `marked` フィールド削除 |
| `src/data/scrap-parser.ts` | `[marked]` 書き込み削除、読み飛ばし維持 |
| `src/views/detail/timeline-renderer.ts` | マークボタン→Inboxボタン、絞り込み関連削除 |
| `src/views/detail/header-renderer.ts` | マーク絞り込みトグル削除 |
| `src/views/shared/tab-nav-renderer.ts` | タブ名・アイコン変更、バッジ追加 |
| `src/events/constants.ts` | イベント名変更 |
| `src/events/nav-handlers.ts` | ハンドラ差し替え |
| `src/views/scrap-detail-view.ts` | filterMarked関連削除 |

### 削除

| ファイル | 理由 |
|---------|------|
| `src/views/marked-list-view.ts` | InboxListViewに置き換え |

## 後方互換

- 既存ファイルの `[marked]` タグ: パーサーが読み飛ばす。エラーにならない
- 既存markedデータ: マイグレーションしない。Inboxはクリーンスタート
- `inbox.json` が存在しない場合: 空のInboxとして扱う
