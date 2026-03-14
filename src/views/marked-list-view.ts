import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { Scrap, ScrapEntry } from "../data/types";
import { COPY_ICON, BOOKMARK_FILLED_ICON } from "../icons";
import { renderTabNav } from "./shared/tab-nav-renderer";
import { CleanupManager } from "../ui/cleanup-manager";

export const VIEW_TYPE_MARKED_LIST = "zen-scrap-marked-list";

interface MarkedSection {
  scrap: Scrap;
  entry: ScrapEntry;
  entryIndex: number;
}

export class MarkedListView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private onScrapChangedHandler: () => void;
  private cleanupManager = new CleanupManager();
  private selectedIndices = new Set<number>();
  private lastClickedIndex = -1;
  private searchQuery = "";

  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, eventBus: EventBus) {
    super(leaf);
    this.repo = repo;
    this.eventBus = eventBus;
    this.onScrapChangedHandler = () => this.render();
  }

  getViewType(): string {
    return VIEW_TYPE_MARKED_LIST;
  }

  getDisplayText(): string {
    return "マーク一覧";
  }

  getIcon(): string {
    return "bookmark";
  }

  async onOpen(): Promise<void> {
    this.eventBus.on(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
    this.cleanupManager.cleanup();
  }

  private async collectMarkedSections(): Promise<MarkedSection[]> {
    const scraps = await this.repo.listAll();
    const sections: MarkedSection[] = [];
    for (const scrap of scraps) {
      for (let i = 0; i < scrap.entries.length; i++) {
        if (scrap.entries[i].marked) {
          sections.push({ scrap, entry: scrap.entries[i], entryIndex: i });
        }
      }
    }
    sections.sort((a, b) => new Date(b.scrap.updated).getTime() - new Date(a.scrap.updated).getTime());
    return sections;
  }

  async render(): Promise<void> {
    this.cleanupManager.cleanup();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-marked-list-container");

    renderTabNav(container, {
      eventBus: this.eventBus,
      activeTab: "marked",
    });

    // 検索バー
    const searchInput = container.createEl("input", {
      cls: "zen-scrap-search",
      type: "text",
      placeholder: "マーク済みセクションを検索...",
    });
    searchInput.value = this.searchQuery;
    let composing = false;
    searchInput.addEventListener("compositionstart", () => { composing = true; });
    searchInput.addEventListener("compositionend", () => {
      composing = false;
      this.searchQuery = searchInput.value;
      this.rerenderList();
    });
    searchInput.addEventListener("input", () => {
      if (composing) return;
      this.searchQuery = searchInput.value;
      this.rerenderList();
    });

    await this.renderListContent(container);
  }

  private async rerenderList(): Promise<void> {
    const existing = this.containerEl.querySelector(".zen-scrap-marked-list");
    const existingToolbar = this.containerEl.querySelector(".zen-scrap-marked-toolbar");
    const existingEmpty = this.containerEl.querySelector(".zen-scrap-empty");
    if (existing) existing.remove();
    if (existingToolbar) existingToolbar.remove();
    if (existingEmpty) existingEmpty.remove();
    const container = this.containerEl.children[1] as HTMLElement;
    await this.renderListContent(container);
  }

  private async renderListContent(container: HTMLElement): Promise<void> {
    let sections = await this.collectMarkedSections();

    // 検索フィルタ
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      sections = sections.filter(s =>
        s.entry.body.toLowerCase().includes(q) ||
        s.scrap.title.toLowerCase().includes(q)
      );
    }

    if (sections.length === 0) {
      container.createDiv({ cls: "zen-scrap-empty", text: "マークされたセクションがありません" });
      return;
    }

    // まとめてコピーボタン
    const toolbar = container.createDiv({ cls: "zen-scrap-marked-toolbar" });
    const bulkCopyBtn = toolbar.createEl("button", {
      text: "選択中をまとめてコピー",
      cls: "zen-scrap-bulk-copy-btn",
    });
    bulkCopyBtn.style.display = "none";

    const updateBulkBtn = () => {
      if (this.selectedIndices.size > 0) {
        bulkCopyBtn.style.display = "";
        bulkCopyBtn.setText(`選択中(${this.selectedIndices.size}件)をまとめてコピー`);
      } else {
        bulkCopyBtn.style.display = "none";
      }
    };

    bulkCopyBtn.addEventListener("click", async () => {
      const selectedBodies = sections
        .filter((_, i) => this.selectedIndices.has(i))
        .map(s => s.entry.body)
        .join("\n\n---\n\n");
      await navigator.clipboard.writeText(selectedBodies);
      new Notice(`${this.selectedIndices.size}件のセクションをコピーしました`);
    });

    const list = container.createDiv({ cls: "zen-scrap-marked-list" });

    const updateItemStyles = () => {
      const items = list.querySelectorAll<HTMLElement>(".zen-scrap-marked-item");
      items.forEach((el, idx) => {
        el.toggleClass("is-selected", this.selectedIndices.has(idx));
      });
    };

    sections.forEach((section, sectionIdx) => {
      const item = list.createDiv({
        cls: `zen-scrap-marked-item${this.selectedIndices.has(sectionIdx) ? " is-selected" : ""}`,
      });

      const content = item.createDiv({ cls: "zen-scrap-marked-content" });

      const meta = content.createDiv({ cls: "zen-scrap-marked-meta" });
      meta.createSpan({ text: section.scrap.title, cls: "zen-scrap-marked-source" });
      meta.createSpan({ text: section.entry.timestamp, cls: "zen-scrap-marked-time" });

      const stripped = section.entry.body
        .replace(/[#*`>\-\[\]()!]/g, "")
        .replace(/\n/g, " ")
        .trim();
      const preview = stripped.slice(0, 120) + (stripped.length > 120 ? "..." : "");
      content.createDiv({ text: preview, cls: "zen-scrap-marked-preview" });

      // ツールチップ
      const tooltipText = section.entry.body.trim().slice(0, 300);
      const tooltip = item.createDiv({ cls: "zen-scrap-marked-tooltip" });
      tooltip.setText(tooltipText);
      content.addEventListener("mouseenter", () => {
        tooltip.style.display = "block";
      });
      content.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });

      const actions = item.createDiv({ cls: "zen-scrap-marked-actions" });

      const unmarkBtn = actions.createEl("button", { cls: "zen-scrap-marked-unmark-btn" });
      unmarkBtn.innerHTML = `<span class="zen-scrap-unmark-x">×</span>`;
      unmarkBtn.setAttribute("aria-label", "マーク解除");
      unmarkBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        section.entry.marked = false;
        section.scrap.updated = new Date().toISOString();
        await this.repo.save(section.scrap);
        this.selectedIndices.clear();
        await this.render();
      });

      const copyBtn = actions.createEl("button", { cls: "zen-scrap-marked-copy-btn" });
      copyBtn.innerHTML = COPY_ICON;
      copyBtn.setAttribute("aria-label", "コピー");
      copyBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(section.entry.body);
        new Notice("セクションをコピーしました");
      });

      // クリックで選択 / Cmd+Click でトグル / Shift+Click で範囲選択
      item.addEventListener("click", (e) => {
        // アクションボタンからのクリックは無視
        if ((e.target as HTMLElement).closest(".zen-scrap-marked-actions")) return;

        const metaKey = e.metaKey || e.ctrlKey;

        if (e.shiftKey && this.lastClickedIndex >= 0) {
          // Shift+Click: 範囲選択
          const from = Math.min(this.lastClickedIndex, sectionIdx);
          const to = Math.max(this.lastClickedIndex, sectionIdx);
          if (!metaKey) this.selectedIndices.clear();
          for (let j = from; j <= to; j++) {
            this.selectedIndices.add(j);
          }
        } else if (metaKey) {
          // Cmd/Ctrl+Click: トグル
          if (this.selectedIndices.has(sectionIdx)) {
            this.selectedIndices.delete(sectionIdx);
          } else {
            this.selectedIndices.add(sectionIdx);
          }
          this.lastClickedIndex = sectionIdx;
        } else {
          // 通常クリック: セクションに遷移
          this.eventBus.emit(EVENTS.SCRAP_SELECT, section.scrap, section.entryIndex);
          return;
        }

        updateItemStyles();
        updateBulkBtn();
      });
    });
  }
}
