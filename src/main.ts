import { Plugin, TFile } from "obsidian";
import { ScrapRepository } from "./data/scrap-repository";
import { ScrapListView, VIEW_TYPE_SCRAP_LIST } from "./views/scrap-list-view";
import { ScrapDetailView, VIEW_TYPE_SCRAP_DETAIL } from "./views/scrap-detail-view";
import { Scrap } from "./data/types";
import { EventBus } from "./events/event-bus";
import { registerScrapHandlers } from "./events/scrap-handlers";
import { registerNavHandlers } from "./events/nav-handlers";
import { EVENTS } from "./events/constants";
import { ZenScrapSettings, DEFAULT_SETTINGS, ZenScrapSettingTab } from "./settings";

export default class ZenScrapPlugin extends Plugin {
  private repo!: ScrapRepository;
  private eventBus!: EventBus;
  settings!: ZenScrapSettings;

  async onload() {
    await this.loadSettings();

    this.repo = new ScrapRepository(this.app, this.settings);
    this.eventBus = new EventBus();

    this.registerView(VIEW_TYPE_SCRAP_LIST, (leaf) =>
      new ScrapListView(leaf, this.repo, this.eventBus)
    );

    this.registerView(VIEW_TYPE_SCRAP_DETAIL, (leaf) =>
      new ScrapDetailView(leaf, this.repo, this.eventBus, this.settings)
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
