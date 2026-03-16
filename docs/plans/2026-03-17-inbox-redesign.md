# マーク機能廃止 & Inbox機能導入 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** マーク機能を廃止し、参照型のInbox機能に置き換える。エントリ・スクラップ・コレクションに一切影響しない独立したレイヤーとして実装する。

**Architecture:** inbox.jsonに参照データを保存する方式。collection-repository.tsと同じパターン（Obsidian Vault API経由のJSON読み書き）でInboxRepositoryを実装し、既存のMarkedListViewをInboxListViewに置き換える。マーク関連のコードは全て削除する。

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild

---

### Task 1: Inbox データ層の作成

**Files:**
- Create: `src/data/inbox-types.ts`
- Create: `src/data/inbox-repository.ts`

**Step 1: 型定義ファイルを作成**

```typescript
// src/data/inbox-types.ts
export interface InboxItem {
  scrapPath: string;
  entryTimestamp: string;
  addedAt: string; // ISO 8601
}

export interface InboxData {
  items: InboxItem[];
}
```

**Step 2: InboxRepositoryを作成**

`src/data/collection-repository.ts` の readAll/writeAll パターンを参考にする。

```typescript
// src/data/inbox-repository.ts
import { App, TFile, normalizePath } from "obsidian";
import { InboxItem, InboxData } from "./inbox-types";
import type { ZenScrapSettings } from "../settings";

export class InboxRepository {
  constructor(private app: App, private settings: ZenScrapSettings) {}

  private get filePath(): string {
    return normalizePath(`${this.settings.scrapsFolder}/inbox.json`);
  }

  private async read(): Promise<InboxData> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return { items: [] };
    const content = await this.app.vault.read(file);
    try {
      return JSON.parse(content) as InboxData;
    } catch {
      return { items: [] };
    }
  }

  private async write(data: InboxData): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(this.filePath, content);
    }
  }

  async listAll(): Promise<InboxItem[]> {
    const data = await this.read();
    return data.items;
  }

  async add(scrapPath: string, entryTimestamp: string): Promise<boolean> {
    const data = await this.read();
    const duplicate = data.items.some(
      (i) => i.scrapPath === scrapPath && i.entryTimestamp === entryTimestamp
    );
    if (duplicate) return false;
    data.items.push({
      scrapPath,
      entryTimestamp,
      addedAt: new Date().toISOString(),
    });
    await this.write(data);
    return true;
  }

  async remove(scrapPath: string, entryTimestamp: string): Promise<void> {
    const data = await this.read();
    data.items = data.items.filter(
      (i) => !(i.scrapPath === scrapPath && i.entryTimestamp === entryTimestamp)
    );
    await this.write(data);
  }

  async has(scrapPath: string, entryTimestamp: string): Promise<boolean> {
    const data = await this.read();
    return data.items.some(
      (i) => i.scrapPath === scrapPath && i.entryTimestamp === entryTimestamp
    );
  }

  async count(): Promise<number> {
    const data = await this.read();
    return data.items.length;
  }
}
```

**Step 3: ビルドして型チェック**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`
Expected: PASS（新規ファイルはまだどこからもimportされていないので影響なし）

**Step 4: コミット**

```bash
git add src/data/inbox-types.ts src/data/inbox-repository.ts
git commit -m "Inboxデータ層の追加（inbox-types, inbox-repository）"
```

---

### Task 2: イベント定数とナビゲーションの更新

**Files:**
- Modify: `src/events/constants.ts`
- Modify: `src/events/nav-handlers.ts`

**Step 1: イベント定数を更新**

`src/events/constants.ts` 行6の `NAV_TO_MARKED_LIST` を変更:

```typescript
// before
NAV_TO_MARKED_LIST: "nav:to-marked-list",

// after
NAV_TO_INBOX_LIST: "nav:to-inbox-list",
```

**Step 2: ナビゲーションハンドラを更新**

`src/events/nav-handlers.ts` 全体を書き換え:

```typescript
import { EventBus } from "./event-bus";
import { EVENTS } from "./constants";

