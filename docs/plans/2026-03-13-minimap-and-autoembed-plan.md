# ミニマップ & URL自動埋め込み Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 長いスクラップ内の情報アクセスを改善するミニマップと、URLペースト時に自動で埋め込み記法に変換する機能を追加する。

**Architecture:** 機能Bは既存のpasteイベントにフックしてURL判定→記法変換する薄いレイヤー。機能Aはタイムラインのレンダリング済みDOMを走査してCanvas上に縮小描画するミニマップコンポーネント。両機能は独立しており並行開発可能。

**Tech Stack:** TypeScript, Obsidian API, Canvas API

---

## Task 1: URL判定ユーティリティの切り出し

**Files:**
- Create: `src/ui/url-detector.ts`
- Modify: `src/ui/embed-modal.ts:55-74`

**Step 1: `src/ui/url-detector.ts` を作成**

embed-modal.tsにあるYouTube ID抽出ロジックとURL種別判定を独立した関数として作成する。

```typescript
import { EmbedType } from "./embed-modal";

const YOUTUBE_PATTERNS = [
  /youtu\.be\/([^?&]+)/,
  /youtube\.com\/watch\?v=([^&]+)/,
  /youtube\.com\/embed\/([^?&]+)/,
];

const TWITTER_PATTERN = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/;
const GITHUB_BLOB_PATTERN = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\//;

export function detectEmbedType(url: string): EmbedType | null {
  if (YOUTUBE_PATTERNS.some((p) => p.test(url))) return "youtube";
  if (TWITTER_PATTERN.test(url)) return "tweet";
  if (GITHUB_BLOB_PATTERN.test(url)) return "github";
  if (/^https?:\/\//.test(url)) return "card";
  return null;
}

export function extractYouTubeId(url: string): string {
  for (const p of YOUTUBE_PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return url;
}

export function buildEmbedSyntax(url: string, type: EmbedType): string {
  if (type === "youtube") {
    return `@[youtube](${extractYouTubeId(url)})`;
  }
  return `@[${type}](${url})`;
}
```

**Step 2: embed-modal.ts を url-detector.ts を使うようにリファクタ**

`embed-modal.ts` の `buildSyntax` と `extractYouTubeId` を `url-detector.ts` の関数で置き換える。

```typescript
// embed-modal.ts の先頭に追加
import { buildEmbedSyntax, extractYouTubeId } from "./url-detector";

// buildSyntax メソッドを置き換え
private buildSyntax(url: string): string {
  if (this.embedType === "youtube") {
    const id = extractYouTubeId(url);
    return `@[youtube](${id})`;
  }
  return `@[${this.embedType}](${url})`;
}
```

注: buildSyntaxメソッドの中身は既存と同じだが、extractYouTubeIdをインポートしたものに差し替える。privateメソッドのextractYouTubeIdは削除する。

**Step 3: ビルド確認**

Run: `npm run build`
Expected: エラーなし

**Step 4: コミット**

```bash
git add src/ui/url-detector.ts src/ui/embed-modal.ts
git commit -m "URL判定ロジックをurl-detector.tsに切り出し"
```

---

## Task 2: 設定にautoEmbedを追加

**Files:**
- Modify: `src/settings.ts:4-12` (インターフェースとデフォルト値)
- Modify: `src/settings.ts:22-50` (設定UI)

**Step 1: ZenScrapSettings に autoEmbed を追加**

```typescript
export interface ZenScrapSettings {
  scrapsFolder: string;
  imagesFolder: string;
  autoEmbed: boolean;
}

export const DEFAULT_SETTINGS: ZenScrapSettings = {
  scrapsFolder: "Scraps",
  imagesFolder: "Scraps/images",
  autoEmbed: true,
};
```

**Step 2: 設定画面にトグルを追加**

`display()` メソッドの末尾（imagesFolder設定の後）に追加:

```typescript
new Setting(containerEl)
  .setName("URLの自動埋め込み")
  .setDesc("URLをペーストしたとき自動で埋め込み記法に変換する")
  .addToggle((toggle) =>
    toggle
      .setValue(this.plugin.settings.autoEmbed)
      .onChange(async (value) => {
        this.plugin.settings.autoEmbed = value;
        await this.plugin.saveSettings();
      })
  );
```

