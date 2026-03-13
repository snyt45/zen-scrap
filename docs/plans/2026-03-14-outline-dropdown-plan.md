# アウトラインドロップダウン実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ミニマップを廃止し、エントリ一覧のドロップダウンから目的のエントリにジャンプできるアウトラインUIに置き換える

**Architecture:** ヘッダーのミニマップボタンをアウトラインボタンに差し替え、クリックでドロップダウンを開く。既存のドロップダウンパターン（`is-open`クラストグル + `addDocumentClickHandler`）をそのまま踏襲する。ミニマップ関連のコードとCSSはすべて削除する。

**Tech Stack:** TypeScript, Obsidian API, CSS

---

### Task 1: ミニマップのコード・CSS・アイコンを削除

**Files:**
- Delete: `src/ui/minimap-renderer.ts`
- Modify: `src/views/scrap-detail-view.ts`
- Modify: `src/views/detail/header-renderer.ts`
- Modify: `src/icons.ts`
- Modify: `styles.app.css`

**Step 1: `minimap-renderer.ts` を削除**

Run: `rm src/ui/minimap-renderer.ts`

**Step 2: `scrap-detail-view.ts` からミニマップ関連コードを削除**

import文の `createMinimap, toggleMinimap, showMinimap, destroyMinimap` を削除。
以下のプロパティを削除:
```typescript
private minimapState: ReturnType<typeof createMinimap> | null = null;
private isMinimapVisible = false;
```

`onClose()` から `if (this.minimapState) destroyMinimap(this.minimapState);` を削除。

`headerDeps` から `onToggleMinimap` を削除:
```typescript
// 削除
onToggleMinimap: () => {
  this.isMinimapVisible = !this.isMinimapVisible;
  if (this.minimapState) toggleMinimap(this.minimapState);
},
```

`render()` からミニマップ生成ブロック（142〜149行目）を削除:
```typescript
// 削除
const timelineEl = container.querySelector<HTMLElement>(".zen-scrap-timeline");
if (timelineEl) {
  if (this.minimapState) destroyMinimap(this.minimapState);
  this.minimapState = createMinimap(container, timelineEl, container);
  if (this.isMinimapVisible) {
    showMinimap(this.minimapState);
  }
}
```

**Step 3: `header-renderer.ts` からミニマップボタンを削除**

import文から `MINIMAP_ICON` を削除。
`HeaderDeps` から `onToggleMinimap: () => void;` を削除。
ミニマップボタン生成コード（45〜48行目）を削除:
```typescript
// 削除
const minimapBtn = navRight.createEl("button", { cls: "zen-scrap-minimap-toggle" });
minimapBtn.innerHTML = MINIMAP_ICON;
minimapBtn.setAttribute("aria-label", "ミニマップ");
minimapBtn.addEventListener("click", () => deps.onToggleMinimap());
```

**Step 4: `icons.ts` から `MINIMAP_ICON` を削除**

30行目を削除:
```typescript
// 削除
export const MINIMAP_ICON = `<svg ...`;
```

**Step 5: `styles.app.css` からミニマップCSSを削除**

1567〜1590行目（セクション9. Minimap全体）を削除。
502〜520行目のボタンスタイルから `.zen-scrap-minimap-toggle` を削除:
```css
/* Before */
.zen-scrap-fullwidth-toggle,
.zen-scrap-help-btn,
.zen-scrap-minimap-toggle {
/* After */
.zen-scrap-fullwidth-toggle,
.zen-scrap-help-btn {
```
hover側も同様に `.zen-scrap-minimap-toggle:hover` を削除。

**Step 6: ビルドして確認**

Run: `npm run build`
Expected: エラーなしでビルド成功

**Step 7: コミット**

```bash
git add -A
git commit -m "ミニマップ機能を削除"
```

---

### Task 2: アウトラインアイコンを追加

**Files:**
- Modify: `src/icons.ts`

**Step 1: `icons.ts` にアウトラインアイコンを追加**

リスト（箇条書き）アイコンを追加する。Lucide の `list` アイコン相当:
```typescript
export const OUTLINE_ICON = `<svg ${stroke(16)}><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`;
```

