import { App, Modal } from "obsidian";

export class TitlePromptModal extends Modal {
  private resolve: (value: string | null) => void = () => {};

  constructor(app: App) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("新しいスクラップ");
    const input = this.contentEl.createEl("input", {
      type: "text",
      placeholder: "タイトルを入力...",
      cls: "zen-scrap-title-input",
    });
    input.style.width = "100%";
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        this.close();
        this.resolve(input.value.trim() || null);
      }
      if (e.key === "Escape") {
        this.close();
        this.resolve(null);
      }
    });
    input.focus();
  }

  onClose() {
    this.resolve(null);
  }

  prompt(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
}
