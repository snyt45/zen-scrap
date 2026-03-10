# 一覧画面リデザイン + EventBus導入 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** コールバック注入をEventBusに置き換え、一覧画面のUI（検索・フィルタタブ・並び替え・ステータスラベル）を改善する

**Architecture:** EventBusを導入しViewとPlugin間の結合を解消する。既存ファイルを機能別ディレクトリに移動してからEventBus層を追加し、最後にUI改善を行う。

**Tech Stack:** TypeScript, Obsidian API

---

### Task 1: ディレクトリ構成の変更

**Files:**
- Move: `src/scrap-list-view.ts` → `src/views/scrap-list-view.ts`
- Move: `src/scrap-detail-view.ts` → `src/views/scrap-detail-view.ts`
- Move: `src/scrap-repository.ts` → `src/data/scrap-repository.ts`
- Move: `src/scrap-parser.ts` → `src/data/scrap-parser.ts`
- Move: `src/types.ts` → `src/data/types.ts`
- Move: `src/title-prompt-modal.ts` → `src/ui/title-prompt-modal.ts`
- Modify: `src/main.ts` — importパスを更新

**Step 1: ディレクトリ作成とファイル移動**

```bash
mkdir -p src/views src/data src/events src/ui
git mv src/scrap-list-view.ts src/views/
git mv src/scrap-detail-view.ts src/views/
git mv src/scrap-repository.ts src/data/
git mv src/scrap-parser.ts src/data/
git mv src/types.ts src/data/
git mv src/title-prompt-modal.ts src/ui/
```

**Step 2: 全ファイルのimportパスを更新**

各ファイルの相対importを新しいディレクトリ構成に合わせて修正する。

- `src/main.ts`: `./scrap-repository` → `./data/scrap-repository` 等
- `src/views/scrap-list-view.ts`: `./types` → `../data/types` 等
- `src/views/scrap-detail-view.ts`: `./types` → `../data/types` 等
- `src/data/scrap-repository.ts`: `./types` → `./types`, `./scrap-parser` → `./scrap-parser`（変更なし）

**Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 4: コミット**

```bash
git add -A
git commit -m "ディレクトリ構成を機能別に整理"
```

---

### Task 2: EventBus実装

**Files:**
- Create: `src/events/constants.ts`
- Create: `src/events/event-bus.ts`

**Step 1: イベント定数を定義**

```typescript
// src/events/constants.ts
export const EVENTS = {
  SCRAP_SELECT: "scrap:select",
  SCRAP_CREATE_REQUEST: "scrap:create-request",
  SCRAP_CHANGED: "scrap:changed",
  NAV_BACK_TO_LIST: "nav:back-to-list",
} as const;
```

**Step 2: EventBusクラスを実装**

```typescript
// src/events/event-bus.ts
type Handler = (...args: any[]) => void;

export class EventBus {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: Handler): void {
    this.listeners.get(event)?.delete(handler);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((handler) => handler(...args));
  }
}
```

**Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 4: コミット**

```bash
git add src/events/
git commit -m "EventBusとイベント定数を追加"
```

---

### Task 3: ViewをEventBus方式に移行

**Files:**
- Modify: `src/views/scrap-list-view.ts`
- Modify: `src/views/scrap-detail-view.ts`
- Modify: `src/main.ts`

**Step 1: ScrapListViewのコールバックをEventBusに置き換え**

コンストラクタを `(leaf, repo, eventBus)` に変更。

- `onScrapSelect` コールバック → `this.eventBus.emit(EVENTS.SCRAP_SELECT, scrap)`
- `onCreateNew` コールバック → `this.eventBus.emit(EVENTS.SCRAP_CREATE_REQUEST)`
- `onOpen` で `this.eventBus.on(EVENTS.SCRAP_CHANGED, this.render.bind(this))` を登録
- `onClose` で `this.eventBus.off(EVENTS.SCRAP_CHANGED, ...)` を解除

**Step 2: ScrapDetailViewのコールバックをEventBusに置き換え**

コンストラクタを `(leaf, repo, eventBus)` に変更。

- `onBack` コールバック → `this.eventBus.emit(EVENTS.NAV_BACK_TO_LIST)`

**Step 3: main.tsを更新**

- EventBusインスタンスを生成
- registerViewでViewにeventBusを渡す
- コールバック引数を削除

**Step 4: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 5: コミット**

```bash
git add src/views/ src/main.ts
git commit -m "ViewのコールバックをEventBusに置き換え"
```