**Step 2: ビルドして確認**

Run: `npm run build`
Expected: エラーなしでビルド成功

**Step 3: コミット**

```bash
git add src/icons.ts
git commit -m "アウトラインアイコンを追加"
```

---

### Task 3: アウトラインボタンとドロップダウンをヘッダーに実装

**Files:**
- Modify: `src/views/detail/header-renderer.ts`
- Modify: `src/views/scrap-detail-view.ts`

**Step 1: `header-renderer.ts` の `HeaderDeps` にアウトライン用の依存を追加**

```typescript
import { chevronLeftIcon, EXPAND_ICON, SHRINK_ICON, TRIANGLE_DOWN_ICON, EDIT_ICON, MORE_ICON, HELP_ICON, OUTLINE_ICON } from "../../icons";

export interface HeaderDeps {
  scrap: Scrap;
  repo: ScrapRepository;
  eventBus: EventBus;
  app: import("obsidian").App;
  markdownRenderer: MarkdownRenderer;
  isFullWidth: boolean;
  setFullWidth: (v: boolean) => void;
  containerEl: HTMLElement;
  render: () => Promise<void>;
  openFile: (path: string) => void;
  addDocumentClickHandler: (handler: () => void) => void;
  scrollToEntry: (index: number) => void;
}
```

**Step 2: `renderHeader` にアウトラインボタンとドロップダウンを追加**

fullWidthBtnの後、helpBtnの前に以下を追加:

```typescript
  // アウトラインドロップダウン
  if (scrap.entries.length > 0) {
    const outlineWrapper = navRight.createDiv({ cls: "zen-scrap-outline-wrapper" });
    const outlineBtn = outlineWrapper.createEl("button", { cls: "zen-scrap-outline-btn" });
    outlineBtn.innerHTML = `${OUTLINE_ICON}<span class="zen-scrap-outline-badge">${scrap.entries.length}</span>`;
    outlineBtn.setAttribute("aria-label", "アウトライン");

    const outlineMenu = outlineWrapper.createDiv({ cls: "zen-scrap-outline-menu" });

    const outlineHeader = outlineMenu.createDiv({ cls: "zen-scrap-outline-header" });
    outlineHeader.setText("アウトライン");

    const outlineList = outlineMenu.createDiv({ cls: "zen-scrap-outline-list" });

    scrap.entries.forEach((entry, i) => {
      const item = outlineList.createDiv({ cls: "zen-scrap-outline-item" });
      const meta = item.createDiv({ cls: "zen-scrap-outline-item-meta" });
      meta.createSpan({ text: `${i + 1}`, cls: "zen-scrap-outline-item-number" });
      meta.createSpan({ text: entry.timestamp, cls: "zen-scrap-outline-item-time" });

      const preview = entry.body
        .replace(/[#*`>\-\[\]()!]/g, "")
        .replace(/\n/g, " ")
        .trim()
        .slice(0, 40);
      if (preview) {
        item.createDiv({ text: preview, cls: "zen-scrap-outline-item-preview" });
      }

      item.addEventListener("click", () => {
        outlineMenu.classList.remove("is-open");
        deps.scrollToEntry(i);
      });
    });

    outlineBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = outlineMenu.classList.toggle("is-open");
      if (isOpen) {
        // 現在表示中のエントリをハイライト
        const entries = deps.containerEl.querySelectorAll<HTMLElement>(".zen-scrap-entry");
        const scrollContainer = deps.containerEl;
        const containerTop = scrollContainer.getBoundingClientRect().top;
        let activeIndex = 0;
        entries.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          if (rect.top <= containerTop + 100) {
            activeIndex = i;
          }
        });
        outlineList.querySelectorAll(".zen-scrap-outline-item").forEach((el, i) => {
          el.classList.toggle("is-active", i === activeIndex);
        });
        // アクティブ項目をドロップダウン内でスクロールして見えるようにする
        const activeItem = outlineList.querySelector(".zen-scrap-outline-item.is-active") as HTMLElement | null;
        if (activeItem) {
          activeItem.scrollIntoView({ block: "nearest" });
        }
      }
    });

    const closeOutline = () => { outlineMenu.classList.remove("is-open"); };
    addDocumentClickHandler(closeOutline);
  }
