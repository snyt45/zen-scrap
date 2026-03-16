import { ItemView, WorkspaceLeaf } from "obsidian";
import { ScrapRepository } from "../data/scrap-repository";
import { InboxRepository } from "../data/inbox-repository";
import { InboxItem } from "../data/inbox-types";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { Scrap, ScrapEntry } from "../data/types";
import { stripMarkdown } from "../utils";
import { renderTabNav } from "./shared/tab-nav-renderer";
import { CleanupManager } from "../ui/cleanup-manager";

export const VIEW_TYPE_INBOX_LIST = "zen-scrap-inbox-list";

interface InboxSection {
  item: InboxItem;
  scrap: Scrap;
  entry: ScrapEntry;
  entryIndex: number;
}

export class InboxListView extends ItemView {
  private scrapRepo: ScrapRepository;
  private inboxRepo: InboxRepository;
  private eventBus: EventBus;
  private onChangedHandler: () => void;
  private cleanupManager = new CleanupManager();

  constructor(
    leaf: WorkspaceLeaf,
    scrapRepo: ScrapRepository,
    inboxRepo: InboxRepository,
    eventBus: EventBus
  ) {
    super(leaf);
    this.scrapRepo = scrapRepo;
    this.inboxRepo = inboxRepo;
    this.eventBus = eventBus;
    this.onChangedHandler = () => this.render();
  }

  getViewType(): string {
    return VIEW_TYPE_INBOX_LIST;
  }

  getDisplayText(): string {
    return "Inbox";
  }

  getIcon(): string {
    return "inbox";
  }

  async onOpen(): Promise<void> {
    this.eventBus.on(EVENTS.SCRAP_CHANGED, this.onChangedHandler);
    this.eventBus.on(EVENTS.INBOX_CHANGED, this.onChangedHandler);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onChangedHandler);
    this.eventBus.off(EVENTS.INBOX_CHANGED, this.onChangedHandler);
    this.cleanupManager.cleanup();
  }

  private async collectSections(): Promise<InboxSection[]> {
    const items = await this.inboxRepo.listAll();
    const scraps = await this.scrapRepo.listAll();
    const scrapMap = new Map(scraps.map((s) => [s.filePath, s]));

    const sections: InboxSection[] = [];
    for (const item of items) {
      const scrap = scrapMap.get(item.scrapPath);
      if (!scrap) continue;
      const entryIndex = scrap.entries.findIndex(
        (e) => e.timestamp === item.entryTimestamp
      );
      if (entryIndex === -1) continue;
      sections.push({
        item,
        scrap,
        entry: scrap.entries[entryIndex],
        entryIndex,
      });
    }

    // addedAt降順（新しいものが上）
    sections.sort(
      (a, b) =>
        new Date(b.item.addedAt).getTime() - new Date(a.item.addedAt).getTime()
    );
    return sections;
  }

  async render(): Promise<void> {
    this.cleanupManager.cleanup();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-inbox-list-container");

    const inboxCount = await this.inboxRepo.count();
    renderTabNav(container, {
      eventBus: this.eventBus,
      activeTab: "inbox",
      inboxCount,
    });

    await this.renderListContent(container);
  }

  private async renderListContent(container: HTMLElement): Promise<void> {
    const sections = await this.collectSections();

    if (sections.length === 0) {
      container.createDiv({
        cls: "zen-scrap-empty",
        text: "Inboxは空です",
      });
      return;
    }

    const list = container.createDiv({ cls: "zen-scrap-inbox-list" });

    for (const section of sections) {
      const item = list.createDiv({ cls: "zen-scrap-inbox-item" });

      // チェックボックス
      const checkbox = item.createEl("input", {
        type: "checkbox",
        cls: "zen-scrap-inbox-checkbox",
      });
      checkbox.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.inboxRepo.remove(
          section.item.scrapPath,
          section.item.entryTimestamp
        );
        this.eventBus.emit(EVENTS.INBOX_CHANGED);
      });

      const content = item.createDiv({ cls: "zen-scrap-inbox-content" });

      const preview = stripMarkdown(section.entry.body, 120);
      content.createDiv({ text: preview, cls: "zen-scrap-inbox-preview" });

      const meta = content.createDiv({ cls: "zen-scrap-inbox-meta" });
      meta.createSpan({
        text: section.scrap.title,
        cls: "zen-scrap-inbox-source",
      });
      meta.createSpan({ text: "·" });
      meta.createSpan({
        text: this.formatRelativeTime(section.item.addedAt),
        cls: "zen-scrap-inbox-time",
      });

      // クリックでスクラップ詳細に遷移
      content.addEventListener("click", () => {
        this.eventBus.emit(
          EVENTS.SCRAP_SELECT,
          section.scrap,
          section.entryIndex
        );
      });
    }
  }

  private formatRelativeTime(isoString: string): string {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diff = now - then;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "たった今";
    if (minutes < 60) return `${minutes}分前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}時間前`;
    const days = Math.floor(hours / 24);
    return `${days}日前`;
  }
}
