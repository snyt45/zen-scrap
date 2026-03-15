# コレクション機能 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 複数スクラップからエントリやスクラップを目的別に集めて、AIに渡せる形でコピーできるコレクション機能を追加する

**Architecture:** コレクションは `collections.json` にスクラップ/エントリへの参照として保存。スクラップのMarkdownファイルとは完全分離。UI は既存のタブナビゲーションに「コレクション」タブを追加し、コレクション一覧→詳細の画面遷移パターンを踏襲。既存のスクラップ/エントリメニューに「コレクションに追加」導線を追加。

**Tech Stack:** TypeScript, Obsidian Plugin API, CSS

---

### Task 1: データ型とリポジトリ

**Files:**
- Create: `src/data/collection-types.ts`
- Create: `src/data/collection-repository.ts`

**Step 1: コレクションの型定義を作成**

`src/data/collection-types.ts`:
```typescript
export interface CollectionItem {
  type: "scrap" | "entry";
  scrapPath: string;
  entryTimestamp?: string;
  order: number;
}

export interface Collection {
  id: string;
  title: string;
  items: CollectionItem[];
  created: string;
  updated: string;
}
```

**Step 2: CollectionRepositoryを作成**

`src/data/collection-repository.ts`:
- `App` と `ZenScrapSettings` を受け取るコンストラクタ
- `listAll(): Promise<Collection[]>` — `{scrapsFolder}/collections.json` を読んで全コレクションを返す。ファイルが無ければ空配列
- `get(id: string): Promise<Collection | null>` — IDで1件取得
- `create(title: string): Promise<Collection>` — 新規作成。IDは `Date.now().toString(36)` で生成
- `save(collection: Collection): Promise<void>` — 1件更新（全コレクションを読んで該当IDを差し替えて書き戻す）
- `delete(id: string): Promise<void>` — 1件削除
- `addItem(collectionId: string, item: Omit<CollectionItem, "order">): Promise<Collection>` — アイテム追加。orderは末尾に自動付番
- `removeItem(collectionId: string, index: number): Promise<Collection>` — アイテム削除
- `reorderItems(collectionId: string, items: CollectionItem[]): Promise<Collection>` — 並べ替え
- 内部メソッド `readAll(): Promise<Collection[]>` と `writeAll(collections: Collection[]): Promise<void>` でJSON読み書き

保存先パス: `normalizePath(\`${this.settings.scrapsFolder}/collections.json\`)`

**Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功（まだ誰も参照していないが型エラーがないことを確認）

**Step 4: コミット**

```bash
git add src/data/collection-types.ts src/data/collection-repository.ts
git commit -m "コレクション機能のデータ型とリポジトリを追加"
```

---

### Task 2: イベントとナビゲーション基盤

**Files:**
- Modify: `src/events/constants.ts`
- Modify: `src/events/nav-handlers.ts`
- Modify: `src/main.ts`

**Step 1: イベント定数を追加**

`src/events/constants.ts` に追加:
```typescript
NAV_TO_COLLECTION_LIST: "nav:to-collection-list",
NAV_TO_COLLECTION_DETAIL: "nav:to-collection-detail",
COLLECTION_CHANGED: "collection:changed",
```

**Step 2: nav-handlersを拡張**

`src/events/nav-handlers.ts`:
- `registerNavHandlers` の引数に `openCollectionList: () => void` と `openCollectionDetail: (id: string) => void` を追加
- `NAV_TO_COLLECTION_LIST` と `NAV_TO_COLLECTION_DETAIL` のハンドラを登録

**Step 3: main.tsにCollectionRepositoryとビュー登録を追加**

`src/main.ts`:
- `CollectionRepository` をインポートしてインスタンス化（`this.collectionRepo`）
- コレクション一覧ビュー（`VIEW_TYPE_COLLECTION_LIST`）とコレクション詳細ビュー（`VIEW_TYPE_COLLECTION_DETAIL`）の `registerView` を追加（ビュークラスは次のTaskで作成するが、先にimportだけ書いておく）
- `registerNavHandlers` に `openCollectionList` と `openCollectionDetail` を渡す
- `openCollectionList()` メソッドと `openCollectionDetail(id: string)` メソッドを追加（`openMarkedList` と同じパターン）