**Step 3: ビルド確認**

Run: `npm run build`
Expected: エラーなし

**Step 4: コミット**

```bash
git add src/settings.ts
git commit -m "設定にURLの自動埋め込みトグルを追加"
```

---

## Task 3: pasteイベントで自動埋め込み

**Files:**
- Modify: `src/views/detail/input-area-renderer.ts`

**Step 1: InputAreaDeps の確認**

`InputAreaDeps` は既に `settings: ZenScrapSettings` を持っているので、追加のインターフェース変更は不要。

**Step 2: ペーストハンドラー関数を追加**

`input-area-renderer.ts` の末尾（`setupAutoGrow` の後）に追加:

```typescript
function setupAutoEmbed(textarea: HTMLTextAreaElement, settings: ZenScrapSettings): void {
  textarea.addEventListener("paste", (e: ClipboardEvent) => {
    if (!settings.autoEmbed) return;

    const text = e.clipboardData?.getData("text/plain")?.trim();
    if (!text) return;

    // 複数行や、URLの前後にテキストがある場合はスキップ
    if (text.includes("\n")) return;

    // 既に埋め込み記法の場合はスキップ
    if (text.startsWith("@[")) return;

    const type = detectEmbedType(text);
    if (!type) return;

    e.preventDefault();
    const syntax = buildEmbedSyntax(text, type);
    insertTextAtCursor(textarea, syntax);
  });
}
```

**Step 3: import文を追加**

`input-area-renderer.ts` の先頭に追加:

```typescript
import { detectEmbedType, buildEmbedSyntax } from "../../ui/url-detector";
```

**Step 4: setupAutoEmbed を呼び出す**

`renderInputArea` 関数内、`setupAutoGrow(textarea)` の直後に追加:

```typescript
setupAutoGrow(textarea);
setupAutoEmbed(textarea, deps.settings);
```

`renderEntryEditor` 関数内、`setupAutoGrow(textarea)` の直後にも同様に追加:

```typescript
setupAutoGrow(textarea);
setupAutoEmbed(textarea, deps.settings);
```

**Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし

**Step 6: 手動テスト**

Obsidianでプラグインをリロードし、以下をテスト:
- YouTube URL（3パターン）をペースト → `@[youtube](VIDEO_ID)` に変換される
- X/Twitter URLをペースト → `@[tweet](URL)` に変換される
- GitHub blob URLをペースト → `@[github](URL)` に変換される
- 一般URLをペースト → `@[card](URL)` に変換される
- 複数行テキストのペースト → 変換されない
- 文章の中にURLが含まれるテキスト → 変換されない
- 設定でOFF → URLがそのまま貼り付けられる
- 既存のエントリ編集時にも同様に動作する

**Step 7: コミット**

```bash
git add src/views/detail/input-area-renderer.ts
git commit -m "URLペースト時の自動埋め込み変換を実装"
```

---

## Task 4: ミニマップ -- Canvas描画コンポーネント作成

**Files:**
- Create: `src/ui/minimap-renderer.ts`

**Step 1: ミニマップレンダラーを作成**

