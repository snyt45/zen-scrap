import { App, Modal } from "obsidian";
import { CollectionRepository } from "../data/collection-repository";

export class CollectionPickerModal extends Modal {
  private collectionRepo: CollectionRepository;
  private onPick: (collectionId: string) => void;

  constructor(app: App, collectionRepo: CollectionRepository, onPick: (collectionId: string) => void) {
    super(app);
    this.collectionRepo = collectionRepo;
    this.onPick = onPick;
  }

  async onOpen() {
    this.modalEl.addClass("zen-scrap-collection-picker-modal");
    this.titleEl.setText("コレクションに追加");

    const collections = await this.collectionRepo.listAll();

    if (collections.length === 0) {
      this.contentEl.createDiv({ text: "コレクションがありません", cls: "zen-scrap-collection-picker-empty" });
      return;
    }

    const list = this.contentEl.createDiv({ cls: "zen-scrap-collection-picker-list" });
    for (const collection of collections) {
      const item = list.createDiv({ text: collection.title, cls: "zen-scrap-collection-picker-item" });
      item.addEventListener("click", () => {
        this.onPick(collection.id);
        this.close();
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
