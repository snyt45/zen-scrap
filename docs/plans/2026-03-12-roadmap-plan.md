# Zen Scrap ロードマップ実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** リファクタリングで肥大化したビューを分割・構造化し、その上にタグUI、Vault変更検知、D&D画像挿入、エントリ並び替え、Obsidianリンク対応、ピン留め機能を実装する

**Architecture:** ビューの責務を「ヘッダー」「タイムライン」「入力エリア」「リストアイテム」などの小さなレンダラー関数/クラスに分割。ScrapRepositoryにドメインロジックを集約し、ビューはUIレンダリングのみに専念させる。新機能はデータモデル変更 → Repository → UI の順で積み上げる。

**Tech Stack:** TypeScript, Obsidian API, zenn-markdown-html

---

## Phase 0: リファクタリング

### Task 1: ScrapDetailViewの責務分割

**Files:**
- Create: `src/views/detail/header-renderer.ts`
- Create: `src/views/detail/timeline-renderer.ts`
- Create: `src/views/detail/input-area-renderer.ts`
- Create: `src/views/detail/markdown-renderer.ts`
- Modify: `src/views/scrap-detail-view.ts`

**目的:** 619行のScrapDetailViewを責務ごとに分割する。現在の巨大なクラスにある4つの責務（ヘッダー描画、タイムライン描画、入力エリア描画、Markdownレンダリング）をそれぞれ独立したモジュールに切り出す。

**Step 1: markdown-renderer.tsを切り出す**

`renderBody`, `fixImagePaths`, `addCopyButtons` をMarkdownレンダリング専用モジュールに抽出。このモジュールはScrapDetailViewとtimeline-renderer、input-area-rendererから使われる共通機能。

```typescript
// src/views/detail/markdown-renderer.ts
import { App, TFile } from "obsidian";
import markdownToHtml from "zenn-markdown-html";
import { renderEmbed } from "../../ui/embed-renderer";

export class MarkdownRenderer {
  constructor(private app: App) {}

  async renderBody(body: string): Promise<string> {
    // renderBody のロジックをそのまま移動
  }

  fixImagePaths(html: string): string {
    // fixImagePaths のロジックをそのまま移動
  }

  addCopyButtons(container: HTMLElement): void {
    // addCopyButtons のロジックをそのまま移動
  }
}
```

**Step 2: header-renderer.tsを切り出す**

`renderHeader`（ナビ、メタ情報、アクションドロップダウン、タイトル編集）を独立モジュールに。

```typescript
// src/views/detail/header-renderer.ts
import { App } from "obsidian";
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { EventBus } from "../../events/event-bus";

export interface HeaderRendererDeps {
  app: App;
  repo: ScrapRepository;
  eventBus: EventBus;
  scrap: Scrap;
  isFullWidth: boolean;
  containerEl: HTMLElement;
  onToggleFullWidth: (isFullWidth: boolean) => void;
  onRender: () => Promise<void>;
  registerCleanup: (handler: () => void) => void;
}

export function renderHeader(container: HTMLElement, deps: HeaderRendererDeps): void {
  // renderHeader のロジックをそのまま移動
}
```

**Step 3: timeline-renderer.tsを切り出す**

`renderTimeline`, `renderEntryEditor`, `renderClosedBanner` をタイムライン専用モジュールに。

```typescript
// src/views/detail/timeline-renderer.ts
import { App, Scope } from "obsidian";
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { MarkdownRenderer } from "./markdown-renderer";
import type { ZenScrapSettings } from "../../settings";

export interface TimelineRendererDeps {
  app: App;
  repo: ScrapRepository;
  settings: ZenScrapSettings;
  scrap: Scrap;
  scope: Scope | null;
  mdRenderer: MarkdownRenderer;
  onRender: () => Promise<void>;
  registerCleanup: (handler: () => void) => void;
}

export async function renderTimeline(container: HTMLElement, deps: TimelineRendererDeps): Promise<void> {
  // renderTimeline + renderEntryEditor + renderClosedBanner のロジック移動
}
```

**Step 4: input-area-renderer.tsを切り出す**

