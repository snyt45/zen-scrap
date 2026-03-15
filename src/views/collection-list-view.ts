import { ItemView, WorkspaceLeaf } from "obsidian";
import { CollectionRepository } from "../data/collection-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { renderTabNav } from "./shared/tab-nav-renderer";
import { chevronDownIcon } from "../icons";
import { formatDate } from "../utils";
import { CleanupManager } from "../ui/cleanup-manager";

export const VIEW_TYPE_COLLECTION_LIST = "zen-scrap-collection-list";

export class CollectionListView extends ItemView {
  private collectionRepo: CollectionRepository;
  private eventBus: EventBus;
  private onCollectionChangedHandler: () => void;
  private cleanupManager = new CleanupManager();

  constructor(leaf: WorkspaceLeaf, collectionRepo: CollectionRepository, eventBus: EventBus) {
    super(leaf);
    this.collectionRepo = collectionRepo;
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

    renderTabNav(container, {
      eventBus: this.eventBus,
      activeTab: "collection",
    });

    const newBtn = container.createEl("button", {
      text: "+ 新しいコレクション",
      cls: "zen-scrap-new-collection-btn",
    });
    newBtn.addEventListener("click", async () => {
      const title = prompt("コレクションのタイトルを入力してください");
      if (!title || !title.trim()) return;
      await this.collectionRepo.create(title.trim());
      this.eventBus.emit(EVENTS.COLLECTION_CHANGED);
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
      menuBtn.innerHTML = chevronDownIcon(14);
      const dropdown = menuWrapper.createDiv({ cls: "zen-scrap-item-menu-dropdown" });

      const deleteBtn = dropdown.createEl("button", { text: "削除", cls: "zen-scrap-menu-item is-danger" });
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