```typescript
const MINIMAP_WIDTH = 90;
const SCALE_X = MINIMAP_WIDTH / 700; // タイムライン想定幅700pxに対する縮小率
const MIN_LINE_HEIGHT = 1;
const VIEWPORT_COLOR = "rgba(120, 120, 120, 0.25)";
const TEXT_COLOR = "rgba(140, 140, 140, 0.6)";
const HEADING_COLOR = "rgba(140, 140, 140, 0.9)";
const SEPARATOR_COLOR = "rgba(140, 140, 140, 0.3)";

const EMBED_COLORS: Record<string, string> = {
  youtube: "rgba(255, 0, 0, 0.3)",
  card: "rgba(59, 130, 246, 0.3)",
  github: "rgba(34, 197, 94, 0.3)",
  tweet: "rgba(29, 155, 240, 0.3)",
};

interface MinimapState {
  canvas: HTMLCanvasElement;
  wrapper: HTMLElement;
  timeline: HTMLElement;
  scrollContainer: HTMLElement;
  visible: boolean;
  isDragging: boolean;
  contentHeight: number;
  resizeObserver: ResizeObserver | null;
}

export function createMinimap(
  parentContainer: HTMLElement,
  timeline: HTMLElement,
  scrollContainer: HTMLElement,
): MinimapState {
  const wrapper = parentContainer.createDiv({ cls: "zen-scrap-minimap-wrapper" });
  const canvas = wrapper.createEl("canvas", { cls: "zen-scrap-minimap-canvas" });
  canvas.width = MINIMAP_WIDTH;

  const state: MinimapState = {
    canvas,
    wrapper,
    timeline,
    scrollContainer,
    visible: false,
    isDragging: false,
    contentHeight: 0,
    resizeObserver: null,
  };

  setupMinimapInteraction(state);
  setupScrollSync(state);

  return state;
}

export function showMinimap(state: MinimapState): void {
  state.visible = true;
  state.wrapper.style.display = "";
  drawMinimap(state);
  setupResizeObserver(state);
}

export function hideMinimap(state: MinimapState): void {
  state.visible = false;
  state.wrapper.style.display = "none";
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
    state.resizeObserver = null;
  }
}

export function toggleMinimap(state: MinimapState): void {
  if (state.visible) {
    hideMinimap(state);
  } else {
    showMinimap(state);
  }
}

export function destroyMinimap(state: MinimapState): void {
  hideMinimap(state);
  state.wrapper.remove();
}

export function redrawMinimap(state: MinimapState): void {
  if (!state.visible) return;
  drawMinimap(state);
}

function drawMinimap(state: MinimapState): void {
  const { canvas, timeline, scrollContainer } = state;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const timelineRect = timeline.getBoundingClientRect();
  const timelineHeight = timeline.scrollHeight;
  const containerHeight = scrollContainer.clientHeight;
  const canvasDisplayHeight = Math.min(containerHeight, 600);

  canvas.height = canvasDisplayHeight;
  canvas.style.height = canvasDisplayHeight + "px";
  ctx.clearRect(0, 0, MINIMAP_WIDTH, canvasDisplayHeight);

  const scaleY = canvasDisplayHeight / timelineHeight;
  state.contentHeight = timelineHeight;

  // タイムラインの子要素（エントリ）を走査して描画
  const entries = timeline.querySelectorAll<HTMLElement>(".zen-scrap-entry");
  for (const entry of entries) {
    const entryTop = (entry.offsetTop - timeline.offsetTop) * scaleY;

    // タイムスタンプ見出し
    const header = entry.querySelector<HTMLElement>(".zen-scrap-entry-header");
    if (header) {
      const y = entryTop;
      ctx.fillStyle = HEADING_COLOR;
      ctx.fillRect(2, y, MINIMAP_WIDTH * 0.4, Math.max(2, 3 * scaleY));
    }

    // エントリ本文
    const body = entry.querySelector<HTMLElement>(".zen-scrap-entry-body");
    if (body) {
      drawBodyContent(ctx, body, timeline.offsetTop, entryTop, scaleY);
    }
  }

  // セパレータ線（エントリ間）
  for (const entry of entries) {
    const bottom = (entry.offsetTop - timeline.offsetTop + entry.offsetHeight) * scaleY;
    ctx.fillStyle = SEPARATOR_COLOR;
    ctx.fillRect(0, bottom, MINIMAP_WIDTH, 1);
  }

  // ビューポートハイライト
  const scrollTop = scrollContainer.scrollTop;
  const vpTop = scrollTop * scaleY;
  const vpHeight = containerHeight * scaleY;
  ctx.fillStyle = VIEWPORT_COLOR;
  ctx.fillRect(0, vpTop, MINIMAP_WIDTH, vpHeight);
}

function drawBodyContent(
  ctx: CanvasRenderingContext2D,
  body: HTMLElement,
  timelineOffsetTop: number,
  _entryTop: number,
  scaleY: number,
): void {
  // テキストノードを走査
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;

  while (node) {
    const el = node as HTMLElement;

    // 埋め込みブロックの検出
    const embedMatch = detectEmbedElement(el);
    if (embedMatch) {
      const rect = el.getBoundingClientRect();
      const top = (el.offsetTop + body.offsetTop - timelineOffsetTop + body.closest(".zen-scrap-entry")!.offsetTop) * scaleY;
      const height = Math.max(4, rect.height * scaleY);
      ctx.fillStyle = EMBED_COLORS[embedMatch] || EMBED_COLORS.card;
      ctx.fillRect(4, top, MINIMAP_WIDTH - 8, height);
      node = walker.nextNode();
      continue;
    }

    // テキスト要素（p, li, h1-h6, td, th）
    if (isTextBlock(el)) {
      const top = (el.offsetTop + body.offsetTop - timelineOffsetTop + body.closest(".zen-scrap-entry")!.offsetTop) * scaleY;
      const height = Math.max(MIN_LINE_HEIGHT, el.offsetHeight * scaleY);
      const indent = getIndentLevel(el) * 4;
      const width = Math.min(MINIMAP_WIDTH - 4 - indent, el.scrollWidth * SCALE_X);

      ctx.fillStyle = el.tagName.match(/^H[1-6]$/) ? HEADING_COLOR : TEXT_COLOR;
      ctx.fillRect(2 + indent, top, Math.max(8, width), Math.max(MIN_LINE_HEIGHT, height * 0.6));
    }

    node = walker.nextNode();
  }
}

function detectEmbedElement(el: HTMLElement): string | null {
  // zenn-markdown-htmlが生成する埋め込みのクラス名から判定
  const cls = el.className || "";
  if (cls.includes("embed-youtube") || el.tagName === "IFRAME" && el.getAttribute("src")?.includes("youtube")) return "youtube";
  if (cls.includes("embed-tweet") || el.dataset.embedType === "tweet") return "tweet";
  if (cls.includes("embed-card") || el.dataset.embedType === "card") return "card";
  if (cls.includes("embed-github") || el.dataset.embedType === "github") return "github";
  return null;
}

function isTextBlock(el: HTMLElement): boolean {
  return /^(P|LI|H[1-6]|TD|TH|BLOCKQUOTE|PRE)$/.test(el.tagName);
}

function getIndentLevel(el: HTMLElement): number {
  let level = 0;
  let parent = el.parentElement;
  while (parent) {
    if (parent.tagName === "UL" || parent.tagName === "OL" || parent.tagName === "BLOCKQUOTE") level++;
    parent = parent.parentElement;
  }
  return level;
}

function setupMinimapInteraction(state: MinimapState): void {
  const { canvas, scrollContainer } = state;

  const scrollToPosition = (clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const targetScroll = ratio * state.contentHeight - scrollContainer.clientHeight / 2;
    scrollContainer.scrollTop = Math.max(0, targetScroll);
  };

  canvas.addEventListener("mousedown", (e: MouseEvent) => {
    e.preventDefault();
    state.isDragging = true;
    scrollToPosition(e.clientY);
  });

  document.addEventListener("mousemove", (e: MouseEvent) => {
    if (!state.isDragging) return;
    e.preventDefault();
    scrollToPosition(e.clientY);
  });

  document.addEventListener("mouseup", () => {
    state.isDragging = false;
  });
}

function setupScrollSync(state: MinimapState): void {
  let ticking = false;
  state.scrollContainer.addEventListener("scroll", () => {
    if (!state.visible || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      drawMinimap(state);
      ticking = false;
    });
  });
}

function setupResizeObserver(state: MinimapState): void {
  if (state.resizeObserver) state.resizeObserver.disconnect();
  let debounceTimer: number;
  state.resizeObserver = new ResizeObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      if (state.visible) drawMinimap(state);
    }, 150);
  });
  state.resizeObserver.observe(state.timeline);
}
```

