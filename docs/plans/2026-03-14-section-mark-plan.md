# セクションマーク & 活用機能 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** スクラップのセクション（エントリ）にマークをつけ、マーク済みセクションを絞り込み・一覧表示・コピーできるようにする

**Architecture:** ScrapEntryにmarkedフラグを追加し、パーサーで`[marked]`記法を読み書きする。詳細画面にマーク/コピー/絞り込み機能を追加し、マーク一覧ページを新規ビューとして作成する。

**Tech Stack:** TypeScript, Obsidian Plugin API, DOM操作

---

### Task 1: ScrapEntryにmarkedフィールドを追加

**Files:**
- Modify: `src/data/types.ts:1-4`

**Step 1: ScrapEntryにmarkedを追加**

```typescript
export interface ScrapEntry {
  timestamp: string; // "2026-03-10 14:30" 形式
  body: string;
  marked?: boolean;
}
```

**Step 2: ビルドして型エラーがないことを確認**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`
Expected: エラーなし（オプショナルなので既存コードに影響しない）

**Step 3: コミット**

```bash
git add src/data/types.ts
git commit -m "ScrapEntryにmarkedフィールドを追加"
```

---

### Task 2: パーサーで[marked]記法を読み書き

**Files:**
- Modify: `src/data/scrap-parser.ts:48-56` (パース処理)
- Modify: `src/data/scrap-parser.ts:85-91` (シリアライズ処理)

**Step 1: エントリ解析の正規表現を拡張**

`src/data/scrap-parser.ts` の行48の正規表現を変更し、`[marked]` をオプショナルにキャプチャする。

変更前:
```typescript
const entryRegex = /### (\d{4}-\d{2}-\d{2} \d{2}:\d{2})\n([\s\S]*?)(?=\n---\n\n### \d{4}-\d{2}-\d{2} \d{2}:\d{2}|$)/g;
```

変更後:
```typescript
const entryRegex = /### (\d{4}-\d{2}-\d{2} \d{2}:\d{2})( \[marked\])?\n([\s\S]*?)(?=\n---\n\n### \d{4}-\d{2}-\d{2} \d{2}:\d{2}|$)/g;
```

行51-56のエントリ生成も更新:
```typescript
while ((match = entryRegex.exec(body)) !== null) {
  const entryBody = match[3].replace(/\n---\s*$/, "").trim();
  entries.push({
    timestamp: match[1].trim(),
    body: entryBody,
    marked: !!match[2],
  });
}
```

**Step 2: シリアライズ処理を更新**

行86を変更:
```typescript
lines.push(`### ${entry.timestamp}${entry.marked ? " [marked]" : ""}`);
```

**Step 3: ビルド確認**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`
Expected: エラーなし

**Step 4: 手動テスト**

Obsidianでプラグインをリロードし、既存のスクラップが正常に表示されることを確認。
テスト用にMarkdownファイルのセクション見出しに手動で `[marked]` を追記し、表示が壊れないことを確認。

**Step 5: コミット**

```bash
git add src/data/scrap-parser.ts
git commit -m "パーサーで[marked]記法の読み書きに対応"
```

---

### Task 3: マーク用アイコンとコピー用アイコンを追加

**Files:**
- Modify: `src/icons.ts`

**Step 1: アイコンを追加**

`src/icons.ts` の末尾に追加:

```typescript
export const BOOKMARK_ICON = `<svg ${stroke(16)}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;

export const BOOKMARK_FILLED_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;

export const COPY_ICON = `<svg ${stroke(16)}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
```

**Step 2: ビルド確認**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`

**Step 3: コミット**

```bash
git add src/icons.ts
git commit -m "マーク用・コピー用アイコンを追加"
```

---

### Task 4: セクションにマークボタンとコピーボタンを追加

**Files:**
- Modify: `src/views/detail/timeline-renderer.ts`

**Step 1: import文を更新**

行4を変更:
```typescript
import { chevronDownIcon, GRIP_ICON, BOOKMARK_ICON, BOOKMARK_FILLED_ICON, COPY_ICON } from "../../icons";
```

行1にNoticeを追加:
```typescript
import { Notice } from "obsidian";
```

**Step 2: エントリヘッダーにマークボタンを追加**

行136（タイムスタンプ表示）の後に追加:

```typescript
    // マークボタン
    const markBtn = entryHeader.createEl("button", {
      cls: `zen-scrap-mark-btn${entry.marked ? " is-marked" : ""}`,
    });
    markBtn.innerHTML = entry.marked ? BOOKMARK_FILLED_ICON : BOOKMARK_ICON;
    markBtn.setAttribute("aria-label", entry.marked ? "マーク解除" : "マーク");
    markBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      entry.marked = !entry.marked;
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await render();
    });
