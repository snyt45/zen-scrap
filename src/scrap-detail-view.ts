import { ItemView, WorkspaceLeaf, MarkdownRenderer, Component } from "obsidian";
import { Scrap } from "./types";
import { ScrapRepository } from "./scrap-repository";

export const VIEW_TYPE_SCRAP_DETAIL = "zen-scrap-detail";

export class ScrapDetailView extends ItemView {
  private repo: ScrapRepository;
  private scrap: Scrap;
  private onBack: () => void;
  private renderComponent: Component;

  constructor(
    leaf: WorkspaceLeaf,
    repo: ScrapRepository,
    scrap: Scrap,
    onBack: () => void
  ) {
    super(leaf);
    this.repo = repo;
    this.scrap = scrap;
    this.onBack = onBack;
    this.renderComponent = new Component();
  }

  getViewType(): string {
    return VIEW_TYPE_SCRAP_DETAIL;
  }

  getDisplayText(): string {
    return this.scrap.title;
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    this.renderComponent.load();
    await this.render();
  }

  async onClose(): Promise<void> {
    this.renderComponent.unload();
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-detail-container");

    // ヘッダー
    const header = container.createDiv({ cls: "zen-scrap-detail-header" });
    const backBtn = header.createEl("button", { text: "← 一覧", cls: "zen-scrap-back-btn" });
    backBtn.addEventListener("click", () => this.onBack());

    header.createEl("h2", { text: this.scrap.title, cls: "zen-scrap-detail-title" });

    const headerControls = header.createDiv({ cls: "zen-scrap-detail-controls" });
    const statusBadge = headerControls.createSpan({
      text: this.scrap.status,
      cls: `zen-scrap-status zen-scrap-status-${this.scrap.status}`,
    });

    if (this.scrap.tags.length > 0) {
      const tagsEl = header.createDiv({ cls: "zen-scrap-detail-tags" });
      tagsEl.setText(this.scrap.tags.map((t) => `#${t}`).join(" "));
    }

    // タイムライン
    const timeline = container.createDiv({ cls: "zen-scrap-timeline" });

    for (const entry of this.scrap.entries) {
      const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

      const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });
      entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

      const entryBody = entryEl.createDiv({ cls: "zen-scrap-entry-body" });
      await MarkdownRenderer.render(
        this.app,
        entry.body,
        entryBody,
        this.scrap.filePath,
        this.renderComponent
      );
    }

    // 入力欄
    const inputArea = container.createDiv({ cls: "zen-scrap-input-area" });
    const textarea = inputArea.createEl("textarea", {
      placeholder: "ここに書き散らす...",
      cls: "zen-scrap-textarea",
    });

    const submitBtn = inputArea.createEl("button", { text: "投稿", cls: "zen-scrap-submit-btn" });
    submitBtn.addEventListener("click", async () => {
      const body = textarea.value.trim();
      if (!body) return;
      this.scrap = await this.repo.addEntry(this.scrap, body);
      await this.render();
    });

    // Cmd+Enterで投稿
    textarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitBtn.click();
      }
    });

    // 最下部にスクロール
    timeline.scrollTop = timeline.scrollHeight;
  }
}
