import { ItemView, WorkspaceLeaf } from "obsidian";
import { Scrap } from "../data/types";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { MarkdownRenderer } from "./detail/markdown-renderer";
import { renderHeader, HeaderDeps } from "./detail/header-renderer";
import { renderTimeline, renderClosedBanner, TimelineDeps } from "./detail/timeline-renderer";
import { renderInputArea, InputAreaDeps } from "./detail/input-area-renderer";
import type { ZenScrapSettings } from "../settings";

export const VIEW_TYPE_SCRAP_DETAIL = "zen-scrap-detail";

export class ScrapDetailView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private settings: ZenScrapSettings;
  private scrap: Scrap | undefined;
  private isFullWidth = false;
  private documentClickHandlers: (() => void)[] = [];
  private markdownRenderer: MarkdownRenderer;

  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, eventBus: EventBus, settings: ZenScrapSettings) {
    super(leaf);
    this.repo = repo;
    this.eventBus = eventBus;
    this.settings = settings;
    this.markdownRenderer = new MarkdownRenderer(this.app);
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
    await this.render();
  }

  async onClose(): Promise<void> {
    this.cleanupDocumentListeners();
  }

  private cleanupDocumentListeners(): void {
    for (const handler of this.documentClickHandlers) {
      document.removeEventListener("click", handler);
    }
    this.documentClickHandlers = [];
  }

  private addDocumentClickHandler = (handler: () => void): void => {
    document.addEventListener("click", handler);
    this.documentClickHandlers.push(handler);
  };

  async render(): Promise<void> {
    this.cleanupDocumentListeners();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    if (!this.scrap) return;
    container.addClass("zen-scrap-detail-container");
    if (this.isFullWidth) container.addClass("zen-scrap-fullwidth");

    const render = () => this.render();
    const scrap = this.scrap;

    const headerDeps: HeaderDeps = {
      scrap,
      repo: this.repo,
      eventBus: this.eventBus,
      isFullWidth: this.isFullWidth,
      setFullWidth: (v) => { this.isFullWidth = v; },
      containerEl: container,
      render,
      openFile: (path) => this.app.workspace.openLinkText(path, "", true),
      addDocumentClickHandler: this.addDocumentClickHandler,
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
      addDocumentClickHandler: this.addDocumentClickHandler,
      setScrap: (s) => { this.scrap = s; },
    };

    const timelineDeps: TimelineDeps = {
      scrap,
      repo: this.repo,
      render,
      markdownRenderer: this.markdownRenderer,
      addDocumentClickHandler: this.addDocumentClickHandler,
      entryEditorDeps: inputAreaDeps,
    };
    await renderTimeline(container, timelineDeps);

    if (scrap.status === "closed") {
      renderClosedBanner(container, scrap);
    }
    renderInputArea(container, inputAreaDeps);
  }
}
