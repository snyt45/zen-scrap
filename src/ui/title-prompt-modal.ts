import { App, Modal } from "obsidian";

export class TitlePromptModal extends Modal {
  private result: string | null = null;
  private tags: string[] = [];
  private onSubmit: (title: string | null, tags: string[]) => void;

  constructor(app: App, onSubmit: (title: string | null, tags: string[]) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    this.titleEl.setText("新しいスクラップ");
    const titleInput = this.contentEl.createEl("input", {
      type: "text",
      placeholder: "タイトルを入力...",
      cls: "zen-scrap-title-input",
    });
    titleInput.style.width = "100%";

    const tagInput = this.contentEl.createEl("input", {
      type: "text",
      placeholder: "タグをカンマ区切りで入力（例: react, frontend）",
      cls: "zen-scrap-tag-input",
    });
    tagInput.style.width = "100%";

    const submit = () => {
      this.result = titleInput.value.trim() || null;
      this.tags = tagInput.value
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      setTimeout(() => this.close(), 0);
    };

    titleInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }
    });

    tagInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }
    });

    titleInput.focus();
  }

  onClose() {
    const cb = this.onSubmit;
    const result = this.result;
    const tags = this.tags;
    this.contentEl.empty();
    // モーダルが完全に閉じた後にコールバックを実行
    setTimeout(() => cb(result, tags), 0);
  }
}
