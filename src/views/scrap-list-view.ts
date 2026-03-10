import { ItemView, WorkspaceLeaf } from "obsidian";
import { Scrap } from "../data/types";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";

export const VIEW_TYPE_SCRAP_LIST = "zen-scrap-list";

export class ScrapListView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private filter: "all" | "open" | "closed" | "archived" = "open";
  private sort: "created" | "commented" = "created";
  private searchQuery = "";
  private onScrapChangedHandler: () => void;

  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, eventBus: EventBus) {
    super(leaf);
    this.repo = repo;
    this.eventBus = eventBus;
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
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-list-container");

    this.renderHeader(container);
    this.renderSearch(container);
    this.renderToolbar(container);
    await this.renderList(container);
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "zen-scrap-list-header" });
    header.createEl("h2", { text: "Zen Scrap" });

    const newBtn = header.createEl("button", { text: "+ 新規作成", cls: "zen-scrap-new-btn" });
    newBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.SCRAP_CREATE_REQUEST));
  }

  private renderSearch(container: HTMLElement): void {
    const input = container.createEl("input", {
      cls: "zen-scrap-search",
      type: "text",
      placeholder: "タイトルやトピックで検索...",
    });
    input.value = this.searchQuery;
    input.addEventListener("input", async () => {
      this.searchQuery = input.value;
      const pos = input.selectionStart;
      await this.render();
      const el = this.containerEl.querySelector<HTMLInputElement>(".zen-scrap-search");
      if (el) {
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  }

  private renderToolbar(container: HTMLElement): void {
    const toolbar = container.createDiv({ cls: "zen-scrap-toolbar" });

    // フィルタタブ
    const tabs = toolbar.createDiv({ cls: "zen-scrap-tabs" });
    const tabDefs: { key: typeof this.filter; label: string }[] = [
      { key: "all", label: "All" },
      { key: "open", label: "Open" },
      { key: "closed", label: "Closed" },
      { key: "archived", label: "Archived" },
    ];
    for (const def of tabDefs) {
      const cls = this.filter === def.key ? "zen-scrap-tab zen-scrap-tab-active" : "zen-scrap-tab";
      const tab = tabs.createEl("button", { text: def.label, cls });
      tab.addEventListener("click", () => {
        this.filter = def.key;
        this.render();
      });
    }

    // 並び替え
    const sortSelect = toolbar.createEl("select", { cls: "zen-scrap-sort" });
    const sortOptions: { value: typeof this.sort; label: string }[] = [
      { value: "created", label: "作成日が新しい順" },
      { value: "commented", label: "コメントが新しい順" },
    ];
    for (const opt of sortOptions) {
      const optEl = sortSelect.createEl("option", { text: opt.label, value: opt.value });
      if (opt.value === this.sort) optEl.selected = true;
    }
    sortSelect.addEventListener("change", () => {
      this.sort = sortSelect.value as typeof this.sort;
      this.render();
    });
  }

  private async renderList(container: HTMLElement): Promise<void> {
    const scraps = await this.repo.listAll();

    // フィルタリング
    let filtered = scraps.filter((s) => {
      if (this.filter === "all") return !s.archived;
      if (this.filter === "archived") return s.archived;
      return s.status === this.filter && !s.archived;
    });

    // 検索フィルタ
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        const titleMatch = s.title.toLowerCase().includes(q);
        const tagsMatch = s.tags.some((t) => t.toLowerCase().includes(q));
        return titleMatch || tagsMatch;
      });
    }

    // 並び替え
    filtered.sort((a, b) => {
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

    for (const scrap of filtered) {
      const item = list.createDiv({ cls: "zen-scrap-list-item" });
      item.addEventListener("click", () => this.eventBus.emit(EVENTS.SCRAP_SELECT, scrap));

      const titleRow = item.createDiv({ cls: "zen-scrap-item-title-row" });
      const titleLeft = titleRow.createSpan();

      // ステータスラベル
      const labelCls = scrap.status === "open" ? "zen-scrap-label-open" : "zen-scrap-label-closed";
      const labelText = scrap.status === "open" ? "Open" : "Closed";
      titleLeft.createSpan({ text: labelText, cls: labelCls });

      titleLeft.createSpan({ text: scrap.title, cls: "zen-scrap-item-title" });
      titleRow.createSpan({ text: `${scrap.entries.length}件`, cls: "zen-scrap-item-count" });

      const metaRow = item.createDiv({ cls: "zen-scrap-item-meta" });
      if (scrap.tags.length > 0) {
        metaRow.createSpan({ text: scrap.tags.map((t) => `#${t}`).join(" "), cls: "zen-scrap-item-tags" });
      }
      const timeAgo = formatTimeAgo(scrap.updated);
      metaRow.createSpan({ text: timeAgo, cls: "zen-scrap-item-time" });
    }
  }
}

function formatTimeAgo(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMin = Math.floor((now - then) / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前`;
}
