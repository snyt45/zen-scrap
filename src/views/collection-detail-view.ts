import { ItemView, WorkspaceLeaf } from "obsidian";
import { CollectionRepository } from "../data/collection-repository";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";

export const VIEW_TYPE_COLLECTION_DETAIL = "zen-scrap-collection-detail";

export class CollectionDetailView extends ItemView {
  private collectionRepo: CollectionRepository;
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private collectionId: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    collectionRepo: CollectionRepository,
    repo: ScrapRepository,
    eventBus: EventBus
  ) {
    super(leaf);
    this.collectionRepo = collectionRepo;
    this.repo = repo;
    this.eventBus = eventBus;
  }

  getViewType(): string {
    return VIEW_TYPE_COLLECTION_DETAIL;
  }

  getDisplayText(): string {
    return "コレクション詳細";
  }

  getIcon(): string {
    return "folder";
  }

  async setState(state: Record<string, unknown>): Promise<void> {
    if (state.collectionId && typeof state.collectionId === "string") {
      this.collectionId = state.collectionId;
    }
    await this.render();
  }

  getState(): Record<string, unknown> {
    return { collectionId: this.collectionId };
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.createDiv({ text: "Collection Detail", cls: "zen-scrap-collection-detail-stub" });
  }
}
