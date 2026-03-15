import { ItemView, WorkspaceLeaf } from "obsidian";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { ZenScrapSettings } from "../settings";
import { renderDropdown } from "./list/toolbar-renderer";
import { renderTabNav } from "./shared/tab-nav-renderer";
import { renderListItem } from "./list/list-item-renderer";
import { CleanupManager } from "../ui/cleanup-manager";

export const VIEW_TYPE_SCRAP_LIST = "zen-scrap-list";

export class ScrapListView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private settings: ZenScrapSettings;
  private filter: "all" | "open" | "closed" | "archived" = "open";
  private sort: "created" | "updated" = "created";
  private searchQuery = "";
  private filterTag = "";
  private onScrapChangedHandler: () => void;
  private cleanupManager = new CleanupManager();

  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, eventBus: EventBus, settings: ZenScrapSettings) {
    super(leaf);
    this.repo = repo;
    this.eventBus = eventBus;
    this.settings = settings;
    this.onScrapChangedHandler = () => this.render();
  }

  getViewType(): string {
    return VIEW_TYPE_SCRAP_LIST;
  }

  getDisplayText(): string {
    return "Zen Scrap";
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    this.eventBus.on(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
    this.cleanupManager.cleanup();
  }

  async render(): Promise<void> {
    this.cleanupManager.cleanup();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-list-container");

    this.renderHeader(container);
    this.renderSearch(container);
    this.renderToolbar(container);
    this.renderFilterTag(container);
    await this.renderList(container);
  }

  private renderHeader(container: HTMLElement): void {
    renderTabNav(container, {
      eventBus: this.eventBus,
      activeTab: "list",
      onNewScrap: () => this.eventBus.emit(EVENTS.SCRAP_CREATE_REQUEST),
    });
  }

  private renderSearch(container: HTMLElement): void {
    const input = container.createEl("input", {
      cls: "zen-scrap-search",
      type: "text",
      placeholder: "スクラップを検索...",
    });
    input.value = this.searchQuery;
    let composing = false;
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => {
      composing = false;
      this.searchQuery = input.value;
      this.rerenderList();
    });
    input.addEventListener("input", () => {
      if (composing) return;
      this.searchQuery = input.value;
      this.rerenderList();
    });
  }

  private async rerenderList(): Promise<void> {
    const existing = this.containerEl.querySelector(".zen-scrap-list");
    if (existing) existing.remove();
    const container = this.containerEl.children[1] as HTMLElement;
    await this.renderList(container);
  }

  private renderFilterTag(container: HTMLElement): void {
    if (!this.filterTag) return;
    const pill = container.createDiv({ cls: "zen-scrap-filter-tag", text: `\u00d7 ${this.filterTag}` });
    pill.addEventListener("click", () => {
      this.filterTag = "";
      this.render();
    });
  }

  private renderToolbar(container: HTMLElement): void {
    const toolbar = container.createDiv({ cls: "zen-scrap-toolbar" });

    renderDropdown(toolbar, "公開状態", "open", [
      { value: "all", label: "All" },
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
      { value: "archived", label: "Archived" },
    ], this.filter, (v) => { this.filter = v as typeof this.filter; this.render(); }, (h: () => void) => this.cleanupManager.registerDocumentClick(h));

    renderDropdown(toolbar, "並び替え", "created", [
      { value: "created", label: "作成日が新しい順" },
      { value: "updated", label: "更新日が新しい順" },
    ], this.sort, (v) => { this.sort = v as typeof this.sort; this.render(); }, (h: () => void) => this.cleanupManager.registerDocumentClick(h));
  }

  private async renderList(container: HTMLElement): Promise<void> {
    const scraps = await this.repo.listAll();

    // フィルタリング
    let filtered = scraps.filter((s) => {
      if (this.filter === "all") return !s.archived;
      if (this.filter === "archived") return s.archived;
      return s.status === this.filter && !s.archived;
    });

    // タグフィルタ
    if (this.filterTag) {
      filtered = filtered.filter((s) => s.tags.includes(this.filterTag));
    }

    // 全文検索
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        if (s.title.toLowerCase().includes(q)) return true;
        return s.entries.some((e) => e.body.toLowerCase().includes(q));
      });
    }

    // 並び替え（ピン留めを上部に表示）
    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (this.sort === "created") {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      }
      return new Date(b.updated).getTime() - new Date(a.updated).getTime();
    });

    const list = container.createDiv({ cls: "zen-scrap-list" });

    if (filtered.length === 0) {
      list.createDiv({ cls: "zen-scrap-empty", text: "スクラップがありません" });
      return;
    }

    const deps = {
      repo: this.repo,
      eventBus: this.eventBus,
      staleDays: this.settings.staleDays,
      onTagClick: (tag: string) => {
        this.filterTag = tag;
        this.render();
      },
    };
    for (const scrap of filtered) {
      renderListItem(list, scrap, deps);
    }

    // 外側クリックでメニュー閉じる
    const closeMenus = () => {
      list.querySelectorAll<HTMLElement>(".zen-scrap-item-menu-dropdown").forEach((m) => {
        m.classList.remove("is-open");
      });
    };
    this.cleanupManager.registerDocumentClick(closeMenus);
  }
}