**Note:** ビュークラスが未作成なのでこの時点ではビルドが通らない。Task 3と合わせてビルド確認する。

**Step 4: コミット**

```bash
git add src/events/constants.ts src/events/nav-handlers.ts src/main.ts
git commit -m "コレクション用のイベント定数とナビゲーション基盤を追加"
```

---

### Task 3: タブナビゲーションにコレクションタブ追加

**Files:**
- Modify: `src/views/shared/tab-nav-renderer.ts`
- アイコン追加が必要なら `src/icons.ts`

**Step 1: tab-nav-rendererにコレクションタブを追加**

`src/views/shared/tab-nav-renderer.ts`:
- `ActiveTab` 型に `"collection"` を追加
- マークタブの後にコレクションタブを追加。アイコンはフォルダ系SVGを `src/icons.ts` に追加（`COLLECTION_ICON`）
- クリックで `EVENTS.NAV_TO_COLLECTION_LIST` を発火

**Step 2: ビルド確認**

Run: `npm run build`
Expected: ビュークラスが存在しないためエラー → Task 3はTask 4と合わせてビルド確認

**Step 3: コミット**

```bash
git add src/views/shared/tab-nav-renderer.ts src/icons.ts
git commit -m "タブナビゲーションにコレクションタブを追加"
```

---

### Task 4: コレクション一覧ビュー

**Files:**
- Create: `src/views/collection-list-view.ts`

**Step 1: CollectionListViewを作成**

`src/views/collection-list-view.ts`:
- `ScrapListView` と同じパターンの `ItemView` 継承クラス
- `VIEW_TYPE_COLLECTION_LIST = "zen-scrap-collection-list"` をエクスポート
- コンストラクタ: `CollectionRepository`, `EventBus` を受け取る
- `render()`:
  - `renderTabNav` で activeTab = "collection"
  - 「+ 新しいコレクション」ボタン（クリックでタイトル入力モーダルを表示、作成後に `COLLECTION_CHANGED` 発火）
  - `collectionRepo.listAll()` でコレクション一覧取得
  - 各コレクションをリストアイテムとして表示（タイトル、アイテム件数、作成日）
  - クリックで `NAV_TO_COLLECTION_DETAIL` イベント発火（collection.id を渡す）
  - メニュー: 削除（確認ダイアログ付き）
- `COLLECTION_CHANGED` イベントで再描画

**Step 2: main.tsのimportを有効化してビルド確認**

Run: `npm run build`
Expected: 成功

**Step 3: コミット**

```bash
git add src/views/collection-list-view.ts src/main.ts
git commit -m "コレクション一覧ビューを追加"
```

---

### Task 5: コレクション詳細ビュー（基本表示）

**Files:**
- Create: `src/views/collection-detail-view.ts`

**Step 1: CollectionDetailViewを作成**

`src/views/collection-detail-view.ts`:
- `VIEW_TYPE_COLLECTION_DETAIL = "zen-scrap-collection-detail"` をエクスポート
- コンストラクタ: `CollectionRepository`, `ScrapRepository`, `EventBus` を受け取る
- `setState` で `collectionId` を受け取り、`collectionRepo.get(id)` でデータ取得
- `render()`:
  - 戻るリンク（← コレクション）で `NAV_TO_COLLECTION_LIST` 発火
  - タイトル表示（クリックで編集、スクラップ詳細のタイトル編集と同じパターン）
  - 「+ 追加」ボタン（検索モーダルはTask 7で実装。まずはボタンだけ配置）
  - 「まとめてコピー」ボタン
  - アイテム一覧表示:
    - type=scrap: スクラップタイトル、descriptionプレビュー（120文字）。`scrapRepo.getByPath` で取得。見つからなければグレーアウト
    - type=entry: 「スクラップ名 > タイムスタンプ」、エントリ本文プレビュー（120文字）。見つからなければグレーアウト
    - 各アイテムに削除ボタン（`collectionRepo.removeItem`）
    - アイテムクリックで元スクラップにジャンプ（`SCRAP_SELECT` イベント発火）

**Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 3: コミット**

```bash
git add src/views/collection-detail-view.ts src/main.ts
git commit -m "コレクション詳細ビューの基本表示を追加"
```

---

### Task 6: まとめてコピー機能

**Files:**
- Modify: `src/views/collection-detail-view.ts`

**Step 1: コピー用テキスト生成ロジックを実装**

コレクション詳細の「まとめてコピー」ボタンのクリックハンドラ:
- 全アイテムを `order` 順に処理
- type=scrap: `scrapRepo.getByPath` でスクラップ取得。h2でタイトル、description、全エントリを出力
- type=entry: スクラップ取得後、`entryTimestamp` で該当エントリを探す。h2で「スクラップ名 > タイムスタンプ」、本文を出力
- 見つからないアイテムはスキップ
- h1にコレクションタイトル
- `navigator.clipboard.writeText()` でコピー
- `new Notice("コレクションをコピーしました")` で通知

**Step 2: ビルド確認して動作テスト**

Run: `npm run build`
Expected: 成功

**Step 3: コミット**

```bash
git add src/views/collection-detail-view.ts
git commit -m "コレクションのまとめてコピー機能を追加"
```

---

### Task 7: 検索モーダル（コレクションに追加）

**Files:**
- Create: `src/ui/collection-add-modal.ts`
- Modify: `src/views/collection-detail-view.ts`

**Step 1: CollectionAddModalを作成**

`src/ui/collection-add-modal.ts`:
- Obsidianの `Modal` を継承
- コンストラクタ: `App`, `ScrapRepository`, コールバック `onAdd: (item: { type: "scrap" | "entry"; scrapPath: string; entryTimestamp?: string }) => void`
- UI:
  - 検索入力欄（スクラップ名で検索、IME対応）
  - モード切り替え: 「スクラップ全体を追加」/「エントリを選んで追加」（ラジオボタンまたはタブ）
  - スクラップ一覧（検索結果）。クリックで:
    - スクラップモード: そのまま `onAdd({ type: "scrap", scrapPath })` してモーダルを閉じる
    - エントリモード: スクラップのエントリ一覧を表示。エントリクリックで `onAdd({ type: "entry", scrapPath, entryTimestamp })` してモーダルを閉じる
  - エントリ一覧では本文プレビュー（120文字）とタイムスタンプを表示

**Step 2: コレクション詳細の「+ 追加」ボタンと接続**

`src/views/collection-detail-view.ts`:
- 「+ 追加」ボタンのクリックで `CollectionAddModal` を開く
- `onAdd` コールバックで `collectionRepo.addItem()` を呼び、再描画

**Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 4: コミット**

```bash
git add src/ui/collection-add-modal.ts src/views/collection-detail-view.ts
git commit -m "コレクションへのアイテム追加用検索モーダルを追加"
```

---

### Task 8: ドラッグ並べ替え

**Files:**
- Modify: `src/views/collection-detail-view.ts`

**Step 1: アイテムのドラッグ並べ替えを実装**

既存のエントリ並べ替え（`timeline-renderer.ts` のドラッグ実装）と同じパターンで実装:
- 各アイテムにドラッグハンドル（`GRIP_ICON`）を追加
- `mousedown` → `mousemove` → `mouseup` でドラッグ処理
- ドロップ時に `collectionRepo.reorderItems()` で保存
- `COLLECTION_CHANGED` 発火で再描画

**Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 3: コミット**

```bash
git add src/views/collection-detail-view.ts
git commit -m "コレクションアイテムのドラッグ並べ替えを追加"
```

---

### Task 9: 既存メニューに「コレクションに追加」導線

