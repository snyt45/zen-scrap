# UI改善 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Zennのスクラップ画面を参考に、一覧のフラット化、zenn-markdown-htmlによるタイムライン表示、Markdown/Previewタブ、エントリ折りたたみを実装する。

**Architecture:** 一覧画面はCSSのみ変更。詳細画面はタイムライン描画をObsidianのMarkdownRendererからzenn-markdown-htmlに切り替え、zenn-content-cssで見た目を揃える。投稿エリアにMarkdown/Previewタブを追加し、同じmarkdownToHtmlでプレビュー表示する。各エントリにはV字ボタンで折りたたみ機能を付ける。

**Tech Stack:** TypeScript, Obsidian Plugin API, zenn-markdown-html, zenn-content-css, esbuild

---

## Task 1: 一覧のフラット化（CSSのみ）

**Files:**
- Modify: `styles.css:36-45` (リストアイテムのスタイル)

**Step 1: CSSを変更**

`styles.css` の `.zen-scrap-list-item` を以下に変更:

```css
.zen-scrap-list-item {
  padding: 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--background-modifier-border);
}

.zen-scrap-list-item:hover {
  background: var(--background-secondary);
}
```

`border` と `border-radius` を削除し、`border-bottom` で区切り線にする。

**Step 2: ビルドして確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`
Expected: ビルド成功

**Step 3: コミット**

```bash
git add styles.css
git commit -m "一覧アイテムをフラットなリストスタイルに変更"
```

---

## Task 2: zenn-markdown-html + zenn-content-css の導入

**Files:**
- Modify: `package.json` (依存追加)
- Modify: `esbuild.config.mjs` (CSS取り込み設定)
- Modify: `styles.css` (zenn-content-cssのインポート)

**Step 1: パッケージをインストール**

Run: `cd /Users/snyt45/work/zen-scrap && npm install zenn-markdown-html zenn-content-css`

**Step 2: styles.css の先頭にzenn-content-cssを取り込む**

esbuildはCSSバンドルしないので、zenn-content-cssの内容を直接利用する方法を取る。
`src/main.ts` の先頭で zenn-content-css を import し、esbuild の CSS 処理に任せる方法もあるが、Obsidianプラグインは `styles.css` を単独で読み込む仕組みのため、以下の方法を取る:

`esbuild.config.mjs` の `copyPlugin` の `onEnd` に、zenn-content-css の内容を `styles.css` の先頭に結合するステップを追加する:

```javascript
import { copyFileSync, readFileSync, writeFileSync } from "fs";

// copyPlugin の onEnd 内に追加:
build.onEnd(() => {
  // zenn-content-css を styles.css に結合
  try {
    const zennCss = readFileSync("node_modules/zenn-content-css/lib/index.css", "utf-8");
    const appCss = readFileSync("styles.css.src", "utf-8");
    writeFileSync("styles.css", zennCss + "\n" + appCss);
  } catch (e) {
    console.error("CSS merge failed:", e.message);
  }
  // 既存のコピー処理...
});
```

ただし、これはビルドが複雑になるので、よりシンプルな方法として:

**シンプルな方法: styles.css にzenn-content-cssの内容をコピペではなく、ビルド時にconcatする小さなスクリプトを用意する。**

実際には、最もシンプルなのは `styles.css` のファイル名を `styles.app.css` にリネームし、ビルドスクリプトで結合すること:

1. `styles.css` → `styles.app.css` にリネーム
2. `package.json` の scripts に `"build:css": "cat node_modules/zenn-content-css/lib/index.css styles.app.css > styles.css"` を追加
3. `build` と `dev` スクリプトに `npm run build:css &&` を前置

```json
{
  "scripts": {
    "build:css": "cat node_modules/zenn-content-css/lib/index.css styles.app.css > styles.css",
    "dev": "npm run build:css && node --env-file=.env esbuild.config.mjs",
    "build": "npm run build:css && tsc -noEmit -skipLibCheck && node esbuild.config.mjs production"
  }
}
```

**Step 3: styles.css を styles.app.css にリネーム**

Run: `cd /Users/snyt45/work/zen-scrap && mv styles.css styles.app.css`

**Step 4: package.json の scripts を更新**

`build:css` スクリプトを追加し、`dev` と `build` に前置する。

**Step 5: CSS結合を実行してビルド確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`
Expected: `styles.css` が生成され、先頭にzenn-content-cssの内容、後半にアプリCSSが入っている

