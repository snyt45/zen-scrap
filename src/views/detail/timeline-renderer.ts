import { App, Notice } from "obsidian";
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { CollectionRepository } from "../../data/collection-repository";
import { formatDate } from "../../utils";
import { chevronDownIcon, GRIP_ICON, BOOKMARK_ICON, BOOKMARK_FILLED_ICON } from "../../icons";
import { MarkdownRenderer } from "./markdown-renderer";
import { renderEntryEditor, EntryEditorDeps } from "./input-area-renderer";
import { CollectionPickerModal } from "../../ui/collection-picker-modal";

export interface TimelineDeps {
  scrap: Scrap;
  repo: ScrapRepository;
  collectionRepo: CollectionRepository;
  app: App;
  render: () => Promise<void>;
  markdownRenderer: MarkdownRenderer;
  addDocumentClickHandler: (handler: () => void) => void;
  entryEditorDeps: Omit<EntryEditorDeps, "entryEl" | "entryBody" | "index">;
  filterMarked?: boolean;
  setFilterMarked?: (v: boolean) => void;
}

export function renderClosedBanner(container: HTMLElement, scrap: Scrap): void {
  const banner = container.createDiv({ cls: "zen-scrap-closed-banner" });
  const icon = banner.createEl("div", { cls: "zen-scrap-closed-icon" });
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  banner.createEl("div", {
    text: `このスクラップは${formatDate(scrap.updated)}にクローズされました`,
    cls: "zen-scrap-closed-text",
  });
}

