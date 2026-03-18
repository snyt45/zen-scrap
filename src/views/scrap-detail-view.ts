import { ItemView, WorkspaceLeaf } from "obsidian";
import { Scrap } from "../data/types";
import { ScrapRepository } from "../data/scrap-repository";
import { CollectionRepository } from "../data/collection-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { MarkdownRenderer } from "./detail/markdown-renderer";
import { renderHeader, HeaderDeps } from "./detail/header-renderer";
import { renderTimeline, renderClosedBanner, TimelineDeps } from "./detail/timeline-renderer";
import { renderInputArea, InputAreaDeps } from "./detail/input-area-renderer";
import type { ZenScrapSettings } from "../settings";
import { CleanupManager } from "../ui/cleanup-manager";
import { InboxRepository } from "../data/inbox-repository";


export const VIEW_TYPE_SCRAP_DETAIL = "zen-scrap-detail";

export class ScrapDetailView extends ItemView {
  private repo: ScrapRepository;
  private collectionRepo: CollectionRepository;
  private inboxRepo: InboxRepository;
  private eventBus: EventBus;
  private settings: ZenScrapSettings;
  private scrap: Scrap | undefined;
  private ignoreChangeCount = 0;
  private settingState = false;
  private cleanupManager = new CleanupManager();
  private markdownRenderer: MarkdownRenderer;
  private onScrapChangedHandler: () => void;

  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, collectionRepo: CollectionRepository, inboxRepo: InboxRepository, eventBus: EventBus, settings: ZenScrapSettings) {
    super(leaf);
    this.repo = repo;
    this.collectionRepo = collectionRepo;
    this.inboxRepo = inboxRepo;
    this.eventBus = eventBus;
    this.settings = settings;
    this.markdownRenderer = new MarkdownRenderer(this.app);
    this.onScrapChangedHandler = async () => {
      if (this.settingState) return;
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
    this.settingState = true;
    try {
      if (state.filePath) {
        const found = await this.repo.getByPath(state.filePath);
        if (found) {
          this.scrap = found;
          await this.render();

          if (state.scrollToEntryIndex != null) {
            const entry = found.entries[state.scrollToEntryIndex];
            if (entry) {
              const container = this.containerEl.children[1] as HTMLElement;
              this.scrollToEntryByTimestamp(container, entry.timestamp);
            }
          }
        }
      }
      await super.setState(state, result);
    } finally {
      this.settingState = false;
    }
  }

  private scrollToEntryByTimestamp(container: HTMLElement, timestamp: string): void {
    setTimeout(() => {
      const entryEls = Array.from(container.querySelectorAll<HTMLElement>(".zen-scrap-entry"));
      for (const el of entryEls) {
        const timeEl = el.querySelector(".zen-scrap-entry-time");
        if (timeEl && timeEl.textContent === timestamp) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.addClass("zen-scrap-entry-highlight");
          setTimeout(() => el.removeClass("zen-scrap-entry-highlight"), 2000);
          break;
        }
      }
    }, 100);
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
    const render = () => {
      this.ignoreChangeCount = 2;
      return this.render();
    };
    const scrap = this.scrap;

    const inboxCount = await this.inboxRepo.count();
    const headerDeps: HeaderDeps = {
      scrap,
      repo: this.repo,
      collectionRepo: this.collectionRepo,
      eventBus: this.eventBus,
      app: this.app,
      scope: this.scope,
      markdownRenderer: this.markdownRenderer,
      containerEl: container,
      render,
      openFile: (path) => this.app.workspace.openLinkText(path, "", true),
      addDocumentClickHandler: (h) => this.cleanupManager.registerDocumentClick(h),
      inboxRepo: this.inboxRepo,
      inboxCount,
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
      collectionRepo: this.collectionRepo,
      app: this.app,
      render,
      markdownRenderer: this.markdownRenderer,
      addDocumentClickHandler: (h) => this.cleanupManager.registerDocumentClick(h),
      entryEditorDeps: inputAreaDeps,
      inboxRepo: this.inboxRepo,
      eventBus: this.eventBus,
      ignoreNextChange: () => { this.ignoreChangeCount++; },
    };
    await renderTimeline(container, timelineDeps);

    if (scrap.status === "closed" || scrap.archived) {
      renderClosedBanner(container, scrap);
    }
    renderInputArea(container, inputAreaDeps);
  }
}