export function registerNavHandlers(
  eventBus: EventBus,
  activateListView: () => void,
  openInboxList: () => void,
  openCollectionList: () => void,
  openCollectionDetail: (id: string) => void
): void {
  eventBus.on(EVENTS.NAV_BACK_TO_LIST, () => {
    activateListView();
  });
  eventBus.on(EVENTS.NAV_TO_INBOX_LIST, () => {
    openInboxList();
  });
  eventBus.on(EVENTS.NAV_TO_COLLECTION_LIST, () => {
    openCollectionList();
  });
  eventBus.on(EVENTS.NAV_TO_COLLECTION_DETAIL, (id: string) => {
    openCollectionDetail(id);
  });
}
```

**Step 3: この時点ではビルドエラーになる（main.tsがまだ古い参照を使っている）ので、コミットだけ**

```bash
git add src/events/constants.ts src/events/nav-handlers.ts
git commit -m "イベント定数をMarkedList→InboxListに変更"
```

---

### Task 3: アイコンの追加と不要アイコンの整理

**Files:**
- Modify: `src/icons.ts`

**Step 1: Inboxアイコンを追加**

`src/icons.ts` の末尾（行41の後）に追加:

```typescript
export const INBOX_ICON = `<svg ${stroke(16)}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`;

export const INBOX_FILLED_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>`;
```

注: `BOOKMARK_ICON`, `BOOKMARK_FILLED_ICON`, `BOOKMARK_OFF_ICON` はTask 6以降で参照を消した後、最終タスクで削除する。

**Step 2: コミット**

```bash
git add src/icons.ts
git commit -m "Inboxアイコンの追加"
```

---

### Task 4: タブナビゲーションの更新

**Files:**
- Modify: `src/views/shared/tab-nav-renderer.ts`

**Step 1: タブをMarked→Inboxに変更し、バッジ対応を追加**

`src/views/shared/tab-nav-renderer.ts` 全体を書き換え:

```typescript
import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";
import { OUTLINE_ICON, INBOX_ICON, COLLECTION_ICON } from "../../icons";

export type ActiveTab = "list" | "inbox" | "collection" | "none";

export interface TabNavDeps {
  eventBus: EventBus;
  activeTab: ActiveTab;
  inboxCount?: number;
}

export function renderTabNav(container: HTMLElement, deps: TabNavDeps): void {
  const nav = container.createDiv({ cls: "zen-scrap-tab-nav" });

  const tabs = nav.createDiv({ cls: "zen-scrap-tab-nav-tabs" });

  const listTab = tabs.createEl("button", {
    cls: `zen-scrap-tab${deps.activeTab === "list" ? " is-active" : ""}`,
  });
  listTab.innerHTML = `${OUTLINE_ICON}<span>一覧</span>`;
  listTab.addEventListener("click", () => {
    if (deps.activeTab !== "list") {
      deps.eventBus.emit(EVENTS.NAV_BACK_TO_LIST);
    }
  });

  const inboxTab = tabs.createEl("button", {
    cls: `zen-scrap-tab${deps.activeTab === "inbox" ? " is-active" : ""}`,
  });
  const badgeHtml = deps.inboxCount && deps.inboxCount > 0
    ? `<span class="zen-scrap-inbox-badge">${deps.inboxCount}</span>`
    : "";
  inboxTab.innerHTML = `${INBOX_ICON}<span>Inbox</span>${badgeHtml}`;
  inboxTab.addEventListener("click", () => {
    if (deps.activeTab !== "inbox") {
      deps.eventBus.emit(EVENTS.NAV_TO_INBOX_LIST);
    }
  });

  const collectionTab = tabs.createEl("button", {
    cls: `zen-scrap-tab${deps.activeTab === "collection" ? " is-active" : ""}`,
  });
  collectionTab.innerHTML = `${COLLECTION_ICON}<span>コレクション</span>`;
  collectionTab.addEventListener("click", () => {
    if (deps.activeTab !== "collection") {
      deps.eventBus.emit(EVENTS.NAV_TO_COLLECTION_LIST);
    }
  });
}
```

**Step 2: コミット**

```bash
git add src/views/shared/tab-nav-renderer.ts
git commit -m "タブナビをMarked→Inboxに変更、バッジ対応"
```

---

### Task 5: InboxListViewの作成

**Files:**
- Create: `src/views/inbox-list-view.ts`

**Step 1: MarkedListViewを参考にInboxListViewを作成**