**Step 6: コミット**

```bash
git add package.json package-lock.json styles.app.css esbuild.config.mjs .gitignore
git commit -m "zenn-markdown-html と zenn-content-css を依存に追加"
```

注意: `styles.css` はビルド生成物になるので `.gitignore` に追加する。

---

## Task 3: タイムライン表示をzenn-markdown-htmlに切り替え

**Files:**
- Modify: `src/views/scrap-detail-view.ts:1-5` (import変更)
- Modify: `src/views/scrap-detail-view.ts:88-108` (renderTimeline)

**Step 1: import を変更**

`scrap-detail-view.ts` の先頭:

```typescript
import { ItemView, WorkspaceLeaf, Component } from "obsidian";
import markdownToHtml from "zenn-markdown-html";
```

`MarkdownRenderer` の import を削除し、`markdownToHtml` を追加。
`Component` と `renderComponent` は不要になるので削除する。

**Step 2: renderTimeline を書き換え**

```typescript
private renderTimeline(container: HTMLElement): void {
  const timeline = container.createDiv({ cls: "zen-scrap-timeline" });

  for (const entry of this.scrap!.entries) {
    const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

    const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });
    entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

    const entryBody = entryEl.createDiv({ cls: "zen-scrap-entry-body znc" });
    entryBody.innerHTML = markdownToHtml(entry.body);
  }

  timeline.scrollTop = timeline.scrollHeight;
}
```

ポイント:
- `async` が不要になる（markdownToHtmlは同期関数）
- `entryBody` に `znc` クラスを追加（zenn-content-cssのスタイル適用に必要）
- `innerHTML` で直接HTMLを挿入

**Step 3: renderComponent 関連を削除**

- `private renderComponent: Component;` フィールドを削除
- constructor内の `this.renderComponent = new Component();` を削除
- `onOpen` 内の `this.renderComponent.load();` を削除
- `onClose` 内の `this.renderComponent.unload();` を削除
- `render` メソッドの `await this.renderTimeline(container)` → `this.renderTimeline(container)` に変更

**Step 4: ビルドして確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`
Expected: ビルド成功

**Step 5: コミット**

```bash
git add src/views/scrap-detail-view.ts
git commit -m "タイムライン表示をzenn-markdown-htmlに切り替え"
```

---

## Task 4: Markdown/Preview 切り替えタブ

**Files:**
- Modify: `src/views/scrap-detail-view.ts:110-131` (renderInputArea)
- Modify: `styles.app.css` (タブのスタイル追加)

**Step 1: renderInputArea を書き換え**

```typescript
private renderInputArea(container: HTMLElement): void {
  const inputArea = container.createDiv({ cls: "zen-scrap-input-area" });

  // タブヘッダー
  const tabHeader = inputArea.createDiv({ cls: "zen-scrap-input-tabs" });
  const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-input-tab zen-scrap-input-tab-active" });
  const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-input-tab" });

  // Markdownエディタ
  const textarea = inputArea.createEl("textarea", {
    placeholder: "ここに書き散らす...",
    cls: "zen-scrap-textarea",
  });

  // プレビューエリア
  const preview = inputArea.createDiv({ cls: "zen-scrap-preview znc" });
  preview.style.display = "none";

  // タブ切り替え
  mdTab.addEventListener("click", () => {
    mdTab.addClass("zen-scrap-input-tab-active");
    pvTab.removeClass("zen-scrap-input-tab-active");
    textarea.style.display = "";
    preview.style.display = "none";
  });

  pvTab.addEventListener("click", () => {
    pvTab.addClass("zen-scrap-input-tab-active");
    mdTab.removeClass("zen-scrap-input-tab-active");
    textarea.style.display = "none";
    preview.style.display = "";
    preview.innerHTML = textarea.value.trim()
      ? markdownToHtml(textarea.value)
      : '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';
  });

  // 投稿ボタン
  const submitBtn = inputArea.createEl("button", { text: "投稿", cls: "zen-scrap-submit-btn" });
  submitBtn.addEventListener("click", async () => {
    const body = textarea.value.trim();
    if (!body || !this.scrap) return;
    this.scrap = await this.repo.addEntry(this.scrap, body);
    await this.render();
  });

  textarea.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submitBtn.click();
    }
  });
}
```

**Step 2: CSSを追加**

`styles.app.css` に追加:

```css
/* Markdown/Preview タブ */
.zen-scrap-input-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.zen-scrap-input-tab {
  padding: 6px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85em;
  font-weight: 600;
}