**Step 2: ビルド確認**

Run: `npm run build`
Expected: エラーなし（未使用のimportワーニングが出る可能性があるが、次のTaskで使う）

**Step 3: コミット**

```bash
git add src/ui/minimap-renderer.ts
git commit -m "ミニマップCanvas描画コンポーネントを作成"
```

---

## Task 5: ミニマップ -- 詳細ビューへの組み込み

**Files:**
- Modify: `src/views/scrap-detail-view.ts`
- Modify: `src/views/detail/header-renderer.ts`
- Modify: `src/icons.ts`

**Step 1: アイコンを追加**

`src/icons.ts` の末尾に追加:

```typescript
export const MINIMAP_ICON = `<svg ${stroke(16)}><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="10" width="7" height="4" rx="1"/><rect x="14" y="17" width="7" height="4" rx="1"/></svg>`;
```

**Step 2: HeaderDeps にミニマップトグルコールバックを追加**

`header-renderer.ts` の `HeaderDeps` に追加:

```typescript
export interface HeaderDeps {
  // ...既存のフィールド
  onToggleMinimap: () => void;
}
```

ヘッダーのnavRight（fullWidthBtn の後、helpBtn の前）にミニマップボタンを追加:

```typescript
import { chevronLeftIcon, EXPAND_ICON, SHRINK_ICON, TRIANGLE_DOWN_ICON, EDIT_ICON, MORE_ICON, HELP_ICON, MINIMAP_ICON } from "../../icons";

// fullWidthBtn の後に追加
const minimapBtn = navRight.createEl("button", { cls: "zen-scrap-minimap-toggle" });
minimapBtn.innerHTML = MINIMAP_ICON;
minimapBtn.setAttribute("aria-label", "ミニマップ");
minimapBtn.addEventListener("click", () => deps.onToggleMinimap());
```

