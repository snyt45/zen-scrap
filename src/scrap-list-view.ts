import { ItemView, WorkspaceLeaf } from "obsidian";
import { Scrap } from "./types";
import { ScrapRepository } from "./scrap-repository";

export const VIEW_TYPE_SCRAP_LIST = "zen-scrap-list";

export class ScrapListView extends ItemView {
  private repo: ScrapRepository;
  private filter: "open" | "closed" | "all" = "open";
  private onScrapSelect: (scrap: Scrap) => void;
  private onCreateNew: () => void;

  constructor(
    leaf: WorkspaceLeaf,
    repo: ScrapRepository,
    onScrapSelect: (scrap: Scrap) => void,
    onCreateNew: () => void
  ) {
    super(leaf);
    this.repo = repo;
    this.onScrapSelect = onScrapSelect;
    this.onCreateNew = onCreateNew;
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
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-list-container");

    this.renderHeader(container);
    await this.renderList(container);
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "zen-scrap-list-header" });
    header.createEl("h2", { text: "Zen Scrap" });

    const controls = header.createDiv({ cls: "zen-scrap-list-controls" });

    // フィルタ
    const filterSelect = controls.createEl("select", { cls: "zen-scrap-filter" });
    for (const opt of ["open", "closed", "all"] as const) {
      const optEl = filterSelect.createEl("option", { text: opt, value: opt });
      if (opt === this.filter) optEl.selected = true;
    }
    filterSelect.addEventListener("change", () => {
      this.filter = filterSelect.value as "open" | "closed" | "all";
      this.render();
    });

    // 新規ボタン
    const newBtn = controls.createEl("button", { text: "+ 新規", cls: "zen-scrap-new-btn" });
    newBtn.addEventListener("click", () => this.onCreateNew());
  }

  private async renderList(container: HTMLElement): Promise<void> {
    const scraps = await this.repo.listAll();
    const filtered = scraps.filter((s) => {
      if (s.archived) return false;
      if (this.filter === "all") return true;
      return s.status === this.filter;
    });

    const list = container.createDiv({ cls: "zen-scrap-list" });

    if (filtered.length === 0) {
      list.createDiv({ cls: "zen-scrap-empty", text: "スクラップがありません" });
      return;
    }

    for (const scrap of filtered) {
      const item = list.createDiv({ cls: "zen-scrap-list-item" });
      item.addEventListener("click", () => this.onScrapSelect(scrap));

      const titleRow = item.createDiv({ cls: "zen-scrap-item-title-row" });
      const statusIcon = scrap.status === "open" ? "●" : "○";
      titleRow.createSpan({ text: `${statusIcon} ${scrap.title}`, cls: "zen-scrap-item-title" });
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
