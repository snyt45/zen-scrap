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
import { createMinimap, toggleMinimap, showMinimap, destroyMinimap } from "../ui/minimap-renderer";

export const VIEW_TYPE_SCRAP_DETAIL = "zen-scrap-detail";

export class ScrapDetailView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private settings: ZenScrapSettings;
  private scrap: Scrap | undefined;
  private isFullWidth = false;
  private ignoreChangeCount = 0;
  private cleanupManager = new CleanupManager();
  private markdownRenderer: MarkdownRenderer;
  private minimapState: ReturnType<typeof createMinimap> | null = null;
  private isMinimapVisible = false;
  private minimapKeyHandler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "m") {
      e.preventDefault();
      this.isMinimapVisible = !this.isMinimapVisible;
      if (this.minimapState) toggleMinimap(this.minimapState);
    }
  };
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

  async setState(state: { filePath?: string }, result: any): Promise<void> {
    if (state.filePath) {
      const found = await this.repo.getByPath(state.filePath);
      if (found) {
        this.scrap = found;
        await this.render();
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
    this.containerEl.addEventListener("keydown", this.minimapKeyHandler);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
    this.containerEl.removeEventListener("keydown", this.minimapKeyHandler);
    if (this.minimapState) destroyMinimap(this.minimapState);
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
      onToggleMinimap: () => {
        this.isMinimapVisible = !this.isMinimapVisible;
        if (this.minimapState) toggleMinimap(this.minimapState);
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
    };
    await renderTimeline(container, timelineDeps);

    const timelineEl = container.querySelector<HTMLElement>(".zen-scrap-timeline");
    if (timelineEl) {
      if (this.minimapState) destroyMinimap(this.minimapState);
      this.minimapState = createMinimap(container, timelineEl, container);
      if (this.isMinimapVisible) {
        showMinimap(this.minimapState);
      }
    }

    if (scrap.status === "closed" || scrap.archived) {
      renderClosedBanner(container, scrap);
    }
    renderInputArea(container, inputAreaDeps);
  }
}