**Step 3: scrap-detail-view.ts にミニマップを組み込み**

```typescript
import { createMinimap, toggleMinimap, showMinimap, hideMinimap, destroyMinimap, redrawMinimap, type MinimapState } from "../ui/minimap-renderer";
```

ScrapDetailView クラスに追加:

```typescript
private minimapState: MinimapState | null = null;
private isMinimapVisible = false;
```

`render()` メソッド内で、`renderTimeline` の後に以下を追加:

```typescript
// ミニマップ初期化
const scrollContainer = container;
if (this.minimapState) {
  destroyMinimap(this.minimapState);
  this.minimapState = null;
}
this.minimapState = createMinimap(container, timeline_element, scrollContainer);
if (this.isMinimapVisible) {
  showMinimap(this.minimapState);
} else {
  hideMinimap(this.minimapState);
}
```

注: `renderTimeline` が返す timeline 要素の参照が必要。`renderTimeline` が timeline の DOM要素を返すように変更するか、container から `.zen-scrap-timeline` をquerySelectする。

シンプルなアプローチとして、render内でquerySelectする:

```typescript
await renderTimeline(container, timelineDeps);

const timelineEl = container.querySelector<HTMLElement>(".zen-scrap-timeline");
if (timelineEl) {
  if (this.minimapState) destroyMinimap(this.minimapState);
  this.minimapState = createMinimap(container, timelineEl, container);
  if (this.isMinimapVisible) {
    showMinimap(this.minimapState);
  }
}
```

headerDeps にミニマップトグルを追加:

```typescript
const headerDeps: HeaderDeps = {
  // ...既存のフィールド
  onToggleMinimap: () => {
    this.isMinimapVisible = !this.isMinimapVisible;
    if (this.minimapState) toggleMinimap(this.minimapState);
  },
};
```

`onClose()` にミニマップの破棄を追加:

```typescript
async onClose(): Promise<void> {
  this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
  if (this.minimapState) destroyMinimap(this.minimapState);
  this.cleanupManager.cleanup();
}
```

**Step 4: Cmd/Ctrl + M ショートカットを追加**

`render()` メソッド内に Scope を使ったキーバインド登録を追加する。ただし現状の実装では ScrapDetailView 側にはScopeベースのショートカットは登録していない（input-area側にある）。

キーバインドは `onOpen` でwindowにイベントリスナーを追加し、`onClose` で削除する方式にする:

```typescript
private minimapKeyHandler = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "m") {
    e.preventDefault();
    this.isMinimapVisible = !this.isMinimapVisible;
    if (this.minimapState) toggleMinimap(this.minimapState);
  }
};

async onOpen(): Promise<void> {
  this.eventBus.on(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
  this.containerEl.addEventListener("keydown", this.minimapKeyHandler);
  await this.render();
}

async onClose(): Promise<void> {
  this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
  this.containerEl.removeEventListener("keydown", this.minimapKeyHandler);
  if (this.minimapState) destroyMinimap(this.minimapState);
  this.cleanupManager.cleanup();
}
```