```typescript
// src/views/inbox-list-view.ts
import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { ScrapRepository } from "../data/scrap-repository";
import { InboxRepository } from "../data/inbox-repository";
import { InboxItem } from "../data/inbox-types";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { Scrap, ScrapEntry } from "../data/types";
import { stripMarkdown } from "../utils";
import { renderTabNav } from "./shared/tab-nav-renderer";
import { CleanupManager } from "../ui/cleanup-manager";

export const VIEW_TYPE_INBOX_LIST = "zen-scrap-inbox-list";

interface InboxSection {
  item: InboxItem;
  scrap: Scrap;
  entry: ScrapEntry;
  entryIndex: number;
}

export class InboxListView extends ItemView {
  private scrapRepo: ScrapRepository;
  private inboxRepo: InboxRepository;
  private eventBus: EventBus;
  private onChangedHandler: () => void;
  private cleanupManager = new CleanupManager();
  private searchQuery = "";

  constructor(
    leaf: WorkspaceLeaf,
    scrapRepo: ScrapRepository,
    inboxRepo: InboxRepository,
    eventBus: EventBus
  ) {
    super(leaf);
    this.scrapRepo = scrapRepo;
    this.inboxRepo = inboxRepo;
    this.eventBus = eventBus;
    this.onChangedHandler = () => this.render();
  }

  getViewType(): string {
    return VIEW_TYPE_INBOX_LIST;
  }

  getDisplayText(): string {
    return "Inbox";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen(): Promise<void> {
    this.eventBus.on(EVENTS.SCRAP_CHANGED, this.onChangedHandler);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onChangedHandler);
    this.cleanupManager.cleanup();
  }

  private async collectSections(): Promise<InboxSection[]> {
    const items = await this.inboxRepo.listAll();
    const scraps = await this.scrapRepo.listAll();
    const scrapMap = new Map(scraps.map((s) => [s.filePath, s]));

    const sections: InboxSection[] = [];
    for (const item of items) {
      const scrap = scrapMap.get(item.scrapPath);
      if (!scrap) continue;
      const entryIndex = scrap.entries.findIndex(
        (e) => e.timestamp === item.entryTimestamp
      );
      if (entryIndex === -1) continue;
      sections.push({
        item,
        scrap,
        entry: scrap.entries[entryIndex],
        entryIndex,
      });
    }

    // addedAt降順（新しいものが上）
    sections.sort(
      (a, b) =>
        new Date(b.item.addedAt).getTime() - new Date(a.item.addedAt).getTime()
    );
    return sections;
  }

  async render(): Promise<void> {
    this.cleanupManager.cleanup();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-inbox-list-container");

    const inboxCount = await this.inboxRepo.count();
    renderTabNav(container, {
      eventBus: this.eventBus,
      activeTab: "inbox",
      inboxCount,
    });

    // 検索バー
    const searchInput = container.createEl("input", {
      cls: "zen-scrap-search",
      type: "text",
      placeholder: "Inboxを検索...",
    });
    searchInput.value = this.searchQuery;
    let composing = false;
    searchInput.addEventListener("compositionstart", () => {
      composing = true;
    });
    searchInput.addEventListener("compositionend", () => {
      composing = false;
      this.searchQuery = searchInput.value;
      this.rerenderList();
    });
    searchInput.addEventListener("input", () => {
      if (composing) return;
      this.searchQuery = searchInput.value;
      this.rerenderList();
    });

    await this.renderListContent(container);
  }

  private async rerenderList(): Promise<void> {
    const existing = this.containerEl.querySelector(".zen-scrap-inbox-list");
    const existingEmpty = this.containerEl.querySelector(".zen-scrap-empty");
    if (existing) existing.remove();
    if (existingEmpty) existingEmpty.remove();
    const container = this.containerEl.children[1] as HTMLElement;
    await this.renderListContent(container);
  }

  private async renderListContent(container: HTMLElement): Promise<void> {
    let sections = await this.collectSections();

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      sections = sections.filter(
        (s) =>
          s.entry.body.toLowerCase().includes(q) ||
          s.scrap.title.toLowerCase().includes(q)
      );
    }

    if (sections.length === 0) {
      container.createDiv({
        cls: "zen-scrap-empty",
        text: "Inboxは空です",
      });
      return;
    }

    const list = container.createDiv({ cls: "zen-scrap-inbox-list" });

    for (const section of sections) {
      const item = list.createDiv({ cls: "zen-scrap-inbox-item" });

      // チェックボックス
      const checkbox = item.createEl("input", {
        type: "checkbox",
        cls: "zen-scrap-inbox-checkbox",
      });
      checkbox.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.inboxRepo.remove(
          section.item.scrapPath,
          section.item.entryTimestamp
        );
        this.eventBus.emit(EVENTS.SCRAP_CHANGED);
      });

      const content = item.createDiv({ cls: "zen-scrap-inbox-content" });

      const preview = stripMarkdown(section.entry.body, 120);
      content.createDiv({ text: preview, cls: "zen-scrap-inbox-preview" });

      const meta = content.createDiv({ cls: "zen-scrap-inbox-meta" });
      meta.createSpan({
        text: section.scrap.title,
        cls: "zen-scrap-inbox-source",
      });
      meta.createSpan({ text: "·" });
      meta.createSpan({
        text: this.formatRelativeTime(section.item.addedAt),
        cls: "zen-scrap-inbox-time",
      });

      // クリックでスクラップ詳細に遷移
      content.addEventListener("click", () => {
        this.eventBus.emit(
          EVENTS.SCRAP_SELECT,
          section.scrap,
          section.entryIndex
        );
      });
    }
  }

  private formatRelativeTime(isoString: string): string {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return `${days}日前`;
  }
}
```