```

**Step 3: エントリメニューにコピーを追加**

行144（editItemの定義）の前に追加:

```typescript
    const copyItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: "コピー" });
    copyItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      menu.classList.remove("is-open");
      await navigator.clipboard.writeText(entry.body);
      new Notice("セクションをコピーしました");
    });
```

**Step 4: ビルド確認**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`

**Step 5: 手動テスト**

- マークボタンをクリックしてアイコンが切り替わることを確認
- Markdownファイルに `[marked]` が書き込まれることを確認
- コピーボタンでクリップボードにセクション内容がコピーされることを確認

**Step 6: コミット**

```bash
git add src/views/detail/timeline-renderer.ts
git commit -m "セクションにマークボタンとコピーボタンを追加"
```

---

### Task 5: マークボタンとコピーボタンのCSS

**Files:**
- Modify: `styles.app.css`

**Step 1: マーク関連のスタイルを追加**

`styles.app.css` の末尾に追加:

```css
/* マークボタン */
.zen-scrap-mark-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 2px 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  opacity: 0.4;
  transition: opacity 0.15s, color 0.15s;
}

.zen-scrap-mark-btn:hover {
  opacity: 1;
}

.zen-scrap-mark-btn.is-marked {
  color: var(--interactive-accent);
  opacity: 1;
}

.zen-scrap-entry:hover .zen-scrap-mark-btn {
  opacity: 0.7;
}

.zen-scrap-entry:hover .zen-scrap-mark-btn.is-marked {
  opacity: 1;
}
```

**Step 2: CSSビルド**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build:css`

**Step 3: 手動テスト**

マークボタンの見た目を確認。未マーク時は薄く、ホバーで見える。マーク済みはアクセントカラーで常に表示。

**Step 4: コミット**

```bash
git add styles.app.css styles.css
git commit -m "マークボタンのCSSを追加"
```

---

### Task 6: スクラップ内マーク絞り込み

**Files:**
- Modify: `src/views/scrap-detail-view.ts`
- Modify: `src/views/detail/header-renderer.ts`
- Modify: `src/views/detail/timeline-renderer.ts`

**Step 1: ScrapDetailViewにfilterMarked状態を追加**

`src/views/scrap-detail-view.ts` 行21の後に追加:
```typescript
  private filterMarked = false;
```

**Step 2: HeaderDepsにfilterMarked関連を追加**

`src/views/detail/header-renderer.ts` のHeaderDepsインターフェースに追加:
```typescript
  filterMarked: boolean;
  setFilterMarked: (v: boolean) => void;
```

**Step 3: headerDepsにfilterMarkedを渡す**

`src/views/scrap-detail-view.ts` のheaderDeps構築（行98-116）に追加:
```typescript
      filterMarked: this.filterMarked,
      setFilterMarked: (v) => { this.filterMarked = v; },
```

**Step 4: ヘッダーにマーク絞り込みトグルを追加**

`src/views/detail/header-renderer.ts` のアウトラインドロップダウン（行45-100）の前に、BOOKMARK_ICONのimportを追加:

```typescript
import { chevronLeftIcon, EXPAND_ICON, SHRINK_ICON, TRIANGLE_DOWN_ICON, EDIT_ICON, MORE_ICON, HELP_ICON, OUTLINE_ICON, BOOKMARK_FILLED_ICON } from "../../icons";
```

アウトラインドロップダウンの前（行45の直前）にマーク絞り込みボタンを追加:

```typescript
  // マーク絞り込みトグル
  const hasMarked = scrap.entries.some(e => e.marked);
  if (hasMarked) {
    const filterMarkBtn = navRight.createEl("button", {
      cls: `zen-scrap-filter-mark-btn${deps.filterMarked ? " is-active" : ""}`,
    });
    filterMarkBtn.innerHTML = BOOKMARK_FILLED_ICON;
    filterMarkBtn.setAttribute("aria-label", deps.filterMarked ? "全て表示" : "マーク済みのみ");
    filterMarkBtn.addEventListener("click", async () => {
      deps.setFilterMarked(!deps.filterMarked);
      await deps.render();
    });
  }
