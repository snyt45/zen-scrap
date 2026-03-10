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
        const value = input.value.trim() || null;
        const r = this.resolve;
        this.resolve = () => {};
        this.close();
        r(value);
      }
      if (e.key === "Escape") {
        this.close();
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
