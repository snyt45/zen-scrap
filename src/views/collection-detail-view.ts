import { ItemView, Notice, Scope, WorkspaceLeaf } from "obsidian";
import { Collection } from "../data/collection-types";
import { CollectionRepository } from "../data/collection-repository";
import { ScrapRepository } from "../data/scrap-repository";
import { InboxRepository } from "../data/inbox-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { renderTabNav } from "./shared/tab-nav-renderer";
import { CleanupManager } from "../ui/cleanup-manager";
import { chevronLeftIcon, EDIT_ICON, GRIP_ICON } from "../icons";
import { stripMarkdown } from "../utils";
import { CollectionAddModal } from "../ui/collection-add-modal";
import { MarkdownRenderer } from "./detail/markdown-renderer";

export const VIEW_TYPE_COLLECTION_DETAIL = "zen-scrap-collection-detail";

export class CollectionDetailView extends ItemView {
  private collectionRepo: CollectionRepository;
  private repo: ScrapRepository;
  private inboxRepo: InboxRepository;
  private eventBus: EventBus;
  private collection: Collection | null = null;
  private cleanupManager = new CleanupManager();
  private markdownRenderer: MarkdownRenderer;
  private onCollectionChangedHandler: () => void;

  constructor(
    leaf: WorkspaceLeaf,
    collectionRepo: CollectionRepository,
    repo: ScrapRepository,
    inboxRepo: InboxRepository,
    eventBus: EventBus
  ) {
    super(leaf);
    this.collectionRepo = collectionRepo;
    this.repo = repo;
    this.inboxRepo = inboxRepo;
    this.eventBus = eventBus;
    this.markdownRenderer = new MarkdownRenderer(this.app);
    this.onCollectionChangedHandler = async () => {
      if (!this.collection) return;
      const updated = await this.collectionRepo.get(this.collection.id);
      if (updated) {
        this.collection = updated;
        await this.render();
      }
    };
  }

  getViewType(): string {
    return VIEW_TYPE_COLLECTION_DETAIL;
  }

  getDisplayText(): string {
    return this.collection?.title || "コレクション詳細";
  }

  getIcon(): string {
    return "folder";
  }

  async setState(state: Record<string, unknown>, result: any): Promise<void> {
    if (state.collectionId && typeof state.collectionId === "string") {
      const found = await this.collectionRepo.get(state.collectionId);
      if (found) {
        this.collection = found;
      }
    }
    await this.render();
    await super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    return { collectionId: this.collection?.id };
  }

  async onOpen(): Promise<void> {
    this.eventBus.on(EVENTS.COLLECTION_CHANGED, this.onCollectionChangedHandler);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.eventBus.off(EVENTS.COLLECTION_CHANGED, this.onCollectionChangedHandler);
    this.cleanupManager.cleanup();
  }

