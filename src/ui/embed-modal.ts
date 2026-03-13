import { App, Modal } from "obsidian";
import { buildEmbedSyntax } from "./url-detector";

export type EmbedType = "tweet" | "youtube" | "card" | "github";

const EMBED_CONFIG: Record<EmbedType, { title: string; placeholder: string }> = {
  tweet: { title: "Xのポストを埋め込み", placeholder: "ポストのURLを入力..." },
  youtube: { title: "YouTubeを埋め込み", placeholder: "動画のURLを入力..." },
  card: { title: "Web記事を埋め込み", placeholder: "記事のURLを入力..." },
  github: { title: "GitHubを埋め込み", placeholder: "リポジトリまたはIssueのURLを入力..." },
};

export class EmbedModal extends Modal {
  private embedType: EmbedType;
  private onSubmit: (syntax: string) => void;

  constructor(app: App, embedType: EmbedType, onSubmit: (syntax: string) => void) {
    super(app);
    this.embedType = embedType;
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const config = EMBED_CONFIG[this.embedType];
    this.titleEl.setText(config.title);

    const input = this.contentEl.createEl("input", {
      type: "text",
      placeholder: config.placeholder,
      cls: "zen-scrap-embed-input",
    });
    input.style.width = "100%";

    const btnRow = this.contentEl.createDiv({ cls: "zen-scrap-embed-btn-row" });
    const insertBtn = btnRow.createEl("button", { text: "挿入", cls: "zen-scrap-embed-insert-btn" });
    const cancelBtn = btnRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-embed-cancel-btn" });

    const doInsert = () => {
      const url = input.value.trim();
      if (!url) return;
      const syntax = buildEmbedSyntax(url, this.embedType);
      this.onSubmit(syntax);
      this.close();
    };

    insertBtn.addEventListener("click", doInsert);
    cancelBtn.addEventListener("click", () => this.close());
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); doInsert(); }
      if (e.key === "Escape") { this.close(); }
    });
    input.focus();
  }

  onClose() {
    this.contentEl.empty();
  }
}