```

**Step 5: TimelineDepsにfilterMarkedを追加**

`src/views/detail/timeline-renderer.ts` のTimelineDepsに追加:
```typescript
  filterMarked?: boolean;
```

**Step 6: scrap-detail-viewからtimelineDepsにfilterMarkedを渡す**

```typescript
    const timelineDeps: TimelineDeps = {
      scrap,
      repo: this.repo,
      render,
      markdownRenderer: this.markdownRenderer,
      addDocumentClickHandler: (h) => this.cleanupManager.registerDocumentClick(h),
      entryEditorDeps: inputAreaDeps,
      filterMarked: this.filterMarked,
    };
```

**Step 7: タイムラインでfilterMarkedに応じてエントリをフィルタリング**

`src/views/detail/timeline-renderer.ts` のrenderTimeline関数、行63のforループの直前に追加:

```typescript
  const entriesToRender = deps.filterMarked
    ? scrap.entries.map((e, i) => ({ entry: e, originalIndex: i })).filter(({ entry }) => entry.marked)
    : scrap.entries.map((e, i) => ({ entry: e, originalIndex: i }));
```

forループを変更:
```typescript
  for (const { entry, originalIndex: i } of entriesToRender) {
```

注意: ループ内の `scrap.entries[i]` への参照はすべてoriginalIndexを使うので、ドラッグ&ドロップや削除の動作は正しく維持される。

**Step 8: アウトラインドロップダウンもfilterMarkedで絞り込み**

`src/views/detail/header-renderer.ts` のHeaderDeps経由でfilterMarkedを受け取っているので、アウトラインのエントリ表示（行60-91のforEach）でフィルタを適用:

```typescript
    const outlineEntries = deps.filterMarked
      ? scrap.entries.map((e, i) => ({ entry: e, index: i })).filter(({ entry }) => entry.marked)
      : scrap.entries.map((e, i) => ({ entry: e, index: i }));

    outlineEntries.forEach(({ entry, index: i }) => {
```

バッジの数も更新:
```typescript
    outlineBtn.innerHTML = `${OUTLINE_ICON}<span class="zen-scrap-outline-badge">${outlineEntries.length}</span>`;
```

**Step 9: ビルド確認**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`

**Step 10: 手動テスト**

- マーク済みエントリがあるスクラップで絞り込みボタンが表示されることを確認
- ボタンを押すとマーク済みだけ表示されることを確認
- アウトラインドロップダウンも連動して絞り込まれることを確認
- もう一度押すと全表示に戻ることを確認

**Step 11: コミット**

```bash
git add src/views/scrap-detail-view.ts src/views/detail/header-renderer.ts src/views/detail/timeline-renderer.ts
git commit -m "スクラップ内マーク絞り込み機能を追加"
```

---

### Task 7: マーク絞り込みボタンのCSS

**Files:**
- Modify: `styles.app.css`

**Step 1: スタイルを追加**

```css
/* マーク絞り込みボタン */
.zen-scrap-filter-mark-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.zen-scrap-filter-mark-btn:hover {
  background: var(--background-modifier-hover);
}

.zen-scrap-filter-mark-btn.is-active {
  color: var(--interactive-accent);
  background: var(--background-modifier-hover);
}
```

**Step 2: CSSビルド**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build:css`

**Step 3: コミット**

```bash
git add styles.app.css styles.css
git commit -m "マーク絞り込みボタンのCSSを追加"
```

---

### Task 8: マーク一覧ページ - イベントとナビゲーション

**Files:**
- Modify: `src/events/constants.ts`
- Modify: `src/events/nav-handlers.ts`
- Modify: `src/main.ts`

**Step 1: イベント定数を追加**

`src/events/constants.ts` に追加:

```typescript
export const EVENTS = {
  SCRAP_SELECT: "scrap:select",
  SCRAP_CREATE_REQUEST: "scrap:create-request",
  SCRAP_CHANGED: "scrap:changed",
  NAV_BACK_TO_LIST: "nav:back-to-list",
  NAV_TO_MARKED_LIST: "nav:to-marked-list",
} as const;
```

**Step 2: nav-handlers.tsにマーク一覧へのナビゲーションを追加**

`src/events/nav-handlers.ts` を読んで、既存のNAV_BACK_TO_LISTの登録と同じパターンでNAV_TO_MARKED_LISTを追加する。

**Step 3: main.tsにマーク一覧ビューを登録**

まずビュークラスのimportを追加（ビュークラスはTask 9で作成する）:
```typescript
import { MarkedListView, VIEW_TYPE_MARKED_LIST } from "./views/marked-list-view";
```

onload()内にビュー登録を追加:
```typescript
    this.registerView(VIEW_TYPE_MARKED_LIST, (leaf) =>
      new MarkedListView(leaf, this.repo, this.eventBus)
    );
```

NAV_TO_MARKED_LISTイベントでマーク一覧を開く処理を追加:
```typescript
    this.eventBus.on(EVENTS.NAV_TO_MARKED_LIST, () => this.openMarkedList());
```

openMarkedListメソッドを追加:
```typescript
  async openMarkedList() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_MARKED_LIST)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true)!;
    }
    await leaf.setViewState({
      type: VIEW_TYPE_MARKED_LIST,
      active: true,
    });
    workspace.revealLeaf(leaf);
  }
