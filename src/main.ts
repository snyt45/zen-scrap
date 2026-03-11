import { Plugin } from "obsidian";
import { ScrapRepository } from "./data/scrap-repository";
import { ScrapListView, VIEW_TYPE_SCRAP_LIST } from "./views/scrap-list-view";
import { ScrapDetailView, VIEW_TYPE_SCRAP_DETAIL } from "./views/scrap-detail-view";
import { Scrap } from "./data/types";
import { EventBus } from "./events/event-bus";
import { registerScrapHandlers } from "./events/scrap-handlers";
import { registerNavHandlers } from "./events/nav-handlers";

export default class ZenScrapPlugin extends Plugin {
  private repo!: ScrapRepository;
  private eventBus!: EventBus;

  async onload() {
    this.repo = new ScrapRepository(this.app);
    this.eventBus = new EventBus();

    this.registerView(VIEW_TYPE_SCRAP_LIST, (leaf) =>
      new ScrapListView(leaf, this.repo, this.eventBus)
    );

    this.registerView(VIEW_TYPE_SCRAP_DETAIL, (leaf) =>
      new ScrapDetailView(leaf, this.repo, this.eventBus)
    );

    registerScrapHandlers(this.eventBus, this.app, this.repo, (scrap) => this.openScrap(scrap));
    registerNavHandlers(this.eventBus, () => this.activateListView());

    this.addRibbonIcon("message-square", "Zen Scrap", () => {
      this.activateListView();
    });

    this.addCommand({
      id: "open-zen-scrap",
      name: "Open Zen Scrap",
      callback: () => this.activateListView(),
    });

  }

  async activateListView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_SCRAP_LIST)[0];
    if (!leaf) {
      const newLeaf = workspace.getLeaf(true);
      if (newLeaf) {
        await newLeaf.setViewState({ type: VIEW_TYPE_SCRAP_LIST, active: true });
        leaf = newLeaf;
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async openScrap(scrap: Scrap) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_SCRAP_DETAIL)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true)!;
    }
    await leaf.setViewState({
      type: VIEW_TYPE_SCRAP_DETAIL,
      active: true,
      state: { filePath: scrap.filePath },
    });
    workspace.revealLeaf(leaf);
  }

  async onunload() {}
}