`renderInputArea`, `handleImageUpload`, `renderEmbedButton`, `setupAutoGrow`, `renderMarkdownGuideLink` を入力エリア専用モジュールに。

```typescript
// src/views/detail/input-area-renderer.ts
import { App, Modal, Scope } from "obsidian";
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { MarkdownRenderer } from "./markdown-renderer";
import type { ZenScrapSettings } from "../../settings";

export interface InputAreaRendererDeps {
  app: App;
  repo: ScrapRepository;
  settings: ZenScrapSettings;
  scrap: Scrap;
  scope: Scope | null;
  mdRenderer: MarkdownRenderer;
  onRender: () => Promise<void>;
  registerCleanup: (handler: () => void) => void;
}

export function renderInputArea(container: HTMLElement, deps: InputAreaRendererDeps): void {
  // renderInputArea 以下のロジックをそのまま移動
}
```

**Step 5: ScrapDetailViewをコーディネーターに縮小**

ScrapDetailViewは各レンダラーを呼び出すだけの薄いコーディネーターにする。

```typescript
// src/views/scrap-detail-view.ts (リファクタリング後)
export class ScrapDetailView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private settings: ZenScrapSettings;
  private scrap: Scrap | undefined;
  private isFullWidth = false;
  private documentClickHandlers: (() => void)[] = [];
  private mdRenderer: MarkdownRenderer;

  async render(): Promise<void> {
    this.cleanupDocumentListeners();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    if (!this.scrap) return;
    container.addClass("zen-scrap-detail-container");
    if (this.isFullWidth) container.addClass("zen-scrap-fullwidth");

    const deps = this.buildDeps();
    renderHeader(container, deps);
    await renderTimeline(container, deps);
    renderInputArea(container, deps);
  }

  private buildDeps() { /* 共通のdepsオブジェクトを組み立て */ }
}
```

**Step 6: ビルド確認**

Run: `npm run build`
Expected: エラーなし

**Step 7: 動作確認してコミット**

Run: Obsidianでスクラップの表示・作成・編集・削除が問題なく動くことを確認
```bash
git add src/views/
git commit -m "ScrapDetailViewの責務を4モジュールに分割"
```

---

### Task 2: ScrapListViewの責務分割

**Files:**
- Create: `src/views/list/list-item-renderer.ts`
- Create: `src/views/list/toolbar-renderer.ts`
- Modify: `src/views/scrap-list-view.ts`

**目的:** 268行のScrapListViewから、リストアイテム描画とツールバー（ドロップダウン）描画を分離する。

**Step 1: toolbar-renderer.tsを切り出す**

`renderDropdown` を汎用ドロップダウンレンダラーとして抽出。

```typescript
// src/views/list/toolbar-renderer.ts
export interface DropdownOption {
  value: string;
  label: string;
}

export function renderDropdown(
  parent: HTMLElement,
  label: string,
  defaultValue: string,
  options: DropdownOption[],
  currentValue: string,
  onChange: (value: string) => void,
  registerCleanup: (handler: () => void) => void,
): void {
  // renderDropdown のロジック移動
}
```

**Step 2: list-item-renderer.tsを切り出す**

個別スクラップアイテムの描画ロジックを抽出。

```typescript
// src/views/list/list-item-renderer.ts
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { EventBus } from "../../events/event-bus";

export interface ListItemDeps {
  repo: ScrapRepository;
  eventBus: EventBus;
}

export function renderListItem(parent: HTMLElement, scrap: Scrap, deps: ListItemDeps): void {
  // for文内のリストアイテム描画ロジック移動
}
```

**Step 3: ScrapListViewを薄くする**

```typescript
// src/views/scrap-list-view.ts (リファクタリング後)
// render()はヘッダー、検索、ツールバー、リストの4ブロックを呼ぶだけ
// フィルタリング・ソート・検索のロジックはrenderListに残すが、
// 各アイテムの描画はlist-item-rendererに委譲
```

**Step 4: ビルド確認・動作確認・コミット**

Run: `npm run build`
```bash
git add src/views/
git commit -m "ScrapListViewの責務をモジュールに分割"
```

---

### Task 3: ドキュメントリスナー管理の共通化