```

**Step 4: コミット（ビルドはTask 9完了後に確認）**

```bash
git add src/events/constants.ts src/events/nav-handlers.ts src/main.ts
git commit -m "マーク一覧ページへのナビゲーションを追加"
```

---

### Task 9: マーク一覧ページ - ビューの実装

**Files:**
- Create: `src/views/marked-list-view.ts`

**Step 1: マーク一覧ビューを作成**

```typescript
import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { Scrap, ScrapEntry } from "../data/types";
import { chevronLeftIcon, BOOKMARK_FILLED_ICON, COPY_ICON } from "../icons";
import { formatDate } from "../utils";
import { CleanupManager } from "../ui/cleanup-manager";

export const VIEW_TYPE_MARKED_LIST = "zen-scrap-marked-list";

interface MarkedSection {
  scrap: Scrap;
  entry: ScrapEntry;
  entryIndex: number;
}

export class MarkedListView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private onScrapChangedHandler: () => void;
  private cleanupManager = new CleanupManager();
  private selectedIndices = new Set<number>();

  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, eventBus: EventBus) {
    super(leaf);
    this.repo = repo;
    this.eventBus = eventBus;
    this.onScrapChangedHandler = () => this.render();
  }

  getViewType(): string {
    return VIEW_TYPE_MARKED_LIST;
  }

  getDisplayText(): string {
    return "マーク一覧";
  }

  getIcon(): string {
    return "bookmark";
  }

  async onOpen(): Promise<void> {
    this.eventBus.on(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
    this.cleanupManager.cleanup();
  }

  private async collectMarkedSections(): Promise<MarkedSection[]> {
    const scraps = await this.repo.listAll();
    const sections: MarkedSection[] = [];
    for (const scrap of scraps) {
      for (let i = 0; i < scrap.entries.length; i++) {
        if (scrap.entries[i].marked) {
          sections.push({ scrap, entry: scrap.entries[i], entryIndex: i });
        }
      }
    }
    // 新しいものが上に来るよう、スクラップの更新日でソート
    sections.sort((a, b) => new Date(b.scrap.updated).getTime() - new Date(a.scrap.updated).getTime());
    return sections;
  }

  async render(): Promise<void> {
    this.cleanupManager.cleanup();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-marked-list-container");

    // ヘッダー
    const header = container.createDiv({ cls: "zen-scrap-marked-list-header" });
    const navRow = header.createDiv({ cls: "zen-scrap-detail-nav" });

    const backBtn = navRow.createEl("button", { cls: "zen-scrap-back-btn" });
    backBtn.innerHTML = `${chevronLeftIcon(14)} 一覧へ戻る`;
    backBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.NAV_BACK_TO_LIST));

    header.createEl("h2", { text: "マーク一覧" });

    const sections = await this.collectMarkedSections();

    if (sections.length === 0) {
      container.createDiv({ cls: "zen-scrap-empty", text: "マークされたセクションがありません" });
      return;
    }

    // まとめてコピーボタン
    const toolbar = container.createDiv({ cls: "zen-scrap-marked-toolbar" });
    const bulkCopyBtn = toolbar.createEl("button", {
      text: "選択中をまとめてコピー",
      cls: "zen-scrap-bulk-copy-btn",
    });
    bulkCopyBtn.style.display = "none";

    const updateBulkBtn = () => {
      if (this.selectedIndices.size > 0) {
        bulkCopyBtn.style.display = "";
        bulkCopyBtn.setText(`選択中(${this.selectedIndices.size}件)をまとめてコピー`);
      } else {
        bulkCopyBtn.style.display = "none";
      }
    };

    bulkCopyBtn.addEventListener("click", async () => {
      const selectedBodies = sections
        .filter((_, i) => this.selectedIndices.has(i))
        .map(s => s.entry.body)
        .join("\n\n---\n\n");
      await navigator.clipboard.writeText(selectedBodies);
      new Notice(`${this.selectedIndices.size}件のセクションをコピーしました`);
    });

    // セクション一覧
    const list = container.createDiv({ cls: "zen-scrap-marked-list" });

    sections.forEach((section, sectionIdx) => {
      const item = list.createDiv({ cls: "zen-scrap-marked-item" });

      // チェックボックス（複数選択用）
      const checkbox = item.createEl("input", { type: "checkbox" });
      checkbox.addClass("zen-scrap-marked-checkbox");
      checkbox.checked = this.selectedIndices.has(sectionIdx);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selectedIndices.add(sectionIdx);
        } else {
          this.selectedIndices.delete(sectionIdx);
        }
        updateBulkBtn();
      });

      const content = item.createDiv({ cls: "zen-scrap-marked-content" });

      // メタ情報行
      const meta = content.createDiv({ cls: "zen-scrap-marked-meta" });
      meta.createSpan({ text: section.scrap.title, cls: "zen-scrap-marked-source" });
      meta.createSpan({ text: section.entry.timestamp, cls: "zen-scrap-marked-time" });

      // プレビュー
      const stripped = section.entry.body
        .replace(/[#*`>\-\[\]()!]/g, "")
        .replace(/\n/g, " ")
        .trim();
      const preview = stripped.slice(0, 120) + (stripped.length > 120 ? "..." : "");
      content.createDiv({ text: preview, cls: "zen-scrap-marked-preview" });

      // アクションボタン
      const actions = item.createDiv({ cls: "zen-scrap-marked-actions" });

      const copyBtn = actions.createEl("button", { cls: "zen-scrap-marked-copy-btn" });
      copyBtn.innerHTML = COPY_ICON;
      copyBtn.setAttribute("aria-label", "コピー");
      copyBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(section.entry.body);
        new Notice("セクションをコピーしました");
      });

      // クリックで元スクラップに遷移
      content.addEventListener("click", () => {
        this.eventBus.emit(EVENTS.SCRAP_SELECT, section.scrap);
      });
    });
  }
}
```

**Step 2: ビルド確認**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`