**Step 2: コミット**

```bash
git add src/views/inbox-list-view.ts
git commit -m "InboxListViewの作成"
```

---

### Task 6: main.tsの更新（MarkedList→InboxList差し替え）

**Files:**
- Modify: `src/main.ts`

**Step 1: importを差し替え**

行6を変更:
```typescript
// before
import { MarkedListView, VIEW_TYPE_MARKED_LIST } from "./views/marked-list-view";

// after
import { InboxListView, VIEW_TYPE_INBOX_LIST } from "./views/inbox-list-view";
import { InboxRepository } from "./data/inbox-repository";
```

**Step 2: inboxRepoフィールドを追加**

行18の後に追加:
```typescript
private inboxRepo!: InboxRepository;
```

**Step 3: onload()内でinboxRepoを初期化**

行27の後に追加:
```typescript
this.inboxRepo = new InboxRepository(this.app, this.settings);
```

**Step 4: registerViewを差し替え**

行37-39を変更:
```typescript
// before
this.registerView(VIEW_TYPE_MARKED_LIST, (leaf) =>
  new MarkedListView(leaf, this.repo, this.eventBus)
);

// after
this.registerView(VIEW_TYPE_INBOX_LIST, (leaf) =>
  new InboxListView(leaf, this.repo, this.inboxRepo, this.eventBus)
);
```

**Step 5: registerNavHandlersの引数を差し替え**

行53を変更:
```typescript
// before
() => this.openMarkedList(),

// after
() => this.openInboxList(),
```

**Step 6: openMarkedListをopenInboxListに書き換え**

行123-134を置き換え:
```typescript
async openInboxList() {
  const { workspace } = this.app;
  let leaf = workspace.getLeavesOfType(VIEW_TYPE_INBOX_LIST)[0];
  if (!leaf) {
    leaf = workspace.getLeaf(true)!;
  }
  await leaf.setViewState({
    type: VIEW_TYPE_INBOX_LIST,
    active: true,
  });
  workspace.revealLeaf(leaf);
}
```