**Files:**
- Create: `src/ui/cleanup-manager.ts`
- Modify: `src/views/scrap-detail-view.ts`
- Modify: `src/views/scrap-list-view.ts`

**目的:** 両ビューで重複している `documentClickHandlers` + `cleanupDocumentListeners` パターンを共通クラスに抽出。

```typescript
// src/ui/cleanup-manager.ts
export class CleanupManager {
  private handlers: (() => void)[] = [];

  registerDocumentClick(handler: () => void): void {
    document.addEventListener("click", handler);
    this.handlers.push(handler);
  }

  cleanup(): void {
    for (const handler of this.handlers) {
      document.removeEventListener("click", handler);
    }
    this.handlers = [];
  }
}
```

**Step 1: CleanupManagerを作成**
**Step 2: 両ビューの `documentClickHandlers` を CleanupManager に置き換え**
**Step 3: ビルド確認・動作確認・コミット**

```bash
git add src/ui/cleanup-manager.ts src/views/
git commit -m "ドキュメントリスナー管理をCleanupManagerに共通化"
```

---

## Phase 1: 基盤強化

### Task 4: タグUI - データモデルとRepository

**Files:**
- Modify: `src/data/types.ts` (変更なし、tagsは既存)
- Modify: `src/data/scrap-repository.ts`
- Modify: `src/events/constants.ts`
- Modify: `src/events/scrap-handlers.ts`
- Modify: `src/ui/title-prompt-modal.ts`

**目的:** スクラップ作成時にタグを入力できるようにし、一覧画面でタグ表示・フィルタができるようにする。

**Step 1: TitlePromptModalにタグ入力フィールドを追加**

タイトル入力の下にカンマ区切りのタグ入力欄を追加。コールバックの型を `(title: string, tags: string[]) => void` に変更。

**Step 2: scrap-handlersのcreateハンドラでタグを受け渡し**

**Step 3: ビルド確認・動作確認・コミット**

```bash
git add src/
git commit -m "スクラップ作成時のタグ入力対応"
```

---

### Task 5: タグUI - 一覧画面での表示とフィルタ

**Files:**
- Modify: `src/views/list/list-item-renderer.ts`
- Modify: `src/views/scrap-list-view.ts`

**Step 1: リストアイテムにタグを表示**

メタ行の下にタグをピル形式で表示。CSS: `zen-scrap-tag` クラス。

**Step 2: タグによるフィルタリング（タグクリックで絞り込み）**

タグピルをクリックすると、そのタグでリストをフィルタリング。現在のフィルタに加えてAND条件。

**Step 3: 詳細画面のメタ行にもタグを表示**

**Step 4: スタイル追加・ビルド確認・動作確認・コミット**

```bash
git add src/ styles.app.css
git commit -m "タグの表示とフィルタリング機能を追加"
```

---

### Task 6: タグUI - 詳細画面でのタグ編集

**Files:**
- Modify: `src/views/detail/header-renderer.ts`

**Step 1: ヘッダーのメタ行にタグ表示 + 編集ボタンを追加**

タグ部分をクリックするとインライン編集モードに入り、カンマ区切りで編集可能。保存するとフロントマッターに反映。

**Step 2: ビルド確認・動作確認・コミット**

```bash
git add src/ styles.app.css
git commit -m "詳細画面でのタグ編集機能を追加"
```

---

### Task 7: Vault変更の自動検知

**Files:**
- Modify: `src/main.ts`
- Modify: `src/views/scrap-list-view.ts`
- Modify: `src/views/scrap-detail-view.ts`

**Step 1: main.tsでvault.on('modify')をリッスン**

```typescript
// main.ts onload()内
this.registerEvent(
  this.app.vault.on("modify", (file) => {
    if (file instanceof TFile && file.path.startsWith(this.settings.scrapsFolder + "/")) {
      this.eventBus.emit(EVENTS.SCRAP_CHANGED);
    }
  })
);

this.registerEvent(
  this.app.vault.on("delete", (file) => {
    if (file instanceof TFile && file.path.startsWith(this.settings.scrapsFolder + "/")) {
      this.eventBus.emit(EVENTS.SCRAP_CHANGED);
    }
  })
);

this.registerEvent(
  this.app.vault.on("create", (file) => {
    if (file instanceof TFile && file.path.startsWith(this.settings.scrapsFolder + "/")) {
      this.eventBus.emit(EVENTS.SCRAP_CHANGED);
    }
  })
);
```

