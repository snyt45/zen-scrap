# 詳細画面リデザイン 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Zennのスクラップ編集画面を参考に、詳細画面のヘッダー・空状態・エディタUI・埋め込み機能を改善する

**Architecture:** scrap-detail-view.ts のrender系メソッドを書き換え、埋め込み用のモーダルを新規作成。CSSはstyles.app.cssに追記。

**Tech Stack:** TypeScript, Obsidian API, zenn-markdown-html

---

### Task 1: ヘッダー改善

**Files:**
- Modify: `src/views/scrap-detail-view.ts` (renderHeader メソッド)
- Modify: `styles.app.css`

**Step 1: renderHeader を書き換え**

`src/views/scrap-detail-view.ts` の `renderHeader` メソッドを以下に置き換える:

```typescript
private renderHeader(container: HTMLElement): void {
  const header = container.createDiv({ cls: "zen-scrap-detail-header" });

  // 戻るボタン
  const backBtn = header.createEl("button", { text: "← 一覧", cls: "zen-scrap-back-btn" });
  backBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.NAV_BACK_TO_LIST));

  // 1行目: ステータス + 作成日 + エントリ数
  const metaRow = header.createDiv({ cls: "zen-scrap-detail-meta" });
  const labelCls = this.scrap!.status === "open" ? "zen-scrap-label-open" : "zen-scrap-label-closed";
  const labelText = this.scrap!.status === "open" ? "Open" : "Closed";
  metaRow.createSpan({ text: labelText, cls: labelCls });
  metaRow.createSpan({ text: formatDate(this.scrap!.created) + "に作成", cls: "zen-scrap-detail-meta-text" });
  metaRow.createSpan({ text: `${this.scrap!.entries.length}件のコメント`, cls: "zen-scrap-detail-meta-text" });

  // 2行目: タイトル + 編集ボタン
  const titleRow = header.createDiv({ cls: "zen-scrap-detail-title-row" });
  const titleEl = titleRow.createEl("h2", { text: this.scrap!.title, cls: "zen-scrap-detail-title" });

  const editBtn = titleRow.createEl("button", { cls: "zen-scrap-title-edit-btn" });
  editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

  editBtn.addEventListener("click", () => {
    titleRow.empty();
    const input = titleRow.createEl("input", {
      type: "text",
      value: this.scrap!.title,
      cls: "zen-scrap-title-edit-input",
    });

    const saveBtn = titleRow.createEl("button", { text: "保存", cls: "zen-scrap-title-save-btn" });
    const cancelBtn = titleRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-title-cancel-btn" });

    const doSave = async () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== this.scrap!.title) {
        this.scrap!.title = newTitle;
        await this.repo.save(this.scrap!);
        this.eventBus.emit(EVENTS.SCRAP_CHANGED);
      }
      await this.render();
    };

    saveBtn.addEventListener("click", doSave);
    cancelBtn.addEventListener("click", () => this.render());
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); doSave(); }
      if (e.key === "Escape") { this.render(); }
    });
    input.focus();
    input.select();
  });
}
```

**Step 2: CSS追加**

`styles.app.css` に以下を追加:

```css
/* 詳細ヘッダー改善 */
.zen-scrap-detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.zen-scrap-detail-meta-text {
  font-size: 0.9em;
  color: var(--text-muted);
}

.zen-scrap-detail-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zen-scrap-detail-title-row h2 {
  margin: 0;
  flex: 1;
}

.zen-scrap-title-edit-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  flex-shrink: 0;
}

.zen-scrap-title-edit-btn:hover {
  color: var(--text-normal);
  background: var(--background-secondary);
}

.zen-scrap-title-edit-input {
  flex: 1;
  padding: 6px 10px;
  font-size: 1.2em;
  font-weight: 700;
  border: 1px solid var(--interactive-accent);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
}

.zen-scrap-title-save-btn {
  padding: 4px 12px;
  border-radius: 6px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  cursor: pointer;
}

.zen-scrap-title-cancel-btn {
  padding: 4px 12px;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
}
```

