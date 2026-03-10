import { App, Modal } from "obsidian";

export class TitlePromptModal extends Modal {
  private result: string | null = null;
  private onSubmit: (value: string | null) => void;

  constructor(app: App, onSubmit: (value: string | null) => void) {
    super(app);
    this.onSubmit = onSubmit;
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
        this.result = input.value.trim() || null;
        this.close();
      }
    });
    input.focus();
  }

  onClose() {
    this.contentEl.empty();
    this.onSubmit(this.result);
  }
}