.zen-scrap-input-tab:hover {
  color: var(--text-normal);
}

.zen-scrap-input-tab-active {
  color: var(--text-normal);
  border-bottom-color: var(--interactive-accent);
}

/* プレビューエリア */
.zen-scrap-preview {
  min-height: 100px;
  padding: 8px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
}
```

**Step 3: ビルドして確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`
Expected: ビルド成功

**Step 4: コミット**

```bash
git add src/views/scrap-detail-view.ts styles.app.css
git commit -m "投稿エリアにMarkdown/Previewタブを追加"
```

---

## Task 5: エントリの折りたたみ

**Files:**
- Modify: `src/views/scrap-detail-view.ts` (renderTimeline内)
- Modify: `styles.app.css` (折りたたみのスタイル追加)

**Step 1: renderTimeline にV字ボタンと折りたたみを追加**

`renderTimeline` の for ループ内を以下に変更:

```typescript
private renderTimeline(container: HTMLElement): void {
  const timeline = container.createDiv({ cls: "zen-scrap-timeline" });

  for (const entry of this.scrap!.entries) {
    const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

    const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });
    entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

    const toggleBtn = entryHeader.createEl("button", { cls: "zen-scrap-entry-toggle" });
    toggleBtn.innerHTML = "&#x25BC;"; // ▼

    const entryBody = entryEl.createDiv({ cls: "zen-scrap-entry-body znc" });
    entryBody.innerHTML = markdownToHtml(entry.body);

    toggleBtn.addEventListener("click", () => {
      const collapsed = entryBody.style.display === "none";
      entryBody.style.display = collapsed ? "" : "none";
      toggleBtn.innerHTML = collapsed ? "&#x25BC;" : "&#x25B6;"; // ▼ or ▶
      entryEl.toggleClass("zen-scrap-entry-collapsed", !collapsed);
    });
  }

  timeline.scrollTop = timeline.scrollHeight;
}
```

**Step 2: CSSを追加**

`styles.app.css` に追加:

```css
/* エントリ折りたたみ */
.zen-scrap-entry-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--background-secondary);
  border-bottom: 1px solid var(--background-modifier-border);
}

.zen-scrap-entry-toggle {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.75em;
  padding: 2px 6px;
  border-radius: 4px;
}

.zen-scrap-entry-toggle:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.zen-scrap-entry-collapsed {
  border-bottom: none;
}
```

注意: `styles.app.css` に既存の `.zen-scrap-entry-header` 定義がある場合は、重複しないよう既存を置き換える。

**Step 3: ビルドして確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`
Expected: ビルド成功

**Step 4: コミット**

```bash
git add src/views/scrap-detail-view.ts styles.app.css
git commit -m "エントリにV字ボタンの折りたたみ機能を追加"
```

---

## 注意事項

- `zenn-markdown-html` の `markdownToHtml()` は `innerHTML` で直接挿入するため、XSSリスクがある。ただし入力元は自分のスクラップ（ソロ利用）のため許容する。
- `zenn-content-css` はダークテーマ対応がないため、Obsidianのダークテーマと衝突する可能性がある。その場合は `styles.app.css` で上書きして調整する。
- `styles.css` はビルド生成物になるので `.gitignore` に追加すること。