**Step 3: formatDate ヘルパー追加**

`scrap-detail-view.ts` のファイル末尾に追加:

```typescript
function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
```

**Step 4: 古いCSS削除**

`styles.app.css` から以下の不要なCSSを削除:
- `.zen-scrap-detail-controls`
- `.zen-scrap-status`, `.zen-scrap-status-open`, `.zen-scrap-status-closed`
- `.zen-scrap-detail-tags`

**Step 5: コミット**

```bash
git add src/views/scrap-detail-view.ts styles.app.css
git commit -m "詳細画面のヘッダーを改善（ステータス+日付+タイトル編集）"
```

---

### Task 2: 空状態表示

**Files:**
- Modify: `src/views/scrap-detail-view.ts` (renderTimeline メソッド)
- Modify: `styles.app.css`

**Step 1: renderTimeline に空状態を追加**

`renderTimeline` メソッドの先頭（`for` ループの前）に追加:

```typescript
if (this.scrap!.entries.length === 0) {
  const emptyCard = timeline.createDiv({ cls: "zen-scrap-empty-state" });
  emptyCard.setText("最初のコメントを追加しましょう");
  return;
}
```

**Step 2: CSS追加**

```css
.zen-scrap-empty-state {
  text-align: center;
  padding: 40px 20px;
  margin: 20px 0;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 0.95em;
}
```

**Step 3: コミット**

```bash
git add src/views/scrap-detail-view.ts styles.app.css
git commit -m "詳細画面にエントリ0件時の空状態表示を追加"
```

---

### Task 3: エディタUI改善（pill風タブ + 投稿ボタン）

**Files:**
- Modify: `src/views/scrap-detail-view.ts` (renderInputArea メソッド)
- Modify: `styles.app.css`

**Step 1: renderInputArea を書き換え**

```typescript
private renderInputArea(container: HTMLElement): void {
  const inputArea = container.createDiv({ cls: "zen-scrap-input-area" });

  // pill風タブ
  const tabHeader = inputArea.createDiv({ cls: "zen-scrap-pill-tabs" });
  const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
  const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab" });

  // textarea
  const textarea = inputArea.createEl("textarea", {
    placeholder: "スクラップにコメントを追加",
    cls: "zen-scrap-textarea",
  });

  // プレビュー
  const preview = inputArea.createDiv({ cls: "zen-scrap-preview znc" });
  preview.style.display = "none";

  // タブ切り替え
  mdTab.addEventListener("click", () => {
    mdTab.addClass("zen-scrap-pill-tab-active");
    pvTab.removeClass("zen-scrap-pill-tab-active");
    textarea.style.display = "";
    preview.style.display = "none";
  });

  pvTab.addEventListener("click", async () => {
    pvTab.addClass("zen-scrap-pill-tab-active");
    mdTab.removeClass("zen-scrap-pill-tab-active");
    textarea.style.display = "none";
    preview.style.display = "";
    if (textarea.value.trim()) {
      preview.innerHTML = await markdownToHtml(textarea.value);
    } else {
      preview.innerHTML = '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';
    }
  });

  // アクションバー（画像 + 埋め込み + 投稿ボタン）
  const actionBar = inputArea.createDiv({ cls: "zen-scrap-action-bar" });

  // 画像ボタン
  const imgBtn = actionBar.createEl("button", { text: "画像", cls: "zen-scrap-img-btn" });
  imgBtn.addEventListener("click", () => this.handleImageUpload(textarea));

  // 埋め込みボタン
  this.renderEmbedButton(actionBar, textarea);

  // 投稿ボタン
  const submitBtn = actionBar.createEl("button", { text: "投稿する", cls: "zen-scrap-submit-btn-new" });
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

**Step 2: CSS追加（pill風タブ + 新投稿ボタン + アクションバー）**

```css
/* pill風タブ */
.zen-scrap-pill-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.zen-scrap-pill-tab {
  padding: 6px 16px;
  border-radius: 20px;
  border: 1px solid var(--background-modifier-border);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85em;
  font-weight: 600;
}

