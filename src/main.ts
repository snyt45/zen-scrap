import { Plugin, Modal } from "obsidian";
import { ScrapRepository } from "./scrap-repository";
import { ScrapListView, VIEW_TYPE_SCRAP_LIST } from "./scrap-list-view";
import { ScrapDetailView, VIEW_TYPE_SCRAP_DETAIL } from "./scrap-detail-view";
import { Scrap } from "./types";

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
    const title = await this.promptForTitle();
    if (!title) return;
    const scrap = await this.repo.create(title, []);
    this.openScrap(scrap);
  }

  async promptForTitle(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new Modal(this.app);
      modal.titleEl.setText("新しいスクラップ");
      const input = modal.contentEl.createEl("input", {
        type: "text",
        placeholder: "タイトルを入力...",
        cls: "zen-scrap-title-input",
      });
      input.style.width = "100%";
      input.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          modal.close();
          resolve(input.value.trim() || null);
        }
        if (e.key === "Escape") {
          modal.close();
          resolve(null);
        }
      });
      modal.onClose = () => resolve(null);
      modal.open();
      input.focus();
    });
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
