import { Plugin } from "obsidian";
import { ScrapRepository } from "./data/scrap-repository";
import { ScrapListView, VIEW_TYPE_SCRAP_LIST } from "./views/scrap-list-view";
import { ScrapDetailView, VIEW_TYPE_SCRAP_DETAIL } from "./views/scrap-detail-view";
import { TitlePromptModal } from "./ui/title-prompt-modal";
import { Scrap } from "./data/types";

export default class ZenScrapPlugin extends Plugin {
  private repo!: ScrapRepository;

  async onload() {
    this.repo = new ScrapRepository(this.app);

    this.registerView(VIEW_TYPE_SCRAP_LIST, (leaf) =>
      new ScrapListView(
        leaf,
        this.repo,
        (scrap) => this.openScrap(scrap),
        () => this.createNewScrap()
      )
    );

    this.registerView(VIEW_TYPE_SCRAP_DETAIL, (leaf) =>
      new ScrapDetailView(leaf, this.repo, () => this.activateListView())
    );

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

  async createNewScrap() {
    const title = await new TitlePromptModal(this.app).prompt();
    if (!title) return;
    const scrap = await this.repo.create(title, []);
    this.openScrap(scrap);
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