.zen-scrap-pill-tab:hover {
  color: var(--text-normal);
}

.zen-scrap-pill-tab-active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}

/* アクションバー */
.zen-scrap-action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.zen-scrap-img-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85em;
}

.zen-scrap-img-btn:hover {
  color: var(--text-normal);
  background: var(--background-secondary);
}

/* 新しい投稿ボタン */
.zen-scrap-submit-btn-new {
  margin-left: auto;
  padding: 8px 20px;
  border-radius: 20px;
  background: #2563eb;
  color: #fff;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.zen-scrap-submit-btn-new:hover {
  background: #1d4ed8;
}
```

**Step 3: 古いタブCSSを削除**

`styles.app.css` から以下を削除:
- `.zen-scrap-input-tabs`
- `.zen-scrap-input-tab`
- `.zen-scrap-input-tab:hover`
- `.zen-scrap-input-tab-active`
- `.zen-scrap-submit-btn`、`.zen-scrap-submit-btn:hover`

**Step 4: コミット**

```bash
git add src/views/scrap-detail-view.ts styles.app.css
git commit -m "エディタUIをpill風タブと青い投稿ボタンに改善"
```

---

### Task 4: 埋め込み機能

**Files:**
- Create: `src/ui/embed-modal.ts`
- Modify: `src/views/scrap-detail-view.ts` (renderEmbedButton メソッド追加)
- Modify: `styles.app.css`

**Step 1: EmbedModal を作成**

`src/ui/embed-modal.ts`:

```typescript
import { App, Modal } from "obsidian";

export type EmbedType = "tweet" | "youtube" | "card" | "github";

const EMBED_CONFIG: Record<EmbedType, { title: string; placeholder: string }> = {
  tweet: { title: "Xのポストを埋め込み", placeholder: "ポストのURLを入力..." },
  youtube: { title: "YouTubeを埋め込み", placeholder: "動画のURLを入力..." },
  card: { title: "Web記事を埋め込み", placeholder: "記事のURLを入力..." },
  github: { title: "GitHubを埋め込み", placeholder: "リポジトリまたはIssueのURLを入力..." },
};

export class EmbedModal extends Modal {
  private embedType: EmbedType;
  private onSubmit: (syntax: string) => void;