**Step 7: ビルドして型チェック**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`
Expected: エラーが出る可能性あり（他ファイルがまだ古い型を参照している）。タブのActiveTabが"marked"→"inbox"に変わった影響。次のタスクで対応。

**Step 8: コミット**

```bash
git add src/main.ts
git commit -m "main.tsをMarkedList→InboxListに差し替え"
```

---

### Task 7: ScrapDetailViewからマーク関連を削除し、Inboxボタンに置き換え

**Files:**
- Modify: `src/views/scrap-detail-view.ts`
- Modify: `src/views/detail/header-renderer.ts`
- Modify: `src/views/detail/timeline-renderer.ts`

**Step 1: ScrapDetailViewからfilterMarked関連を削除**

`src/views/scrap-detail-view.ts` から以下を削除/変更:

行24: `private filterMarkedMap = new Map<string, boolean>();` → 削除

行132のHeaderDeps: `filterMarked` と `setFilterMarked` を削除。代わりに `inboxRepo` を追加:
```typescript
const headerDeps: HeaderDeps = {
  scrap,
  repo: this.repo,
  collectionRepo: this.collectionRepo,
  inboxRepo: this.inboxRepo,  // 追加
  eventBus: this.eventBus,
  app: this.app,
  scope: this.scope,
  markdownRenderer: this.markdownRenderer,
  isFullWidth: this.isFullWidth,
  setFullWidth: (v) => { this.isFullWidth = v; },
  containerEl: container,
  render,
  openFile: (path) => this.app.workspace.openLinkText(path, "", true),
  addDocumentClickHandler: (h) => this.cleanupManager.registerDocumentClick(h),
  scrollToEntry: (index) => {
    const entries = container.querySelectorAll<HTMLElement>(".zen-scrap-entry");
    if (entries[index]) {
      entries[index].scrollIntoView({ behavior: "smooth", block: "start" });
    }
  },
};
```

行169のTimelineDeps: `filterMarked` と `setFilterMarked` を削除。代わりに `inboxRepo` を追加:
```typescript
const timelineDeps: TimelineDeps = {
  scrap,
  repo: this.repo,
  collectionRepo: this.collectionRepo,
  inboxRepo: this.inboxRepo,  // 追加
  app: this.app,
  render,
  markdownRenderer: this.markdownRenderer,
  addDocumentClickHandler: (h) => this.cleanupManager.registerDocumentClick(h),
  entryEditorDeps: inputAreaDeps,
};
```

注: `this.inboxRepo` はmain.tsからコンストラクタ経由で渡す必要がある。ScrapDetailViewのコンストラクタ引数に `inboxRepo: InboxRepository` を追加し、main.tsのregisterView（行33-35）を更新:

```typescript
this.registerView(VIEW_TYPE_SCRAP_DETAIL, (leaf) =>
  new ScrapDetailView(leaf, this.repo, this.collectionRepo, this.inboxRepo, this.eventBus, this.settings)
);
```

**Step 2: header-renderer.tsからマーク絞り込みを削除**

`src/views/detail/header-renderer.ts`:

HeaderDeps interface（行14-31）から削除:
```typescript
// 削除
filterMarked: boolean;
setFilterMarked: (v: boolean) => void;
```

追加:
```typescript
inboxRepo: import("../../data/inbox-repository").InboxRepository;
```

行51-63のマーク絞り込みトグル全体を削除:
```typescript
// 以下を削除
const hasMarked = scrap.entries.some(e => e.marked);
if (hasMarked || deps.filterMarked) {
  // ... 全部削除
}
```

行70-72のアウトライン内のfilterMarked分岐を削除:
```typescript
// before
const outlineEntries = deps.filterMarked
  ? scrap.entries.map((e, i) => ({ entry: e, index: i })).filter(({ entry }) => entry.marked)
  : scrap.entries.map((e, i) => ({ entry: e, index: i }));

// after
const outlineEntries = scrap.entries.map((e, i) => ({ entry: e, index: i }));
```

importから `BOOKMARK_FILLED_ICON` を削除（行9）。

**Step 3: timeline-renderer.tsからマーク関連を削除し、Inboxボタンに置き換え**

`src/views/detail/timeline-renderer.ts`:

TimelineDeps interface（行11-22）から削除:
```typescript
// 削除
filterMarked?: boolean;
setFilterMarked?: (v: boolean) => void;
```

追加:
```typescript
inboxRepo: import("../../data/inbox-repository").InboxRepository;
```

行6のimportを変更:
```typescript
// before
import { chevronDownIcon, GRIP_ICON, BOOKMARK_ICON, BOOKMARK_FILLED_ICON } from "../../icons";

// after
import { chevronDownIcon, GRIP_ICON, INBOX_ICON, INBOX_FILLED_ICON } from "../../icons";
```

行70-81のfilterMarked絞り込みロジックを削除:
```typescript
// 以下を削除
const entriesToRender = deps.filterMarked
  ? scrap.entries.map((e, i) => ({ entry: e, originalIndex: i })).filter(({ entry }) => entry.marked)
  : scrap.entries.map((e, i) => ({ entry: e, originalIndex: i }));

