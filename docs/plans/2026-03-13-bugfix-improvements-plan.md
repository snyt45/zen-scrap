# バグ修正・改善 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 5つのバグ修正・改善（README追記、全画面表示修正、Obsidianリンク修正、画像D&D修正、並べ替えボタン外出し）を実装する

**Architecture:** 既存のObsidianプラグインコードに対する修正。各タスクは独立しており並列実行可能。

**Tech Stack:** TypeScript, Obsidian Plugin API, zenn-markdown-html

---

### Task 1: 画像ドラッグ&ドロップ修正

**Files:**
- Modify: `src/views/detail/input-area-renderer.ts:223`

**Step 1: dropハンドラにe.stopPropagation()を追加**

`src/views/detail/input-area-renderer.ts` の `setupImageDrop` 関数内、`drop` イベントハンドラの `e.preventDefault()` の直後に `e.stopPropagation()` を追加する。

```typescript
textarea.addEventListener("drop", async (e) => {
  e.preventDefault();
  e.stopPropagation();  // Obsidian本体のドロップハンドラが発火して上書きするのを防止
  textarea.removeClass("zen-scrap-textarea-dragover");
  // ... 以下同じ
});
```

**Step 2: ビルドして動作確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`

手動確認: 詳細画面のテキストエリアに画像をドラッグ&ドロップし、`![](path)` が挿入されたまま残ることを確認。

---

### Task 2: Obsidian [[]] リンクのクリック移動修正

**Files:**
- Modify: `src/views/detail/markdown-renderer.ts:60-74`

**Step 1: addLinkHandlerにe.stopPropagation()を追加し、外部リンクにも対応**

`addLinkHandler` メソッドを修正。obsidian:// リンクだけでなく、すべてのリンクに対して適切にイベント制御する。

```typescript
addLinkHandler(container: HTMLElement): void {
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;

    e.preventDefault();
    e.stopPropagation();

    if (href.startsWith("obsidian://open?")) {
      const params = new URLSearchParams(href.replace("obsidian://open?", ""));
      const file = params.get("file");
      if (file) {
        this.app.workspace.openLinkText(file, "", false);
      }
    } else if (href.startsWith("http://") || href.startsWith("https://")) {
      window.open(href, "_blank");
    }
  });
}
```

**Step 2: ビルドして動作確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`

手動確認: エントリ内に `[[ノート名]]` を書いてポストし、レンダリングされたリンクをクリックして該当ノートが開くことを確認。

---

### Task 3: 全画面表示の不具合修正

**Files:**
- Modify: `src/views/detail/header-renderer.ts:30-37`
- Modify: `styles.app.css:305-314`

**Step 1: 全画面トグルをrender()経由に変更**

`header-renderer.ts` の全画面ボタンクリック時に `render()` を呼んで状態を一元管理する。

```typescript
const fullWidthBtn = navRow.createEl("button", { cls: "zen-scrap-fullwidth-toggle" });
fullWidthBtn.innerHTML = deps.isFullWidth ? SHRINK_ICON : EXPAND_ICON;
fullWidthBtn.addEventListener("click", () => {
  deps.setFullWidth(!deps.isFullWidth);
  deps.containerEl.toggleClass("zen-scrap-fullwidth", !deps.isFullWidth);
  fullWidthBtn.innerHTML = !deps.isFullWidth ? SHRINK_ICON : EXPAND_ICON;
});
```

ここでの問題: `deps.isFullWidth` はレンダリング時の値がクロージャにキャプチャされているが、`deps` はオブジェクト参照なので `deps.isFullWidth` の読み取りは最新値になる。ただし `setFullWidth` が値を更新するのは `ScrapDetailView.isFullWidth` であって `deps.isFullWidth` ではない。

根本修正として、クリック時に `setFullWidth` を呼んだ後に `render()` を呼ぶ形に変更する。

```typescript
const fullWidthBtn = navRow.createEl("button", { cls: "zen-scrap-fullwidth-toggle" });
fullWidthBtn.innerHTML = deps.isFullWidth ? SHRINK_ICON : EXPAND_ICON;
fullWidthBtn.addEventListener("click", async () => {
  deps.setFullWidth(!deps.isFullWidth);
  await deps.render();
});
```

