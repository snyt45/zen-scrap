import { ItemView, WorkspaceLeaf } from "obsidian";
import { Scrap } from "../data/types";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { MarkdownRenderer } from "./detail/markdown-renderer";
import { renderHeader, HeaderDeps } from "./detail/header-renderer";
import { renderTimeline, renderClosedBanner, TimelineDeps } from "./detail/timeline-renderer";
import { renderInputArea, InputAreaDeps } from "./detail/input-area-renderer";
import type { ZenScrapSettings } from "../settings";
import { CleanupManager } from "../ui/cleanup-manager";


export const VIEW_TYPE_SCRAP_DETAIL = "zen-scrap-detail";

export class ScrapDetailView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private settings: ZenScrapSettings;
  private scrap: Scrap | undefined;
  private isFullWidth = false;
  private filterMarked = false;
  private ignoreChangeCount = 0;
  private cleanupManager = new CleanupManager();
  private markdownRenderer: MarkdownRenderer;
  private onScrapChangedHandler: () => void;

  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, eventBus: EventBus, settings: ZenScrapSettings) {
    super(leaf);
    this.repo = repo;
    this.eventBus = eventBus;
    this.settings = settings;
    this.markdownRenderer = new MarkdownRenderer(this.app);
    this.onScrapChangedHandler = async () => {
      if (this.ignoreChangeCount > 0) {
        this.ignoreChangeCount--;
        return;
      }
      if (!this.scrap) return;
      const updated = await this.repo.getByPath(this.scrap.filePath);
      if (updated) {
        this.scrap = updated;
        await this.render();
      }
    };
  }

  getViewType(): string {
    return VIEW_TYPE_SCRAP_DETAIL;
  }

  getDisplayText(): string {
    return this.scrap?.title || "Zen Scrap";
  }

  async setState(state: { filePath?: string; scrollToEntryIndex?: number }, result: any): Promise<void> {
    if (state.filePath) {
      const found = await this.repo.getByPath(state.filePath);
      if (found) {
        this.scrap = found;
        await this.render();

        if (state.scrollToEntryIndex != null) {
          const container = this.containerEl.children[1] as HTMLElement;
          const entries = container.querySelectorAll<HTMLElement>(".zen-scrap-entry");
          const target = entries[state.scrollToEntryIndex];
          if (target) {
            setTimeout(() => {
              target.scrollIntoView({ behavior: "smooth", block: "start" });
              target.addClass("zen-scrap-entry-highlight");
              setTimeout(() => target.removeClass("zen-scrap-entry-highlight"), 1500);
            }, 100);
          }
        }
      }
    }
    await super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    return { filePath: this.scrap?.filePath };
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
    if (!this.scrap) return;
    container.addClass("zen-scrap-detail-container");
    container.toggleClass("zen-scrap-fullwidth", this.isFullWidth);

    const render = () => {
      this.ignoreChangeCount = 2;
      return this.render();
    };
    const scrap = this.scrap;

    const headerDeps: HeaderDeps = {
      scrap,
      repo: this.repo,
      eventBus: this.eventBus,
      app: this.app,
      markdownRenderer: this.markdownRenderer,
      isFullWidth: this.isFullWidth,
      setFullWidth: (v) => { this.isFullWidth = v; },
      containerEl: container,
      render,
      openFile: (path) => this.app.workspace.openLinkText(path, "", true),
      addDocumentClickHandler: (h) => this.cleanupManager.registerDocumentClick(h),
      filterMarked: this.filterMarked,
      setFilterMarked: (v: boolean) => { this.filterMarked = v; },
      scrollToEntry: (index) => {
        const entries = container.querySelectorAll<HTMLElement>(".zen-scrap-entry");
        if (entries[index]) {
          entries[index].scrollIntoView({ behavior: "smooth", block: "start" });
        }
      },
    };
    renderHeader(container, headerDeps);

    const inputAreaDeps: InputAreaDeps = {
      scrap,
      repo: this.repo,
      app: this.app,
      settings: this.settings,
      scope: this.scope,
      markdownRenderer: this.markdownRenderer,
      render,
      addDocumentClickHandler: (h) => this.cleanupManager.registerDocumentClick(h),
      setScrap: (s) => { this.scrap = s; },
    };

    const timelineDeps: TimelineDeps = {
      scrap,
      repo: this.repo,
      render,
      markdownRenderer: this.markdownRenderer,
      addDocumentClickHandler: (h) => this.cleanupManager.registerDocumentClick(h),
      entryEditorDeps: inputAreaDeps,
      filterMarked: this.filterMarked,
      setFilterMarked: (v: boolean) => { this.filterMarked = v; },
    };
    await renderTimeline(container, timelineDeps);

    if (scrap.status === "closed" || scrap.archived) {
      renderClosedBanner(container, scrap);
    }
    renderInputArea(container, inputAreaDeps);
  }
}