---

### Task 4: イベントハンドラを分離

**Files:**
- Create: `src/events/scrap-handlers.ts`
- Create: `src/events/nav-handlers.ts`
- Modify: `src/main.ts`

**Step 1: scrap-handlers.tsを作成**

```typescript
// src/events/scrap-handlers.ts
import { App } from "obsidian";
import { EventBus } from "./event-bus";
import { EVENTS } from "./constants";
import { ScrapRepository } from "../data/scrap-repository";
import { TitlePromptModal } from "../ui/title-prompt-modal";
import { Scrap } from "../data/types";

export function registerScrapHandlers(
  eventBus: EventBus,
  app: App,
  repo: ScrapRepository,
  openScrap: (scrap: Scrap) => void
): void {
  eventBus.on(EVENTS.SCRAP_SELECT, (scrap: Scrap) => {
    openScrap(scrap);
  });

  eventBus.on(EVENTS.SCRAP_CREATE_REQUEST, async () => {
    const title = await new TitlePromptModal(app).prompt();
    if (!title) return;
    const scrap = await repo.create(title, []);
    openScrap(scrap);
    eventBus.emit(EVENTS.SCRAP_CHANGED);
  });
}
```

**Step 2: nav-handlers.tsを作成**

```typescript
// src/events/nav-handlers.ts
import { EventBus } from "./event-bus";
import { EVENTS } from "./constants";

export function registerNavHandlers(
  eventBus: EventBus,
  activateListView: () => void
): void {
  eventBus.on(EVENTS.NAV_BACK_TO_LIST, () => {
    activateListView();
  });
}
```

**Step 3: main.tsからハンドラロジックを削除し、登録関数を呼ぶ**

main.tsのonload()で:
```typescript
const eventBus = new EventBus();
registerScrapHandlers(eventBus, this.app, this.repo, (scrap) => this.openScrap(scrap));
registerNavHandlers(eventBus, () => this.activateListView());
```

main.tsから`createNewScrap()`メソッドを削除（scrap-handlersに移動済み）。
TitlePromptModalのimportも削除。

**Step 4: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 5: コミット**

```bash
git add src/events/ src/main.ts
git commit -m "イベントハンドラをファイル分離"
```

---

### Task 5: 一覧画面のUI改善

**Files:**
- Modify: `src/views/scrap-list-view.ts`
- Modify: `styles.css`

**Step 1: ScrapListViewの状態を拡張**

```typescript
private filter: "all" | "open" | "closed" | "archived" = "open";
private sort: "created" | "commented" = "created";
private searchQuery = "";
```

**Step 2: renderHeader()を書き換え**

- 1行目: 「Zen Scrap」タイトル + 右に「+ 新規作成」ボタン（角丸）
- 2行目: 検索input（placeholder: "タイトルやトピックで検索..."）
  - inputイベントでsearchQueryを更新し、render()

**Step 3: フィルタ・並び替え行を追加（renderToolbar(container)）**

- フィルタタブ: All / Open / Closed / Archived をdivで並べる。activeなタブにクラス付与
- 並び替え: select要素（作成日が新しい順 / コメントが新しい順）
- クリック/changeでstate更新→render()

**Step 4: renderList()を更新**

- 検索フィルタ: searchQueryでtitle/tagsを部分一致フィルタ
- 並び替え: sort === "created" → created降順、sort === "commented" → updated降順
- archivedフィルタ: filter === "archived" の場合のみarchived=trueを表示
- ステータスアイコン`●○`を廃止し、ラベル要素に置き換え
  - Open: cls `zen-scrap-label-open`
  - Closed: cls `zen-scrap-label-closed`

**Step 5: styles.cssにスタイル追加**

```css
/* ステータスラベル */
.zen-scrap-label-open {
  background: #2563eb;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: 600;
}

.zen-scrap-label-closed {
  background: #7c3aed;
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: 600;
}

/* 検索欄 */
.zen-scrap-search { ... }

/* フィルタタブ */
.zen-scrap-toolbar { ... }
.zen-scrap-tab { ... }
.zen-scrap-tab-active { ... }

/* 新規作成ボタン（角丸） */
.zen-scrap-new-btn { border-radius: 20px; }
```

**Step 6: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 7: コミット**

```bash
git add src/views/scrap-list-view.ts styles.css
git commit -m "一覧画面のUI改善（検索・フィルタタブ・並び替え・ステータスラベル）"
```