  async render(): Promise<void> {
    this.cleanupManager.cleanup();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-collection-detail-container");

    const inboxCount = await this.inboxRepo.count();
    renderTabNav(container, {
      eventBus: this.eventBus,
      activeTab: "none",
      inboxCount,
    });

    // 戻るリンク
    const backLink = container.createDiv({ cls: "zen-scrap-back-link" });
    const backBtn = backLink.createEl("a", { cls: "zen-scrap-back-btn" });
    backBtn.innerHTML = `${chevronLeftIcon(14)} コレクション`;
    backBtn.addEventListener("click", () => {
      this.eventBus.emit(EVENTS.NAV_TO_COLLECTION_LIST);
    });

    if (!this.collection) {
      container.createDiv({ cls: "zen-scrap-empty", text: "コレクションが見つかりません" });
      return;
    }

    const collection = this.collection;
    const render = () => this.render();

    // タイトル行
    const titleRow = container.createDiv({ cls: "zen-scrap-detail-title-row" });
    const titleEl = titleRow.createEl("h2", {
      text: collection.title,
      cls: "zen-scrap-detail-title zen-scrap-detail-title-editable",
    });

    titleEl.addEventListener("click", () => {
      titleRow.empty();
      const input = titleRow.createEl("input", {
        type: "text",
        value: collection.title,
        cls: "zen-scrap-title-edit-input",
      });

      const saveBtn = titleRow.createEl("button", { text: "保存", cls: "zen-scrap-btn-primary zen-scrap-title-save-btn" });
      const cancelBtn = titleRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-btn-secondary zen-scrap-title-cancel-btn" });

      const doSave = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== collection.title) {
          collection.title = newTitle;
          collection.updated = new Date().toISOString();
          await this.collectionRepo.save(collection);
          this.eventBus.emit(EVENTS.COLLECTION_CHANGED);
        }
        await render();
      };

      saveBtn.addEventListener("click", doSave);
      cancelBtn.addEventListener("click", () => render());
      input.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.isComposing) return;
        if (e.key === "Enter") { e.preventDefault(); doSave(); }
        if (e.key === "Escape") { render(); }
      });
      input.focus();
      input.select();
    });

    // 説明
    const descSection = container.createDiv({ cls: "zen-scrap-description-section" });

    const renderDescDisplay = async () => {
      descSection.empty();
      if (collection.description) {
        const descBody = descSection.createDiv({ cls: "zen-scrap-description-body znc" });
        descBody.innerHTML = await this.markdownRenderer.renderBody(collection.description);
        this.markdownRenderer.addCopyButtons(descBody);
        this.markdownRenderer.addLinkHandler(descBody);
        const editBtn = descSection.createEl("button", { cls: "zen-scrap-description-edit-btn" });
        editBtn.innerHTML = EDIT_ICON;
        editBtn.addEventListener("click", () => renderDescEdit());
      } else {
        const addLink = descSection.createSpan({ text: "+ 説明を追加", cls: "zen-scrap-description-add-link" });
        addLink.addEventListener("click", () => renderDescEdit());
      }
    };

    const EMPTY_PREVIEW_HTML = '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';

    const renderDescEdit = () => {
      descSection.empty();
      const editArea = descSection.createDiv({ cls: "zen-scrap-description-edit" });

      const tabHeader = editArea.createDiv({ cls: "zen-scrap-pill-tabs" });
      const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
      const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab" });

      const textarea = editArea.createEl("textarea", { cls: "zen-scrap-textarea" });
      textarea.value = collection.description || "";
      textarea.placeholder = "説明を追加";

      const adjustHeight = () => {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      };
      textarea.addEventListener("input", adjustHeight);
      requestAnimationFrame(adjustHeight);

      const preview = editArea.createDiv({ cls: "zen-scrap-preview znc" });
      preview.style.display = "none";
      preview.tabIndex = -1;

      mdTab.addEventListener("click", () => {
        mdTab.addClass("zen-scrap-pill-tab-active");
        pvTab.removeClass("zen-scrap-pill-tab-active");
        textarea.style.display = "";
        preview.style.display = "none";
        textarea.focus();
      });

      pvTab.addEventListener("click", async () => {
        pvTab.addClass("zen-scrap-pill-tab-active");
        mdTab.removeClass("zen-scrap-pill-tab-active");
        textarea.style.display = "none";
        preview.style.display = "";
        preview.focus();
        if (textarea.value.trim()) {
          preview.innerHTML = await this.markdownRenderer.renderBody(textarea.value);
          this.markdownRenderer.addCopyButtons(preview);
          this.markdownRenderer.addLinkHandler(preview);
        } else {
          preview.innerHTML = EMPTY_PREVIEW_HTML;
        }
      });

      const actionBar = editArea.createDiv({ cls: "zen-scrap-action-bar" });
      const cancelBtn = actionBar.createEl("button", { text: "キャンセル", cls: "zen-scrap-btn-secondary zen-scrap-edit-cancel-btn" });
      const saveBtn = actionBar.createEl("button", { text: "保存する", cls: "zen-scrap-btn-primary zen-scrap-submit-btn-new" });

      const doSave = async () => {
        collection.description = textarea.value.trim();
        collection.updated = new Date().toISOString();
        await this.collectionRepo.save(collection);
        await renderDescDisplay();
        this.eventBus.emit(EVENTS.COLLECTION_CHANGED);
      };

      cancelBtn.addEventListener("click", () => renderDescDisplay());
      saveBtn.addEventListener("click", doSave);

      const descScope = new Scope(this.scope ?? undefined);
      descScope.register(["Mod"], "Enter", (e: KeyboardEvent) => {
        e.preventDefault();
        saveBtn.click();
        return false;
      });
      descScope.register(["Mod"], "E", (e: KeyboardEvent) => {
        e.preventDefault();
        if (preview.style.display === "none") {
          pvTab.click();
        } else {
          mdTab.click();
        }
        return false;
      });
      textarea.addEventListener("focus", () => this.app.keymap.pushScope(descScope));
      textarea.addEventListener("blur", () => this.app.keymap.popScope(descScope));
      preview.addEventListener("focus", () => this.app.keymap.pushScope(descScope));
      preview.addEventListener("blur", () => this.app.keymap.popScope(descScope));

      textarea.focus();
    };

    renderDescDisplay();

    // アクションバー
    const actionBar = container.createDiv({ cls: "zen-scrap-collection-actions" });

    const addBtn = actionBar.createEl("button", {
      text: "+ 追加",
      cls: "zen-scrap-btn-primary zen-scrap-collection-add-btn",
    });
    addBtn.addEventListener("click", () => {
      const modal = new CollectionAddModal(this.app, this.repo, async (item) => {
        const { added } = await this.collectionRepo.addItem(collection.id, {
          type: item.type,
          scrapPath: item.scrapPath,
          entryTimestamp: item.entryTimestamp,
        });
        if (added) {
          this.eventBus.emit(EVENTS.COLLECTION_CHANGED);
        } else {
          new Notice("すでに追加済みです");
        }
      });
      modal.open();
    });

    const copyBtn = actionBar.createEl("button", {
      text: "まとめてコピー",
      cls: "zen-scrap-btn-secondary zen-scrap-collection-copy-btn",
    });
    copyBtn.addEventListener("click", () => this.bulkCopy());

    // アイテム一覧
    const sortedItems = [...collection.items].sort((a, b) => a.order - b.order);

    if (sortedItems.length === 0) {
      container.createDiv({ cls: "zen-scrap-empty", text: "アイテムがありません" });
      return;
    }

    const list = container.createDiv({ cls: "zen-scrap-collection-item-list" });

    // 自動スクロール用: スクロールコンテナを取得
    const scrollContainer = list.closest(".zen-scrap-collection-detail-container") as HTMLElement | null;
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

    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const itemEl = list.createDiv({ cls: "zen-scrap-collection-item" });

      // ドラッグ&ドロップ並べ替え
      if (sortedItems.length > 1) {
        itemEl.dataset.itemIndex = String(i);

        itemEl.addEventListener("dragstart", (e) => {
          const target = e.target as HTMLElement;
          if (!target.closest(".zen-scrap-drag-handle")) {
            e.preventDefault();
            return;
          }
          itemEl.addClass("zen-scrap-collection-item-dragging");
          e.dataTransfer!.effectAllowed = "move";
          e.dataTransfer!.setData("text/plain", String(i));
        });

        itemEl.addEventListener("dragend", () => {
          itemEl.removeClass("zen-scrap-collection-item-dragging");
          stopAutoScroll();
          list.querySelectorAll(".zen-scrap-collection-item-dragover").forEach((el) => {
            el.removeClass("zen-scrap-collection-item-dragover");
          });
        });

        itemEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer!.dropEffect = "move";
          startAutoScroll(e.clientY);
          if (!itemEl.hasClass("zen-scrap-collection-item-dragging")) {
            itemEl.addClass("zen-scrap-collection-item-dragover");
          }
        });

        itemEl.addEventListener("dragleave", () => {
          itemEl.removeClass("zen-scrap-collection-item-dragover");
        });

        itemEl.addEventListener("drop", async (e) => {
          e.preventDefault();
          stopAutoScroll();
          itemEl.removeClass("zen-scrap-collection-item-dragover");
          const fromIndex = Number(e.dataTransfer!.getData("text/plain"));
          const toIndex = i;
          if (fromIndex === toIndex) return;

          // sortedItemsの並びを変更してorderを振り直す
          const reordered = [...sortedItems];
          const [moved] = reordered.splice(fromIndex, 1);
          reordered.splice(toIndex, 0, moved);
          reordered.forEach((it, idx) => { it.order = idx; });

          await this.collectionRepo.reorderItems(collection.id, reordered);
          this.eventBus.emit(EVENTS.COLLECTION_CHANGED);
        });
      }

      // ドラッグハンドル
      if (sortedItems.length > 1) {
        const handle = itemEl.createEl("button", { cls: "zen-scrap-drag-handle" });
        handle.innerHTML = GRIP_ICON;
        handle.setAttribute("draggable", "true");
        handle.addEventListener("dragstart", (e) => {
          itemEl.dispatchEvent(new DragEvent("dragstart", {
            dataTransfer: e.dataTransfer,
            bubbles: true,
          }));
        });
      }

      const content = itemEl.createDiv({ cls: "zen-scrap-collection-item-content" });

      if (item.type === "scrap") {
        const scrap = await this.repo.getByPath(item.scrapPath);
        if (scrap) {
          const titleRow = content.createDiv({ cls: "zen-scrap-collection-item-title-row" });
          titleRow.createSpan({ text: "scrap", cls: "zen-scrap-collection-item-type-label" });
          titleRow.createSpan({ text: scrap.title, cls: "zen-scrap-collection-item-title" });
          if (scrap.description) {
            const preview = stripMarkdown(scrap.description, 120);
            content.createDiv({ text: preview, cls: "zen-scrap-collection-item-preview" });
          }
        } else {
          content.createDiv({
            text: "元データが見つかりません",
            cls: "zen-scrap-collection-item-missing",
          });
        }

        itemEl.addEventListener("click", async (e) => {
          if ((e.target as HTMLElement).closest(".zen-scrap-collection-item-delete")) return;
          if (!scrap) {
            new Notice("元のスクラップが見つかりません");
            return;
          }
          this.eventBus.emit(EVENTS.SCRAP_SELECT, scrap);
        });
      } else {
        // type === "entry"
        const scrap = await this.repo.getByPath(item.scrapPath);
        if (scrap && item.entryTimestamp) {
          const entry = scrap.entries.find((e) => e.timestamp === item.entryTimestamp);
          if (entry) {
            const titleRow = content.createDiv({ cls: "zen-scrap-collection-item-title-row" });
            titleRow.createSpan({ text: "entry", cls: "zen-scrap-collection-item-type-label zen-scrap-collection-item-type-entry" });
            titleRow.createSpan({ text: `${scrap.title} > ${item.entryTimestamp}`, cls: "zen-scrap-collection-item-title" });
            const preview = stripMarkdown(entry.body, 120);
            content.createDiv({ text: preview, cls: "zen-scrap-collection-item-preview" });
          } else {
            content.createDiv({
              text: "元データが見つかりません",
              cls: "zen-scrap-collection-item-missing",
            });
          }
        } else {
          content.createDiv({
            text: "元データが見つかりません",
            cls: "zen-scrap-collection-item-missing",
          });
        }

        itemEl.addEventListener("click", async (e) => {
          if ((e.target as HTMLElement).closest(".zen-scrap-collection-item-delete")) return;
          const s = await this.repo.getByPath(item.scrapPath);
          if (!s) {
            new Notice("元のスクラップが見つかりません");
            return;
          }
          const entryIndex = item.entryTimestamp
            ? s.entries.findIndex((en) => en.timestamp === item.entryTimestamp)
            : -1;
          this.eventBus.emit(EVENTS.SCRAP_SELECT, s, entryIndex >= 0 ? entryIndex : undefined);
        });
      }

      // 削除ボタン
      const originalIndex = collection.items.indexOf(item);
      const deleteBtn = itemEl.createEl("button", {
        text: "×",
        cls: "zen-scrap-collection-item-delete",
      });
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.collectionRepo.removeItem(collection.id, originalIndex);
        this.eventBus.emit(EVENTS.COLLECTION_CHANGED);
      });
    }
  }

  private async bulkCopy(): Promise<void> {
    if (!this.collection) return;

    const sortedItems = [...this.collection.items].sort((a, b) => a.order - b.order);
    const parts: string[] = [];

    for (const item of sortedItems) {
      if (item.type === "scrap") {
        const scrap = await this.repo.getByPath(item.scrapPath);
        if (!scrap) continue;

        let text = `## ${scrap.title}`;
        if (scrap.description) {
          text += `\n\n${scrap.description}`;
        }
        for (const entry of scrap.entries) {
          text += `\n\n### ${entry.timestamp}\n\n${entry.body}`;
        }
        parts.push(text);
      } else {
        // type === "entry"
        const scrap = await this.repo.getByPath(item.scrapPath);
        if (!scrap || !item.entryTimestamp) continue;

        const entry = scrap.entries.find((e) => e.timestamp === item.entryTimestamp);
        if (!entry) continue;

        const text = `## ${scrap.title} > ${item.entryTimestamp}\n\n${entry.body}`;
        parts.push(text);
      }
    }

    const title = `# ${this.collection.title}`;
    const body = parts.join("\n\n---\n\n");
    const fullText = body ? `${title}\n\n${body}` : title;

    await navigator.clipboard.writeText(fullText);
    new Notice("コレクションをコピーしました");
  }
}