**Files:**
- Create: `src/ui/collection-picker-modal.ts`
- Modify: `src/views/list/list-item-renderer.ts`
- Modify: `src/views/detail/timeline-renderer.ts`

**Step 1: CollectionPickerModalを作成**

`src/ui/collection-picker-modal.ts`:
- Obsidianの `Modal` を継承
- コンストラクタ: `App`, `CollectionRepository`, コールバック `onPick: (collectionId: string) => void`
- UI: コレクション一覧を表示。クリックで `onPick(collection.id)` してモーダルを閉じる

**Step 2: スクラップ一覧メニューに追加**

`src/views/list/list-item-renderer.ts`:
- `ListItemDeps` に `collectionRepo: CollectionRepository` を追加
- メニュー内（アーカイブの後、削除の前）に「コレクションに追加」を追加
- クリックで `CollectionPickerModal` を開く
- `onPick` で `collectionRepo.addItem(collectionId, { type: "scrap", scrapPath: scrap.filePath })` を呼ぶ
- `new Notice("コレクションに追加しました")` で通知

**Step 3: エントリメニューに追加**

`src/views/detail/timeline-renderer.ts`:
- `TimelineDeps` に `collectionRepo: CollectionRepository` を追加
- エントリメニュー内（コピーの後、編集の前）に「コレクションに追加」を追加
- クリックで `CollectionPickerModal` を開く
- `onPick` で `collectionRepo.addItem(collectionId, { type: "entry", scrapPath: scrap.filePath, entryTimestamp: entry.timestamp })` を呼ぶ
- `new Notice("コレクションに追加しました")` で通知

**Step 4: 呼び出し元でdepsにcollectionRepoを渡す**

- `src/views/scrap-list-view.ts`: `renderListItem` のdepsに `collectionRepo` を追加
- `src/views/scrap-detail-view.ts`: `TimelineDeps` に `collectionRepo` を渡す
- `src/main.ts`: 各ビューのコンストラクタに `collectionRepo` を渡す（必要に応じて）

**Step 5: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 6: コミット**

```bash
git add src/ui/collection-picker-modal.ts src/views/list/list-item-renderer.ts src/views/detail/timeline-renderer.ts src/views/scrap-list-view.ts src/views/scrap-detail-view.ts src/main.ts
git commit -m "スクラップ/エントリメニューにコレクション追加導線を追加"
```

---

### Task 10: CSS スタイリング

**Files:**
- Modify: `styles.app.css`

**Step 1: コレクション関連のCSSを追加**

@frontend-design スキルを使用してデザインすること。

追加するスタイル:
- コレクション一覧（`.zen-scrap-collection-list`, `.zen-scrap-collection-item`）: スクラップ一覧と統一感のあるデザイン
- コレクション詳細（`.zen-scrap-collection-detail`）
- コレクションアイテム（`.zen-scrap-collection-detail-item`）: type別のアイコンまたはラベルで区別。グレーアウト状態のスタイル
- 検索モーダル（`.zen-scrap-collection-add-modal`）
- コレクションピッカーモーダル（`.zen-scrap-collection-picker-modal`）
- ドラッグ中のスタイル

**Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 3: コミット**

```bash
git add styles.app.css
git commit -m "コレクション機能のCSSスタイリングを追加"
```

---

### Task 11: 最終確認とクリーンアップ

**Step 1: 全機能の動作確認**

以下を手動で確認:
- コレクション一覧: 作成、表示、削除
- コレクション詳細: タイトル編集、アイテム表示、並べ替え、削除、ジャンプ
- 追加モーダル: スクラップ検索、スクラップ追加、エントリ追加
- メニュー導線: スクラップ一覧から追加、エントリから追加
- まとめてコピー: 形式の確認
- 整合性: 元スクラップ削除後のグレーアウト表示

**Step 2: console.logの削除確認**

開発用のログが残っていないか確認して削除。

**Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 4: コミット**

```bash
git add -A
git commit -m "コレクション機能の最終確認とクリーンアップ"
```
