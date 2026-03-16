import { ItemView, WorkspaceLeaf, Modal } from "obsidian";
import { CollectionRepository } from "../data/collection-repository";
import { InboxRepository } from "../data/inbox-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { renderTabNav } from "./shared/tab-nav-renderer";
import { chevronDownIcon } from "../icons";
import { formatDate } from "../utils";
import { CleanupManager } from "../ui/cleanup-manager";

export const VIEW_TYPE_COLLECTION_LIST = "zen-scrap-collection-list";

export class CollectionListView extends ItemView {
  private collectionRepo: CollectionRepository;
  private inboxRepo: InboxRepository;
  private eventBus: EventBus;
  private onCollectionChangedHandler: () => void;
  private cleanupManager = new CleanupManager();

  constructor(leaf: WorkspaceLeaf, collectionRepo: CollectionRepository, inboxRepo: InboxRepository, eventBus: EventBus) {
    super(leaf);
    this.collectionRepo = collectionRepo;
    this.inboxRepo = inboxRepo;
    this.eventBus = eventBus;
    this.onCollectionChangedHandler = () => this.render();
  }

  getViewType(): string {
    return VIEW_TYPE_COLLECTION_LIST;
  }

  getDisplayText(): string {
    return "コレクション";
  }

  getIcon(): string {
    return "folder";
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
    container.addClass("zen-scrap-collection-list-container");

    const inboxCount = await this.inboxRepo.count();
    renderTabNav(container, {
      eventBus: this.eventBus,
      activeTab: "collection",
      inboxCount,
    });

    const actionRow = container.createDiv({ cls: "zen-scrap-action-row" });
    const newBtn = actionRow.createEl("button", {
      text: "+ 新しいコレクション",
      cls: "zen-scrap-btn-primary zen-scrap-new-collection-btn",
    });
    newBtn.addEventListener("click", () => {
      const modal = new Modal(this.app);
      modal.titleEl.setText("新しいコレクション");
      const input = modal.contentEl.createEl("input", {
        type: "text",
        placeholder: "コレクション名",
        cls: "zen-scrap-title-edit-input",
      });
      input.style.width = "100%";
      input.style.marginBottom = "12px";
      const btnRow = modal.contentEl.createDiv({ cls: "zen-scrap-description-btn-row" });
      const saveBtn = btnRow.createEl("button", { text: "作成", cls: "zen-scrap-btn-primary zen-scrap-title-save-btn" });
      const cancelBtn = btnRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-btn-secondary zen-scrap-title-cancel-btn" });

      const doCreate = async () => {
        const title = input.value.trim();
        if (!title) return;
        modal.close();
        await this.collectionRepo.create(title);
        this.eventBus.emit(EVENTS.COLLECTION_CHANGED);
      };

      saveBtn.addEventListener("click", doCreate);
      cancelBtn.addEventListener("click", () => modal.close());
      input.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.isComposing) return;
        if (e.key === "Enter") { e.preventDefault(); doCreate(); }
        if (e.key === "Escape") { modal.close(); }
      });

      modal.open();
      input.focus();
    });

    const collections = await this.collectionRepo.listAll();

    if (collections.length === 0) {
      container.createDiv({ cls: "zen-scrap-empty", text: "コレクションがありません" });
      return;
    }

    const list = container.createDiv({ cls: "zen-scrap-collection-list" });

    for (const collection of collections) {
      const item = list.createDiv({ cls: "zen-scrap-collection-item" });

      const content = item.createDiv({ cls: "zen-scrap-collection-item-content" });
      content.createDiv({ text: collection.title, cls: "zen-scrap-collection-item-title" });

      const meta = content.createDiv({ cls: "zen-scrap-collection-item-meta" });
      meta.createSpan({ text: `${collection.items.length}件` });
      meta.createSpan({ text: formatDate(collection.created) });

      content.addEventListener("click", () => {
        this.eventBus.emit(EVENTS.NAV_TO_COLLECTION_DETAIL, collection.id);
      });

      const menuWrapper = item.createDiv({ cls: "zen-scrap-collection-item-menu" });
      const menuBtn = menuWrapper.createEl("button", { cls: "zen-scrap-item-menu-btn" });
      menuBtn.innerHTML = chevronDownIcon(20, 2.5);
      const dropdown = menuWrapper.createDiv({ cls: "zen-scrap-item-menu-dropdown" });

      const deleteBtn = dropdown.createDiv({ cls: "zen-scrap-dropdown-item zen-scrap-dropdown-item-danger", text: "削除する" });
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const confirmed = confirm(`「${collection.title}」を削除しますか？`);
        if (!confirmed) return;
        await this.collectionRepo.delete(collection.id);
        this.eventBus.emit(EVENTS.COLLECTION_CHANGED);
      });

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        list.querySelectorAll<HTMLElement>(".zen-scrap-item-menu-dropdown").forEach((m) => {
          if (m !== dropdown) m.classList.remove("is-open");
        });
        dropdown.classList.toggle("is-open");
      });
    }

    const closeMenus = () => {
      list.querySelectorAll<HTMLElement>(".zen-scrap-item-menu-dropdown").forEach((m) => {
        m.classList.remove("is-open");
      });
    };
    this.cleanupManager.registerDocumentClick(closeMenus);
  }
}