```

**Step 3: `scrap-detail-view.ts` の `headerDeps` を更新**

`onToggleMinimap` を削除し、`scrollToEntry` を追加:

```typescript
    const headerDeps: HeaderDeps = {
      scrap,
      repo: this.repo,
      eventBus: this.eventBus,
      app: this.app,
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

**Step 4: ビルドして確認**

Run: `npm run build`
Expected: エラーなしでビルド成功

**Step 5: コミット**

```bash
git add src/views/detail/header-renderer.ts src/views/scrap-detail-view.ts
git commit -m "アウトラインドロップダウンを実装"
```

---

### Task 4: アウトラインドロップダウンのCSSを追加

**Files:**
- Modify: `styles.app.css`

**Step 1: ボタンスタイルのグループに `.zen-scrap-outline-btn` を追加**

```css
.zen-scrap-fullwidth-toggle,
.zen-scrap-help-btn,
.zen-scrap-outline-btn {
  background: none;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
}

.zen-scrap-fullwidth-toggle:hover,
.zen-scrap-help-btn:hover,
.zen-scrap-outline-btn:hover {
  color: var(--text-normal);
  background: var(--background-secondary);
}
```

**Step 2: CSSファイルの末尾（ミニマップセクションがあった場所）にアウトラインCSSを追加**

```css
/* ==========================================================================
   9. Outline
   ========================================================================== */

.zen-scrap-outline-wrapper {
  position: relative;
}

.zen-scrap-outline-btn {
  gap: 4px;
}

.zen-scrap-outline-badge {
  font-size: 0.75em;
  min-width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  background: var(--background-modifier-border);
  border-radius: 9px;
  padding: 0 5px;
  color: var(--text-muted);
}

.zen-scrap-outline-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  width: 280px;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 20;
  display: none;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.zen-scrap-outline-menu.is-open {
  display: block;
  opacity: 1;
  transform: translateY(0);
}

.zen-scrap-outline-header {
  padding: 8px 12px;
  font-size: 0.8em;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 1px solid var(--background-modifier-border);
}

.zen-scrap-outline-list {
  max-height: 360px;
  overflow-y: auto;
}

.zen-scrap-outline-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--background-modifier-border-hover, rgba(0,0,0,0.05));
}

.zen-scrap-outline-item:last-child {
  border-bottom: none;
}

.zen-scrap-outline-item:hover {
  background: var(--background-secondary);
}

.zen-scrap-outline-item.is-active {
  background: var(--background-secondary);
  border-left: 3px solid var(--interactive-accent);
  padding-left: 9px;
}

.zen-scrap-outline-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8em;
}

.zen-scrap-outline-item-number {
  color: var(--text-muted);
  font-weight: 600;
  min-width: 20px;
}

.zen-scrap-outline-item-time {
  color: var(--text-muted);
}

.zen-scrap-outline-item-preview {
  font-size: 0.8em;
  color: var(--text-faint);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 28px;
}
```

**Step 3: ビルドして確認**

Run: `npm run build`
Expected: エラーなしでビルド成功

**Step 4: コミット**

```bash
git add styles.app.css
git commit -m "アウトラインドロップダウンのCSSを追加"
```

---

### Task 5: 手動動作確認

**Step 1: Obsidianでプラグインをリロード**

- Obsidianの設定 → コミュニティプラグイン → zen-scrapをリロード
- または Cmd+R でObsidianをリロード

**Step 2: 確認項目**

1. スクラップ詳細画面でヘッダー右側にアウトラインボタン（リストアイコン + 件数バッジ）が表示される
2. ボタンクリックでドロップダウンが開く
3. 各項目にエントリ番号、タイムスタンプ、本文プレビューが表示される
4. 現在表示中のエントリがハイライトされている
5. 項目クリックでそのエントリにスムーズスクロールし、ドロップダウンが閉じる
6. ドロップダウン外クリックで閉じる
7. エントリが0件のスクラップではアウトラインボタンが表示されない
8. ミニマップ関連のUI/CSSが残っていない