**Step 5: ビルド確認**

Run: `npm run build`
Expected: エラーなし

**Step 6: コミット**

```bash
git add src/views/scrap-detail-view.ts src/views/detail/header-renderer.ts src/icons.ts
git commit -m "ミニマップを詳細ビューに組み込み"
```

---

## Task 6: ミニマップ -- CSS スタイリング

**Files:**
- Modify: `styles.css`（プロジェクトルートのスタイルファイル）

**Step 1: スタイルファイルの場所を確認**

プロジェクトルートの `styles.css` を確認する。

**Step 2: ミニマップ用CSSを追加**

```css
/* ミニマップ */
.zen-scrap-detail-container {
  position: relative;
}

.zen-scrap-minimap-wrapper {
  position: absolute;
  top: 0;
  right: 0;
  width: 90px;
  height: 100%;
  display: none;
  z-index: 10;
  border-left: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
}

.zen-scrap-minimap-wrapper[style*="display: none"] + .zen-scrap-timeline {
  padding-right: 0;
}

.zen-scrap-minimap-canvas {
  cursor: pointer;
  width: 90px;
  position: sticky;
  top: 0;
}

.zen-scrap-minimap-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.zen-scrap-minimap-toggle:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}
```

注: ミニマップ表示時にタイムラインの右パディングを調整する必要がある。これは `showMinimap`/`hideMinimap` 内でJSで直接 timeline の paddingRight を操作する方式にする（CSSの隣接セレクタでは制御が難しいため）。

`minimap-renderer.ts` の `showMinimap`/`hideMinimap` に追加:

```typescript
export function showMinimap(state: MinimapState): void {
  state.visible = true;
  state.wrapper.style.display = "";
  state.timeline.style.paddingRight = (MINIMAP_WIDTH + 8) + "px";
  drawMinimap(state);
  setupResizeObserver(state);
}

export function hideMinimap(state: MinimapState): void {
  state.visible = false;
  state.wrapper.style.display = "none";
  state.timeline.style.paddingRight = "";
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
    state.resizeObserver = null;
  }
}
```

**Step 3: ビルド確認**

Run: `npm run build`
Expected: エラーなし

**Step 4: コミット**

```bash
git add styles.css src/ui/minimap-renderer.ts
git commit -m "ミニマップのCSSスタイリングを追加"
```

---

## Task 7: 手動テスト & 調整

**Files:**
- 変更が必要なファイルはテスト結果による

**Step 1: プラグインをリロードしてURL自動埋め込みをテスト**

- YouTube URL (youtu.be/xxx, youtube.com/watch?v=xxx, youtube.com/embed/xxx) → `@[youtube](xxx)` に変換
- X URL (x.com/user/status/123) → `@[tweet](URL)` に変換
- GitHub blob URL → `@[github](URL)` に変換
- 一般URL → `@[card](URL)` に変換
- 文章テキストのペースト → 変換されない
- 設定でOFFにしてペースト → 変換されない
- エントリ編集モードでも同様に動作する

**Step 2: ミニマップをテスト**

- ヘッダーのミニマップボタンをクリック → ミニマップが表示/非表示
- Cmd/Ctrl + M → ミニマップがトグル
- ミニマップ上にテキスト行・埋め込みブロック・セパレータが描画されている
- ミニマップのビューポートハイライトがスクロールに追従する
- ミニマップをクリック → メインがジャンプ
- ミニマップをドラッグ → メインがリアルタイムに追従
- エントリ追加後にミニマップが再描画される
- エントリ0件のスクラップ → 空のミニマップ（エラーなし）

**Step 3: 埋め込みのCanvas描画色を確認・調整**

実際のレンダリング済みHTMLのクラス名を確認し、`detectEmbedElement` の判定条件を必要に応じて調整する。embed-renderer.ts が生成するHTMLの構造に合わせる。

**Step 4: 問題があれば修正してコミット**

```bash
git add -A
git commit -m "ミニマップとURL自動埋め込みの調整"
```
