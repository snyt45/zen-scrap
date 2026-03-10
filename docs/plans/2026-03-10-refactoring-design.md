# リファクタリング実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** render()の肥大化とPluginクラスへのUI責務混入を解消する

**Architecture:** 関数抽出のみで対応。新規ファイルはTitlePromptModalの1つだけ。Viewクラスのrenderをprivateメソッドに分割。

**Tech Stack:** TypeScript, Obsidian API

---

### Task 1: TitlePromptModalを抽出

**Files:**
- Create: `src/title-prompt-modal.ts`
- Modify: `src/main.ts`

**Step 1: TitlePromptModalクラスを作成**

```typescript
// src/title-prompt-modal.ts
import { App, Modal } from "obsidian";

export class TitlePromptModal extends Modal {
  private resolve: (value: string | null) => void = () => {};

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("新しいスクラップ");
    const input = this.contentEl.createEl("input", {
      type: "text",
      placeholder: "タイトルを入力...",
      cls: "zen-scrap-title-input",
    });
    input.style.width = "100%";
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        this.close();
        this.resolve(input.value.trim() || null);
      }
      if (e.key === "Escape") {
        this.close();
        this.resolve(null);
      }
    });
    input.focus();
  }

  onClose() {
    this.resolve(null);
  }

  prompt(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
}
```

**Step 2: main.tsからpromptForTitle()を削除し、TitlePromptModalを使う**

`createNewScrap()`内を以下に変更:

```typescript
import { TitlePromptModal } from "./title-prompt-modal";

// promptForTitle()メソッドを削除し、createNewScrap()を変更:
async createNewScrap() {
  const title = await new TitlePromptModal(this.app).prompt();
  if (!title) return;
  const scrap = await this.repo.create(title, []);
  this.openScrap(scrap);
}
```

**Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 4: コミット**

```
git add src/title-prompt-modal.ts src/main.ts
git commit -m "promptForTitleをTitlePromptModalに抽出"
```

---

### Task 2: ScrapRepositoryにgetByPathを追加

**Files:**
- Modify: `src/scrap-repository.ts`

**Step 1: getByPathメソッドを追加**

```typescript
async getByPath(filePath: string): Promise<Scrap | null> {
  const file = this.app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) return null;
  const content = await this.app.vault.read(file);
  return parseScrapMarkdown(content, file.path);
}
```

**Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 3: コミット**

```
git add src/scrap-repository.ts
git commit -m "ScrapRepositoryにgetByPathを追加"
```

---

### Task 3: ScrapDetailViewのrender分割 + setState改善

**Files:**
- Modify: `src/scrap-detail-view.ts`

**Step 1: render()をrenderHeader/renderTimeline/renderInputAreaに分割**

render()の中身を3つのprivateメソッドに切り出す。render()は呼び出すだけになる:

```typescript
async render(): Promise<void> {
  const container = this.containerEl.children[1] as HTMLElement;
  container.empty();
  if (!this.scrap) return;
  container.addClass("zen-scrap-detail-container");

  this.renderHeader(container);
  this.renderTimeline(container);
  this.renderInputArea(container);
}
```

各メソッドは現在のrender()内の対応するブロックをそのまま移動。

**Step 2: setState()でlistAll→getByPathに変更**

```typescript
async setState(state: { filePath?: string }, result: any): Promise<void> {
  if (state.filePath) {
    const found = await this.repo.getByPath(state.filePath);
    if (found) {
      this.scrap = found;
      await this.render();
    }
  }
  await super.setState(state, result);
}
```

**Step 3: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 4: コミット**

```
git add src/scrap-detail-view.ts
git commit -m "ScrapDetailViewのrenderを責務ごとに分割"
```

---

### Task 4: ScrapListViewのrender分割

**Files:**
- Modify: `src/scrap-list-view.ts`

**Step 1: render()をrenderHeader/renderListに分割**

```typescript
async render(): Promise<void> {
  const container = this.containerEl.children[1] as HTMLElement;
  container.empty();
  container.addClass("zen-scrap-list-container");

  this.renderHeader(container);
  await this.renderList(container);
}
```

各メソッドは現在のrender()内の対応するブロックをそのまま移動。

**Step 2: ビルド確認**

Run: `npm run build`
Expected: 成功

**Step 3: コミット**

```
git add src/scrap-list-view.ts
git commit -m "ScrapListViewのrenderを責務ごとに分割"
```