if (deps.filterMarked && entriesToRender.length === 0) {
  if (deps.setFilterMarked) {
    deps.setFilterMarked(false);
    await render();
    return;
  }
}

// 代わりに:
const entriesToRender = scrap.entries.map((e, i) => ({ entry: e, originalIndex: i }));
```

行83-95のマーク絞り込み時まとめてコピーボタンを削除。

行174-186のマークボタンをInboxボタンに置き換え:
```typescript
// Inboxボタン
const inInbox = await deps.inboxRepo.has(scrap.filePath, entry.timestamp);
const inboxBtn = entryHeader.createEl("button", {
  cls: `zen-scrap-inbox-btn${inInbox ? " is-active" : ""}`,
});
inboxBtn.innerHTML = inInbox ? INBOX_FILLED_ICON : INBOX_ICON;
inboxBtn.setAttribute("aria-label", inInbox ? "Inboxから削除" : "Inboxに追加");
inboxBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  if (inInbox) {
    await deps.inboxRepo.remove(scrap.filePath, entry.timestamp);
  } else {
    await deps.inboxRepo.add(scrap.filePath, entry.timestamp);
  }
  await render();
});
```

注: `deps.inboxRepo.has()` が async なので、Inboxボタンの生成をPhase 2のrenderTasksに移動するか、エントリDOM生成ループ自体をasyncにする必要がある。既にforループが同期だが、ボタン生成部分だけrenderTasksに含めるのが既存パターンと整合する。

**Step 4: ビルドして型チェック**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`
Expected: PASS

**Step 5: コミット**

```bash
git add src/views/scrap-detail-view.ts src/views/detail/header-renderer.ts src/views/detail/timeline-renderer.ts src/main.ts
git commit -m "詳細画面のマーク機能をInboxボタンに置き換え、絞り込み削除"
```

---

### Task 8: ScrapEntry.markedの廃止とパーサー更新

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/scrap-parser.ts`

**Step 1: types.tsからmarkedを削除**

`src/data/types.ts` 行4を削除:
```typescript
// before
export interface ScrapEntry {
  timestamp: string;
  body: string;
  marked?: boolean;
}

// after
export interface ScrapEntry {
  timestamp: string;
  body: string;
}
```

**Step 2: scrap-parser.tsを更新**

パース側（行55）: 正規表現は `[marked]` を読み飛ばすために残すが、`marked` フィールドへの代入を削除:

```typescript
// before (行60-64)
entries.push({
  timestamp: match[1].trim(),
  body: entryBody,
  marked: !!match[2],
});

// after
entries.push({
  timestamp: match[1].trim(),
  body: entryBody,
});
```

正規表現（行55）は変更しない。`( \[marked\])?` 部分は残しておくことで、既存ファイルの `[marked]` タグを壊さずに読み飛ばせる。

シリアライズ側（行102）: `[marked]` タグの書き込みを削除:

```typescript
// before
lines.push(`### ${entry.timestamp}${entry.marked ? " [marked]" : ""}`);

// after
lines.push(`### ${entry.timestamp}`);
```

**Step 3: ビルドして型チェック**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`
Expected: PASS（全ての `entry.marked` 参照はTask 7で削除済み）

もし型エラーが出た場合は、残っている `entry.marked` 参照を探して削除する。

**Step 4: コミット**

```bash
git add src/data/types.ts src/data/scrap-parser.ts
git commit -m "ScrapEntry.markedの廃止、パーサーの[marked]書き込み削除"
```

---

### Task 9: marked-list-view.tsの削除とCSS更新

**Files:**
- Delete: `src/views/marked-list-view.ts`
- Modify: `styles.app.css`

**Step 1: marked-list-view.tsを削除**

```bash
rm src/views/marked-list-view.ts
```

**Step 2: CSSからマーク関連スタイルを削除し、Inbox用スタイルを追加**

`styles.app.css` から以下のクラスを削除:
- `.zen-scrap-mark-btn` 関連（行1697-1726付近）
- `.zen-scrap-filter-mark-btn` 関連（行1763-1781付近）
- `.zen-scrap-marked-*` 関連（行1787-1920付近）
- `.zen-scrap-marked-bulk-bar` 関連

