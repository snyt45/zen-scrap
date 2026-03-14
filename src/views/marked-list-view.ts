import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { Scrap, ScrapEntry } from "../data/types";
import { chevronLeftIcon, BOOKMARK_FILLED_ICON, COPY_ICON } from "../icons";
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

    const header = container.createDiv({ cls: "zen-scrap-marked-list-header" });
    const navRow = header.createDiv({ cls: "zen-scrap-detail-nav" });

    const backBtn = navRow.createEl("button", { cls: "zen-scrap-back-btn" });
    backBtn.innerHTML = `${chevronLeftIcon(14)} 一覧へ戻る`;
    backBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.NAV_BACK_TO_LIST));

    header.createEl("h2", { text: "マーク一覧" });

    const sections = await this.collectMarkedSections();

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

    sections.forEach((section, sectionIdx) => {
      const item = list.createDiv({ cls: "zen-scrap-marked-item" });

      const checkbox = item.createEl("input", { type: "checkbox" });
      checkbox.addClass("zen-scrap-marked-checkbox");
      checkbox.checked = this.selectedIndices.has(sectionIdx);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          this.selectedIndices.add(sectionIdx);
        } else {
          this.selectedIndices.delete(sectionIdx);
        }
        updateBulkBtn();
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

      const actions = item.createDiv({ cls: "zen-scrap-marked-actions" });

      const copyBtn = actions.createEl("button", { cls: "zen-scrap-marked-copy-btn" });
      copyBtn.innerHTML = COPY_ICON;
      copyBtn.setAttribute("aria-label", "コピー");
      copyBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(section.entry.body);
        new Notice("セクションをコピーしました");
      });

      content.addEventListener("click", () => {
        this.eventBus.emit(EVENTS.SCRAP_SELECT, section.scrap);
      });
    });
  }
}