これにより `render()` 内で `this.isFullWidth` を参照してクラスとアイコンが正しく設定される。

**Step 2: ボタンのクリック領域を拡大**

`styles.app.css` の `.zen-scrap-fullwidth-toggle` の padding を `6px 10px` に変更。

```css
.zen-scrap-fullwidth-toggle {
  background: none;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
}
```

**Step 3: ビルドして動作確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`

手動確認: 全画面ボタンをクリックして全画面になること、再度クリックで元に戻ること、他の操作（エントリポストなど）後も全画面状態が維持されることを確認。

---

### Task 4: エントリ並べ替えボタンの外出し

**Files:**
- Modify: `src/icons.ts` (上下矢印アイコン追加)
- Modify: `src/views/detail/timeline-renderer.ts:37-73` (並べ替えボタン外出し)
- Modify: `styles.app.css` (並べ替えボタンスタイル追加)

**Step 1: 上下矢印アイコンを追加**

`src/icons.ts` に以下を追加:

```typescript
export function chevronUpIcon(size: number, strokeWidth = 2) {
  return `<svg ${stroke(size, strokeWidth)}><polyline points="18 15 12 9 6 15"></polyline></svg>`;
}
```

既存の `chevronDownIcon` は流用する。

**Step 2: timeline-renderer.tsを修正**

エントリヘッダーのメニューボタンの前に上下矢印ボタンを追加。ドロップダウンメニューから「上へ移動」「下へ移動」を削除。

```typescript
import { chevronDownIcon, chevronUpIcon } from "../../icons";

// エントリヘッダー内（タイムスタンプとメニューの間に配置）
const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });
entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

// 並べ替えボタン（エントリが2件以上のときのみ表示）
if (scrap.entries.length > 1) {
  const reorderBtns = entryHeader.createDiv({ cls: "zen-scrap-reorder-btns" });

  if (i > 0) {
    const upBtn = reorderBtns.createEl("button", { cls: "zen-scrap-reorder-btn" });
    upBtn.innerHTML = chevronUpIcon(14, 2.5);
    upBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      [scrap.entries[i - 1], scrap.entries[i]] = [scrap.entries[i], scrap.entries[i - 1]];
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await render();
    });
  }

  if (i < scrap.entries.length - 1) {
    const downBtn = reorderBtns.createEl("button", { cls: "zen-scrap-reorder-btn" });
    downBtn.innerHTML = chevronDownIcon(14, 2.5);
    downBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      [scrap.entries[i], scrap.entries[i + 1]] = [scrap.entries[i + 1], scrap.entries[i]];
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await render();
    });
  }
}

// メニュー（上下移動を削除し、編集と削除のみ残す）
```

**Step 3: スタイルを追加**

`styles.app.css` に以下を追加:

```css
.zen-scrap-reorder-btns {
  display: flex;
  align-items: center;
  gap: 2px;
}

.zen-scrap-reorder-btn {
  background: none;
  border: none;
  color: var(--text-faint);
  cursor: pointer;
  padding: 2px;
  display: inline-flex;
  align-items: center;
  border-radius: 4px;
}

.zen-scrap-reorder-btn:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}
```

**Step 4: ビルドして動作確認**

Run: `cd /Users/snyt45/work/zen-scrap && npm run build`

手動確認: 各エントリに上下矢印が表示され、連続クリックで並べ替えができること。先頭/末尾のボタン非表示が正しいこと。

---

### Task 5: README に Cmd+Enter ショートカット追記

**Files:**
- Modify: `README.md:28`

**Step 1: Markdownエディタセクションに追記**

28行目の箇条書きに1行追加:

```markdown
### Markdownエディタ

- Markdown / Preview タブで編集とプレビューを切り替え
- `Cmd/Ctrl + Enter` でポスト・更新をショートカット実行
- 「Markdownガイド」リンクから対応記法の一覧を確認できる
```

---

### Task 6: コミット

**Step 1: 全変更をコミット**

```bash
git add README.md src/views/detail/input-area-renderer.ts src/views/detail/markdown-renderer.ts src/views/detail/header-renderer.ts src/views/detail/timeline-renderer.ts src/icons.ts styles.app.css
git commit -m "バグ修正5件: 画像D&D・Obsidianリンク・全画面表示・並べ替えUI・README追記"
```