**Step 2: ScrapDetailViewでSCRAP_CHANGEDイベントを購読**

現在の詳細画面は自身のsave後に手動rerenderしているが、外部変更時にも再読み込みする。

```typescript
// scrap-detail-view.ts onOpen()
this.eventBus.on(EVENTS.SCRAP_CHANGED, async () => {
  if (this.scrap) {
    const updated = await this.repo.getByPath(this.scrap.filePath);
    if (updated) {
      this.scrap = updated;
      await this.render();
    }
  }
});
```

**Step 3: 自分自身のsave直後の再レンダーとの二重実行を防ぐ**

save直後にSCRAP_CHANGEDが飛んでくると二重レンダーになる。フラグで抑制。

```typescript
private isSaving = false;

// save呼び出し時
this.isSaving = true;
await this.repo.save(this.scrap);
this.isSaving = false;

// SCRAP_CHANGED ハンドラ
if (this.isSaving) return;
```

**Step 4: ビルド確認・動作確認・コミット**

Run: Obsidianで外部エディタからMarkdownファイルを編集し、リスト・詳細画面が自動更新されることを確認

```bash
git add src/
git commit -m "Vault変更の自動検知による画面再描画を追加"
```

---

### Task 8: ドラッグ&ドロップで画像挿入

**Files:**
- Modify: `src/views/detail/input-area-renderer.ts`

**Step 1: textareaにdragover/dropイベントを追加**

```typescript
textarea.addEventListener("dragover", (e) => {
  e.preventDefault();
  textarea.addClass("zen-scrap-textarea-dragover");
});

textarea.addEventListener("dragleave", () => {
  textarea.removeClass("zen-scrap-textarea-dragover");
});

textarea.addEventListener("drop", async (e) => {
  e.preventDefault();
  textarea.removeClass("zen-scrap-textarea-dragover");
  const files = e.dataTransfer?.files;
  if (!files) return;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file.type.startsWith("image/")) continue;
    await uploadAndInsert(file, textarea, deps);
  }
});
```

**Step 2: 既存のhandleImageUploadとアップロードロジックを共通化**

ファイルダイアログとD&Dの両方から呼べる `uploadAndInsert` 関数を作る。

**Step 3: ドラッグオーバー時のCSS追加**

```css
.zen-scrap-textarea-dragover {
  border-color: var(--interactive-accent) !important;
  background: var(--background-secondary);
}
```

**Step 4: ビルド確認・動作確認・コミット**

```bash
git add src/ styles.app.css
git commit -m "テキストエリアへのドラッグ&ドロップ画像挿入を追加"
```

---

### Task 9: エントリの並び替え

**Files:**
- Modify: `src/views/detail/timeline-renderer.ts`
- Modify: `src/data/scrap-repository.ts`

**Step 1: エントリヘッダーに上下移動ボタンを追加**

各エントリのメニュードロップダウン内に「上へ移動」「下へ移動」を追加。最初のエントリには「上へ」を、最後のエントリには「下へ」を表示しない。

**Step 2: 移動処理の実装**

```typescript
// 上へ移動
if (index > 0) {
  const moveUpItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: "上へ移動" });
  moveUpItem.addEventListener("click", async (e) => {
    e.stopPropagation();
    [scrap.entries[index - 1], scrap.entries[index]] = [scrap.entries[index], scrap.entries[index - 1]];
    scrap.updated = new Date().toISOString();
    await deps.repo.save(scrap);
    await deps.onRender();
  });
}
```

**Step 3: ビルド確認・動作確認・コミット**

```bash
git add src/
git commit -m "エントリの上下並び替え機能を追加"
```

---

## Phase 2: Obsidianとの統合深化

### Task 10: Obsidianリンク (`[[]]`) の解釈とレンダリング

**Files:**
- Modify: `src/views/detail/markdown-renderer.ts`