**Step 3: 手動テスト**

- スクラップ一覧からマーク一覧ページに遷移できることを確認
- マーク済みセクションが表示されることを確認
- セクションをクリックで元スクラップに遷移することを確認
- コピーボタンでセクション内容がコピーされることを確認
- チェックボックスで複数選択してまとめてコピーできることを確認
- 「一覧へ戻る」で戻れることを確認

**Step 4: コミット**

```bash
git add src/views/marked-list-view.ts
git commit -m "マーク一覧ページを実装"
```

---

### Task 10: スクラップ一覧にマーク一覧ボタンを追加

**Files:**
- Modify: `src/views/scrap-list-view.ts`

**Step 1: import文を更新**

```typescript
import { EVENTS } from "../events/constants";
import { BOOKMARK_FILLED_ICON } from "../icons";
```

**Step 2: renderHeader内にマーク一覧ボタンを追加**

`src/views/scrap-list-view.ts` のrenderHeader（行63-69）で、headerの中にマーク一覧ボタンを追加:

```typescript
  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "zen-scrap-list-header" });
    header.createEl("h2", { text: "Zen Scrap" });

    const headerRight = header.createDiv({ cls: "zen-scrap-list-header-right" });

    const markedBtn = headerRight.createEl("button", { cls: "zen-scrap-marked-list-btn" });
    markedBtn.innerHTML = BOOKMARK_FILLED_ICON;
    markedBtn.setAttribute("aria-label", "マーク一覧");
    markedBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.NAV_TO_MARKED_LIST));

    const newBtn = headerRight.createEl("button", { text: "+ 新規作成", cls: "zen-scrap-new-btn" });
    newBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.SCRAP_CREATE_REQUEST));
  }
```

