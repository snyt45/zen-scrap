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
        e.preventDefault();
        e.stopPropagation();
        this.result = input.value.trim() || null;
        setTimeout(() => this.close(), 0);
      }
    });
    input.focus();
  }

  onClose() {
    const cb = this.onSubmit;
    const result = this.result;
    this.contentEl.empty();
    // モーダルが完全に閉じた後にコールバックを実行
    setTimeout(() => cb(result), 0);
  }
}
