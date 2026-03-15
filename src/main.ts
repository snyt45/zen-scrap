import { Plugin, TFile } from "obsidian";
import { ScrapRepository } from "./data/scrap-repository";
import { CollectionRepository } from "./data/collection-repository";
import { ScrapListView, VIEW_TYPE_SCRAP_LIST } from "./views/scrap-list-view";
import { ScrapDetailView, VIEW_TYPE_SCRAP_DETAIL } from "./views/scrap-detail-view";
import { MarkedListView, VIEW_TYPE_MARKED_LIST } from "./views/marked-list-view";
import { CollectionListView, VIEW_TYPE_COLLECTION_LIST } from "./views/collection-list-view";
import { CollectionDetailView, VIEW_TYPE_COLLECTION_DETAIL } from "./views/collection-detail-view";
import { Scrap } from "./data/types";
import { EventBus } from "./events/event-bus";
import { registerScrapHandlers } from "./events/scrap-handlers";
import { registerNavHandlers } from "./events/nav-handlers";
import { EVENTS } from "./events/constants";
import { ZenScrapSettings, DEFAULT_SETTINGS, ZenScrapSettingTab } from "./settings";

export default class ZenScrapPlugin extends Plugin {
  private repo!: ScrapRepository;
  private collectionRepo!: CollectionRepository;
  private eventBus!: EventBus;
  settings!: ZenScrapSettings;

  async onload() {
    await this.loadSettings();

    this.repo = new ScrapRepository(this.app, this.settings);
    this.collectionRepo = new CollectionRepository(this.app, this.settings);
    this.eventBus = new EventBus();

    this.registerView(VIEW_TYPE_SCRAP_LIST, (leaf) =>
      new ScrapListView(leaf, this.repo, this.collectionRepo, this.eventBus, this.settings)
    );

    this.registerView(VIEW_TYPE_SCRAP_DETAIL, (leaf) =>
      new ScrapDetailView(leaf, this.repo, this.collectionRepo, this.eventBus, this.settings)
    );

    this.registerView(VIEW_TYPE_MARKED_LIST, (leaf) =>
      new MarkedListView(leaf, this.repo, this.eventBus)
    );

    this.registerView(VIEW_TYPE_COLLECTION_LIST, (leaf) =>
      new CollectionListView(leaf, this.collectionRepo, this.eventBus)
    );

    this.registerView(VIEW_TYPE_COLLECTION_DETAIL, (leaf) =>
      new CollectionDetailView(leaf, this.collectionRepo, this.repo, this.eventBus)
    );

    registerScrapHandlers(this.eventBus, this.app, this.repo, (scrap, scrollToEntryIndex) => this.openScrap(scrap, scrollToEntryIndex));
    registerNavHandlers(
      this.eventBus,
      () => this.activateListView(),
      () => this.openMarkedList(),
      () => this.openCollectionList(),
      (id: string) => this.openCollectionDetail(id)
    );

    this.addRibbonIcon("message-square", "Zen Scrap", () => {
      this.activateListView();
    });

    this.addCommand({
      id: "open-zen-scrap",
      name: "Open Zen Scrap",
      callback: () => this.activateListView(),
    });

    this.addSettingTab(new ZenScrapSettingTab(this.app, this));

    let vaultChangeTimer: ReturnType<typeof setTimeout> | null = null;
    const emitIfScrapFile = (file: unknown) => {
      if (file instanceof TFile && file.extension === "md" && file.path.startsWith(this.settings.scrapsFolder + "/")) {
        if (vaultChangeTimer) clearTimeout(vaultChangeTimer);
        vaultChangeTimer = setTimeout(() => {
          vaultChangeTimer = null;
          this.eventBus.emit(EVENTS.SCRAP_CHANGED);
        }, 300);
      }
    };
    this.registerEvent(this.app.vault.on("modify", emitIfScrapFile));
    this.registerEvent(this.app.vault.on("delete", emitIfScrapFile));
    this.registerEvent(this.app.vault.on("create", emitIfScrapFile));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.eventBus.emit(EVENTS.SCRAP_CHANGED);
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

  async openScrap(scrap: Scrap, scrollToEntryIndex?: number) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_SCRAP_DETAIL)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true)!;
    }
    await leaf.setViewState({
      type: VIEW_TYPE_SCRAP_DETAIL,
      active: true,
      state: { filePath: scrap.filePath, scrollToEntryIndex },
    });
    workspace.revealLeaf(leaf);
  }

  async openMarkedList() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_MARKED_LIST)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true)!;
    }
    await leaf.setViewState({
      type: VIEW_TYPE_MARKED_LIST,
      active: true,
    });
    workspace.revealLeaf(leaf);
  }

  async openCollectionList() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_COLLECTION_LIST)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true)!;
    }
    await leaf.setViewState({
      type: VIEW_TYPE_COLLECTION_LIST,
      active: true,
    });
    workspace.revealLeaf(leaf);
  }

  async openCollectionDetail(id: string) {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_COLLECTION_DETAIL)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true)!;
    }
    await leaf.setViewState({
      type: VIEW_TYPE_COLLECTION_DETAIL,
      active: true,
      state: { collectionId: id },
    });
    workspace.revealLeaf(leaf);
  }

  async onunload() {}
}