**Step 3: ビルド確認**

Run: `cd /Users/snyt45/work/zen-scrap && npx tsc --noEmit`

**Step 4: コミット**

```bash
git add src/views/scrap-list-view.ts
git commit -m "スクラップ一覧にマーク一覧ボタンを追加"
```

---

### Task 11: マーク一覧ページのCSS

**Files:**
- Modify: `styles.app.css`

**Step 1: マーク一覧ページのスタイルを追加**

```css
/* マーク一覧ページ */
.zen-scrap-marked-list-container {
  padding: 16px;
  overflow-y: auto;
  height: 100%;
}

.zen-scrap-marked-list-header h2 {
  margin: 8px 0 16px;
  font-size: 1.2em;
}

.zen-scrap-marked-toolbar {
  margin-bottom: 12px;
}

.zen-scrap-bulk-copy-btn {
  font-size: 0.85em;
  padding: 4px 12px;
  border-radius: 4px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  cursor: pointer;
}

.zen-scrap-bulk-copy-btn:hover {
  opacity: 0.9;
}

.zen-scrap-marked-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.zen-scrap-marked-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-primary);
}

.zen-scrap-marked-item:hover {
  background: var(--background-secondary);
}

.zen-scrap-marked-checkbox {
  margin-top: 4px;
  cursor: pointer;
}

.zen-scrap-marked-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.zen-scrap-marked-meta {
  display: flex;
  gap: 8px;
  font-size: 0.8em;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.zen-scrap-marked-source {
  font-weight: 600;
  color: var(--text-normal);
}

.zen-scrap-marked-preview {
  font-size: 0.9em;
  color: var(--text-muted);
  line-height: 1.4;
}

.zen-scrap-marked-actions {
  display: flex;
  align-items: center;
}

.zen-scrap-marked-copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
}

.zen-scrap-marked-copy-btn:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

/* スクラップ一覧ヘッダーの右側 */
.zen-scrap-list-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zen-scrap-marked-list-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.zen-scrap-marked-list-btn:hover {
  background: var(--background-modifier-hover);
  color: var(--interactive-accent);
}
```

**Step 2: CSSビルド**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build:css`

**Step 3: コミット**

```bash
git add styles.app.css styles.css
git commit -m "マーク一覧ページのCSSを追加"
```

---

### Task 12: nav-handlers.tsの更新と最終動作確認

**Files:**
- Modify: `src/events/nav-handlers.ts`

**Step 1: nav-handlers.tsを確認し、NAV_TO_MARKED_LISTのハンドラを追加**

既存のファイルを確認して、NAV_BACK_TO_LISTと同じパターンでNAV_TO_MARKED_LISTを登録する。

**Step 2: フルビルド**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`

**Step 3: 全機能の手動テスト**

1. セクションにマークをつけられる
2. マーク解除できる
3. セクションをコピーできる
4. マーク絞り込みでマーク済みだけ表示される
5. アウトラインも連動して絞り込まれる
6. スクラップ一覧からマーク一覧に遷移できる
7. マーク一覧でプレビュー・コピー・まとめてコピーができる
8. マーク一覧からスクラップ詳細に遷移できる
9. 「一覧へ戻る」で戻れる
10. 既存のスクラップが壊れていない

**Step 4: コミット**

```bash
git add src/events/nav-handlers.ts
git commit -m "マーク一覧へのナビゲーションハンドラを追加"
```