代わりにInbox用スタイルを追加:

```css
/* Inbox ボタン */
.zen-scrap-inbox-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 2px 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  opacity: 0.4;
  transition: opacity var(--transition-base), color var(--transition-base);
  margin-left: auto;
}

.zen-scrap-inbox-btn:hover {
  opacity: 1;
}

.zen-scrap-inbox-btn.is-active {
  color: var(--interactive-accent);
  opacity: 1;
}

.zen-scrap-entry:hover .zen-scrap-inbox-btn {
  opacity: 0.7;
}

.zen-scrap-entry:hover .zen-scrap-inbox-btn.is-active {
  opacity: 1;
}

/* Inbox 一覧 */
.zen-scrap-inbox-list-container {
  max-width: var(--content-width);
  margin: 0 auto;
  padding: 16px;
  overflow-y: auto;
  height: 100%;
}

.zen-scrap-inbox-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zen-scrap-inbox-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-md);
  background: var(--background-primary);
  transition: background-color var(--transition-base);
}

.zen-scrap-inbox-item:hover {
  background: var(--background-secondary);
}

.zen-scrap-inbox-checkbox {
  margin-top: 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.zen-scrap-inbox-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.zen-scrap-inbox-preview {
  font-size: var(--font-base);
  color: var(--text-normal);
  line-height: 1.4;
  margin-bottom: 4px;
}

.zen-scrap-inbox-meta {
  display: flex;
  gap: 6px;
  font-size: var(--font-sm);
  color: var(--text-muted);
}

.zen-scrap-inbox-source {
  font-weight: var(--weight-semibold);
}

/* Inbox バッジ */
.zen-scrap-inbox-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  font-size: 11px;
  font-weight: var(--weight-semibold);
  margin-left: 4px;
}
```

**Step 3: ビルドして型チェック**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`
Expected: PASS

**Step 4: コミット**

```bash
git add -A
git commit -m "marked-list-view.ts削除、CSSをマーク→Inboxに更新"
```

---

### Task 10: 不要アイコンの削除と最終確認

**Files:**
- Modify: `src/icons.ts`
- Modify: `src/views/shared/tab-nav-renderer.ts`（他ビューのタブactiveTab型確認）

**Step 1: BOOKMARK系アイコンの削除**

`src/icons.ts` から以下を削除（他ファイルからの参照がないことを確認してから）:
- `BOOKMARK_ICON`（行32）
- `BOOKMARK_FILLED_ICON`（行34）
- `BOOKMARK_OFF_ICON`（行38）

**Step 2: 他のビューのactiveTab参照を確認・修正**

以下のファイルで `activeTab: "marked"` を `activeTab: "inbox"` に変更（該当がある場合のみ）:
- `src/views/scrap-list-view.ts` → `activeTab: "list"` のまま。変更不要
- `src/views/collection-list-view.ts` → `activeTab: "collection"` のまま。変更不要

**Step 3: フルビルド**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`
Expected: ビルド成功

**Step 4: コミット**

```bash
git add -A
git commit -m "不要なBOOKMARKアイコン削除、最終ビルド確認"
```

---

### Task 11: 動作確認

**Step 1: Obsidianでプラグインをリロードして以下を確認**

- [ ] タブナビが「一覧 | Inbox | コレクション」に変わっている
- [ ] Inboxタブにバッジが表示される（アイテムがある場合）
- [ ] スクラップ詳細画面でエントリに受信箱アイコンが表示される
- [ ] アイコンクリックでInboxに追加される
- [ ] 再度クリックでInboxから削除される
- [ ] Inbox一覧画面でチェックボックスをクリックするとアイテムが消える
- [ ] Inbox一覧でエントリクリックするとスクラップ詳細に遷移する
- [ ] 検索が動作する
- [ ] マーク絞り込みボタンが消えている
- [ ] 既存の `[marked]` タグがあるスクラップファイルが正常に読み込める
- [ ] 既存のコレクション機能に影響がない

**Step 2: バージョンアップ**

`manifest.json` と `package.json` のバージョンを `0.4.0` に更新（マーク→Inboxは破壊的変更のためminor bump）。

**Step 3: コミット**

```bash
git add manifest.json package.json
git commit -m "v0.4.0: マーク機能廃止、Inbox機能導入"
```