**Step 1: renderBody内で `[[]]` リンクをMarkdownリンクに変換**

zenn-markdown-htmlに渡す前に `[[ノート名]]` を `[ノート名](obsidian://open?vault=VAULT&file=ノート名)` 等のリンクに変換する。

```typescript
// markdown-renderer.ts renderBody内
// [[ノート名|表示テキスト]] と [[ノート名]] の両方に対応
private convertObsidianLinks(body: string): string {
  return body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
    const display = alias || target;
    return `[${display}](obsidian://open?vault=${encodeURIComponent(this.vaultName)}&file=${encodeURIComponent(target)})`;
  });
}
```

**Step 2: Appからvault名を取得してMarkdownRendererに渡す**

```typescript
// constructor
constructor(private app: App) {}

private get vaultName(): string {
  return this.app.vault.getName();
}
```

**Step 3: リンククリック時にObsidian内部ナビゲーションで開く**

レンダリング後のHTMLで `obsidian://` リンクをクリックしたときに、`app.workspace.openLinkText` を使って内部遷移させる。レンダリング済みコンテナに対してイベントデリゲーションで処理。

```typescript
// addObsidianLinkHandler をMarkdownRendererに追加
addLinkHandler(container: HTMLElement): void {
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (href?.startsWith("obsidian://open?")) {
      e.preventDefault();
      const params = new URLSearchParams(href.replace("obsidian://open?", ""));
      const file = params.get("file");
      if (file) {
        this.app.workspace.openLinkText(file, "", false);
      }
    }
  });
}
```

**Step 4: ビルド確認・動作確認・コミット**

Run: スクラップ内に `[[テスト]]` と書いてリンクとして表示・クリック遷移できることを確認

```bash
git add src/
git commit -m "Obsidianリンク [[]] の解釈とレンダリング対応"
```

---

## Phase 3: 体験の差別化

### Task 11: ピン留め（お気に入り）

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/scrap-parser.ts`
- Modify: `src/views/list/list-item-renderer.ts`
- Modify: `src/views/scrap-list-view.ts`
- Modify: `src/views/detail/header-renderer.ts`

**Step 1: データモデルにpinnedフラグを追加**

```typescript
// types.ts
export interface Scrap {
  // 既存フィールド...
  pinned: boolean;
}
```

**Step 2: scrap-parser.tsでpinnedの読み書きを追加**

```typescript
// parseScrapMarkdown
pinned: frontmatter["pinned"] === "true",

// serializeScrap
lines.push(`pinned: ${scrap.pinned}`);
```

**Step 3: ScrapRepository.createでpinned: falseを初期値に**

**Step 4: 一覧画面でピン留めされたスクラップを上部に表示**

```typescript
// renderList内のソート後
filtered.sort((a, b) => {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  // 既存のソートロジック
});
```

**Step 5: リストアイテムにピンアイコンを表示**

タイトル行の先頭にピンアイコン。メニューに「ピン留め / ピン解除」を追加。

**Step 6: 詳細画面のアクションドロップダウンにもピン留め/解除を追加**

**Step 7: ピン用CSSを追加**

```css
.zen-scrap-pin-icon {
  color: var(--text-accent);
  margin-right: 4px;
}
```

**Step 8: ビルド確認・動作確認・コミット**

```bash
git add src/ styles.app.css
git commit -m "スクラップのピン留め機能を追加"
```

---

## 実装順序まとめ

| 順番 | Task | 内容 |
|------|------|------|
| 1 | Task 1 | ScrapDetailView分割 |
| 2 | Task 2 | ScrapListView分割 |
| 3 | Task 3 | CleanupManager共通化 |
| 4 | Task 4 | タグUI - 作成時入力 |
| 5 | Task 5 | タグUI - 一覧表示・フィルタ |
| 6 | Task 6 | タグUI - 詳細編集 |
| 7 | Task 7 | Vault変更検知 |
| 8 | Task 8 | D&D画像挿入 |
| 9 | Task 9 | エントリ並び替え |
| 10 | Task 10 | Obsidianリンク対応 |
| 11 | Task 11 | ピン留め機能 |