export async function renderTimeline(container: HTMLElement, deps: TimelineDeps): Promise<void> {
  const { scrap, repo, render, markdownRenderer, addDocumentClickHandler } = deps;
  const timeline = container.createDiv({ cls: "zen-scrap-timeline" });

  if (scrap.entries.length === 0) {
    const emptyCard = timeline.createDiv({ cls: "zen-scrap-empty-state" });
    emptyCard.setText("最初のコメントを追加しましょう");
    return;
  }

  // 自動スクロール用: 詳細画面のスクロールコンテナを取得
  const scrollContainer = timeline.closest(".zen-scrap-detail-container") as HTMLElement | null;
  let autoScrollRaf = 0;

  const startAutoScroll = (clientY: number) => {
    cancelAnimationFrame(autoScrollRaf);
    if (!scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    const edgeZone = 60;
    const maxSpeed = 12;

    const tick = () => {
      const top = clientY - rect.top;
      const bottom = rect.bottom - clientY;
      if (top < edgeZone) {
        scrollContainer.scrollTop -= maxSpeed * (1 - top / edgeZone);
      } else if (bottom < edgeZone) {
        scrollContainer.scrollTop += maxSpeed * (1 - bottom / edgeZone);
      }
      autoScrollRaf = requestAnimationFrame(tick);
    };
    autoScrollRaf = requestAnimationFrame(tick);
  };

  const stopAutoScroll = () => cancelAnimationFrame(autoScrollRaf);

  const entriesToRender = deps.filterMarked
    ? scrap.entries.map((e, i) => ({ entry: e, originalIndex: i })).filter(({ entry }) => entry.marked)
    : scrap.entries.map((e, i) => ({ entry: e, originalIndex: i }));

  if (deps.filterMarked && entriesToRender.length === 0) {
    // マーク済みが0件になったら自動的に絞り込み解除
    if (deps.setFilterMarked) {
      deps.setFilterMarked(false);
      await render();
      return;
    }
  }

  // マーク絞り込み時のまとめてコピーボタン
  if (deps.filterMarked && entriesToRender.length > 0) {
    const bulkBar = timeline.createDiv({ cls: "zen-scrap-marked-bulk-bar" });
    const bulkCopyBtn = bulkBar.createEl("button", {
      text: `マーク済み${entriesToRender.length}件をまとめてコピー`,
      cls: "zen-scrap-bulk-copy-btn",
    });
    bulkCopyBtn.addEventListener("click", async () => {
      const bodies = entriesToRender.map(({ entry }) => entry.body).join("\n\n---\n\n");
      await navigator.clipboard.writeText(bodies);
      new Notice(`${entriesToRender.length}件のセクションをコピーしました`);
    });
  }

  // Phase 1: 全エントリのDOM骨格を同期的に作成（スクロール遷移が即座に動くようにする）
  const renderTasks: (() => Promise<void>)[] = [];

  for (const { entry, originalIndex: i } of entriesToRender) {
    const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

    // ドラッグ&ドロップ並べ替え（ハンドルからのみ）
    if (scrap.entries.length > 1) {
      entryEl.dataset.entryIndex = String(i);

      entryEl.addEventListener("dragstart", (e) => {
        // ハンドル以外からのドラッグを無効化
        const target = e.target as HTMLElement;
        if (!target.closest(".zen-scrap-drag-handle")) {
          e.preventDefault();
          return;
        }
        entryEl.addClass("zen-scrap-entry-dragging");
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("text/plain", String(i));
      });

      entryEl.addEventListener("dragend", () => {
        entryEl.removeClass("zen-scrap-entry-dragging");
        stopAutoScroll();
        timeline.querySelectorAll(".zen-scrap-entry-dragover").forEach((el) => {
          el.removeClass("zen-scrap-entry-dragover");
        });
      });

      entryEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        startAutoScroll(e.clientY);
        if (!entryEl.hasClass("zen-scrap-entry-dragging")) {
          entryEl.addClass("zen-scrap-entry-dragover");
        }
      });

      entryEl.addEventListener("dragleave", () => {
        entryEl.removeClass("zen-scrap-entry-dragover");
      });

      entryEl.addEventListener("drop", async (e) => {
        e.preventDefault();
        stopAutoScroll();
        entryEl.removeClass("zen-scrap-entry-dragover");
        const fromIndex = Number(e.dataTransfer!.getData("text/plain"));
        const toIndex = i;
        if (fromIndex === toIndex) return;

        const [moved] = scrap.entries.splice(fromIndex, 1);
        scrap.entries.splice(toIndex, 0, moved);
        scrap.updated = new Date().toISOString();
        await repo.save(scrap);
        await render();
      });
    }

    const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });

    // ドラッグハンドル
    if (scrap.entries.length > 1) {
      const handle = entryHeader.createEl("button", { cls: "zen-scrap-drag-handle" });
      handle.innerHTML = GRIP_ICON;
      handle.setAttribute("draggable", "true");
      handle.addEventListener("dragstart", (e) => {
        // ハンドルのdragstartを親のentryElに伝搬させる
        entryEl.dispatchEvent(new DragEvent("dragstart", {
          dataTransfer: e.dataTransfer,
          bubbles: true,
        }));
      });
    }

    entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

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

    const menuWrapper = entryHeader.createDiv({ cls: "zen-scrap-entry-menu" });
    const menuBtn = menuWrapper.createEl("button", { cls: "zen-scrap-entry-menu-btn" });
    menuBtn.innerHTML = chevronDownIcon(18);

    const menu = menuWrapper.createDiv({ cls: "zen-scrap-entry-menu-dropdown" });

    const copyItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: "コピー" });
    copyItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      menu.classList.remove("is-open");
      await navigator.clipboard.writeText(entry.body);
      new Notice("セクションをコピーしました");
    });

    const addToCollectionItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: "コレクションに追加" });
    addToCollectionItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.remove("is-open");
      new CollectionPickerModal(deps.app, deps.collectionRepo, async (collectionId) => {
        await deps.collectionRepo.addItem(collectionId, { type: "entry", scrapPath: scrap.filePath, entryTimestamp: entry.timestamp });
        new Notice("コレクションに追加しました");
      }).open();
    });

    const editItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: "編集" });
    const deleteItem = menu.createDiv({ cls: "zen-scrap-dropdown-item zen-scrap-dropdown-item-danger", text: "削除" });

    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.classList.contains("is-open");
      timeline.querySelectorAll<HTMLElement>(".zen-scrap-entry-menu-dropdown").forEach((m) => {
        m.classList.remove("is-open");
      });
      if (!isOpen) menu.classList.add("is-open");
    });

    // 本文エリアを空で作成（後から非同期で埋める）
    const entryBody = entryEl.createDiv({ cls: "zen-scrap-entry-body znc" });

    editItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.remove("is-open");
      renderEntryEditor({ ...deps.entryEditorDeps, entryEl, entryBody, index: i });
    });

    deleteItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      menu.classList.remove("is-open");
      if (!confirm("このセクションを削除しますか？")) return;
      scrap.entries.splice(i, 1);
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await render();
    });

    // Phase 2用: 本文レンダリングタスクを蓄積
    renderTasks.push(async () => {
      entryBody.innerHTML = await markdownRenderer.renderBody(entry.body);
      markdownRenderer.addCopyButtons(entryBody);
      markdownRenderer.addLinkHandler(entryBody);
    });
  }

  const closeEntryMenus = () => {
    timeline.querySelectorAll<HTMLElement>(".zen-scrap-entry-menu-dropdown").forEach((m) => {
      m.classList.remove("is-open");
    });
  };
  addDocumentClickHandler(closeEntryMenus);

  // Phase 2: 本文を並列レンダリング（DOM骨格は既に揃っている）
  await Promise.all(renderTasks.map((task) => task()));
}
