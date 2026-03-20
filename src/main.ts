import { Plugin, TFile } from "obsidian";
import { ScrapRepository } from "./data/scrap-repository";
import { CollectionRepository } from "./data/collection-repository";
import { ScrapListView, VIEW_TYPE_SCRAP_LIST } from "./views/scrap-list-view";
import { ScrapDetailView, VIEW_TYPE_SCRAP_DETAIL } from "./views/scrap-detail-view";
import { InboxListView, VIEW_TYPE_INBOX_LIST } from "./views/inbox-list-view";
import { InboxRepository } from "./data/inbox-repository";
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
  private inboxRepo!: InboxRepository;
  private eventBus!: EventBus;
  settings!: ZenScrapSettings;

  async onload() {
    await this.loadSettings();

    this.repo = new ScrapRepository(this.app, this.settings);
    this.collectionRepo = new CollectionRepository(this.app, this.settings);
    this.inboxRepo = new InboxRepository(this.app, this.settings);
    this.eventBus = new EventBus();

    this.registerView(VIEW_TYPE_SCRAP_LIST, (leaf) =>
      new ScrapListView(leaf, this.repo, this.collectionRepo, this.inboxRepo, this.eventBus, this.settings)
    );

    this.registerView(VIEW_TYPE_SCRAP_DETAIL, (leaf) =>
      new ScrapDetailView(leaf, this.repo, this.collectionRepo, this.inboxRepo, this.eventBus, this.settings)
    );

    this.registerView(VIEW_TYPE_INBOX_LIST, (leaf) =>
      new InboxListView(leaf, this.repo, this.inboxRepo, this.eventBus)
    );

    this.registerView(VIEW_TYPE_COLLECTION_LIST, (leaf) =>
      new CollectionListView(leaf, this.collectionRepo, this.inboxRepo, this.eventBus)
    );

    this.registerView(VIEW_TYPE_COLLECTION_DETAIL, (leaf) =>
      new CollectionDetailView(leaf, this.collectionRepo, this.repo, this.inboxRepo, this.eventBus)
    );

    registerScrapHandlers(this.eventBus, this.app, this.repo, (scrap, scrollToEntryIndex) => this.openScrap(scrap, scrollToEntryIndex));
    registerNavHandlers(
      this.eventBus,
      () => this.activateListView(),
      () => this.openInboxList(),
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

    this.addCommand({
      id: "search-in-scrap",
      name: "Search in scrap",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(ScrapDetailView);
        if (!view) return false;
        if (!checking) view.toggleSearch();
        return true;
      },
    });

    // Cmd+F / Ctrl+F をスクラップ詳細ビューで捕まえる
    const searchHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        const view = this.app.workspace.getActiveViewOfType(ScrapDetailView);
        if (!view) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        view.toggleSearch();
      }
    };
    window.addEventListener("keydown", searchHandler, true);
    this.register(() => window.removeEventListener("keydown", searchHandler, true));

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

  async openInboxList() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_INBOX_LIST)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true)!;
    }
    await leaf.setViewState({
      type: VIEW_TYPE_INBOX_LIST,
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