  constructor(app: App, embedType: EmbedType, onSubmit: (syntax: string) => void) {
    super(app);
    this.embedType = embedType;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const config = EMBED_CONFIG[this.embedType];
    this.titleEl.setText(config.title);

    const input = this.contentEl.createEl("input", {
      type: "text",
      placeholder: config.placeholder,
      cls: "zen-scrap-embed-input",
    });
    input.style.width = "100%";

    const btnRow = this.contentEl.createDiv({ cls: "zen-scrap-embed-btn-row" });
    const insertBtn = btnRow.createEl("button", { text: "挿入", cls: "zen-scrap-embed-insert-btn" });
    const cancelBtn = btnRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-embed-cancel-btn" });

    const doInsert = () => {
      const url = input.value.trim();
      if (!url) return;
      const syntax = this.buildSyntax(url);
      this.onSubmit(syntax);
      this.close();
    };

    insertBtn.addEventListener("click", doInsert);
    cancelBtn.addEventListener("click", () => this.close());
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); doInsert(); }
      if (e.key === "Escape") { this.close(); }
    });
    input.focus();
  }

  private buildSyntax(url: string): string {
    if (this.embedType === "youtube") {
      const id = this.extractYouTubeId(url);
      return `@[youtube](${id})`;
    }
    return `@[${this.embedType}](${url})`;
  }

  private extractYouTubeId(url: string): string {
    const patterns = [
      /youtu\.be\/([^?&]+)/,
      /youtube\.com\/watch\?v=([^&]+)/,
      /youtube\.com\/embed\/([^?&]+)/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return url;
  }

  onClose() {
    this.contentEl.empty();
  }
}
```

**Step 2: renderEmbedButton メソッドを scrap-detail-view.ts に追加**

```typescript
private renderEmbedButton(parent: HTMLElement, textarea: HTMLTextAreaElement): void {
  const wrapper = parent.createDiv({ cls: "zen-scrap-embed-wrapper" });
  const embedBtn = wrapper.createEl("button", { text: "+ 埋め込み", cls: "zen-scrap-embed-btn" });

  const menu = wrapper.createDiv({ cls: "zen-scrap-embed-menu" });
  menu.style.display = "none";

  const items: { label: string; type: EmbedType }[] = [
    { label: "X (Twitter)", type: "tweet" },
    { label: "YouTube", type: "youtube" },
    { label: "Web記事", type: "card" },
    { label: "GitHub", type: "github" },
  ];

  for (const item of items) {
    const menuItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: item.label });
    menuItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.style.display = "none";
      new EmbedModal(this.app, item.type, (syntax) => {
        const pos = textarea.selectionStart;
        const before = textarea.value.substring(0, pos);
        const after = textarea.value.substring(pos);
        textarea.value = before + syntax + "\n" + after;
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = pos + syntax.length + 1;
      }).open();
    });
  }

  embedBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === "none" ? "" : "none";
  });

  document.addEventListener("click", () => {
    menu.style.display = "none";
  });
}
```

**Step 3: import追加**

`scrap-detail-view.ts` の先頭に追加:

```typescript
import { EmbedModal, EmbedType } from "../ui/embed-modal";
```

**Step 4: CSS追加**

```css
/* 埋め込みボタン */
.zen-scrap-embed-wrapper {
  position: relative;
}

.zen-scrap-embed-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--background-modifier-border);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.85em;
}

.zen-scrap-embed-btn:hover {
  color: var(--text-normal);
  background: var(--background-secondary);
}

.zen-scrap-embed-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  z-index: 100;
  min-width: 160px;
  padding: 4px 0;
  margin-bottom: 4px;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 埋め込みモーダル */
.zen-scrap-embed-input {
  padding: 8px 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 0.9em;
  margin-bottom: 12px;
}

.zen-scrap-embed-input:focus {
  outline: none;
  border-color: var(--interactive-accent);
}

.zen-scrap-embed-btn-row {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.zen-scrap-embed-insert-btn {
  padding: 6px 16px;
  border-radius: 6px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  cursor: pointer;
}

.zen-scrap-embed-cancel-btn {
  padding: 6px 16px;
  border-radius: 6px;
  background: none;
  color: var(--text-muted);
  border: 1px solid var(--background-modifier-border);
  cursor: pointer;
}
```

**Step 5: コミット**

```bash
git add src/ui/embed-modal.ts src/views/scrap-detail-view.ts styles.app.css
git commit -m "埋め込み機能を追加（X・YouTube・Web記事・GitHub）"
```

---

### Task 5: 画像アップロード

**Files:**
- Modify: `src/views/scrap-detail-view.ts` (handleImageUpload メソッド追加)

**Step 1: handleImageUpload メソッドを追加**

```typescript
private handleImageUpload(textarea: HTMLTextAreaElement): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const fileName = `${Date.now()}-${file.name}`;
    const folderPath = "Scraps/images";

    // フォルダ作成
    if (!this.app.vault.getAbstractFileByPath(folderPath)) {
      await this.app.vault.createFolder(folderPath);
    }

    const filePath = `${folderPath}/${fileName}`;
    await this.app.vault.createBinary(filePath, buffer);

    const syntax = `![](${filePath})`;
    const pos = textarea.selectionStart;
    const before = textarea.value.substring(0, pos);
    const after = textarea.value.substring(pos);
    textarea.value = before + syntax + "\n" + after;
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = pos + syntax.length + 1;
  });
  input.click();
}
```

**Step 2: コミット**

```bash
git add src/views/scrap-detail-view.ts
git commit -m "画像アップロード機能を追加"
```
