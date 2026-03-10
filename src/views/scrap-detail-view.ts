import { ItemView, WorkspaceLeaf } from "obsidian";
import markdownToHtml from "zenn-markdown-html";
import { Scrap } from "../data/types";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";

export const VIEW_TYPE_SCRAP_DETAIL = "zen-scrap-detail";

export class ScrapDetailView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private scrap: Scrap | undefined;
  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, eventBus: EventBus) {
    super(leaf);
    this.repo = repo;
    this.eventBus = eventBus;
  }

  getViewType(): string {
    return VIEW_TYPE_SCRAP_DETAIL;
  }

  getDisplayText(): string {
    return this.scrap?.title || "Zen Scrap";
  }

  async setState(state: { filePath?: string }, result: any): Promise<void> {
    if (state.filePath) {
      const found = await this.repo.getByPath(state.filePath);
      if (found) {
        this.scrap = found;
        await this.render();
      }
    }
    await super.setState(state, result);
  }

  getState(): Record<string, unknown> {
    return { filePath: this.scrap?.filePath };
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async onClose(): Promise<void> {
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    if (!this.scrap) return;
    container.addClass("zen-scrap-detail-container");

    this.renderHeader(container);
    await this.renderTimeline(container);
    this.renderInputArea(container);
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "zen-scrap-detail-header" });
    const backBtn = header.createEl("button", { text: "← 一覧", cls: "zen-scrap-back-btn" });
    backBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.NAV_BACK_TO_LIST));

    header.createEl("h2", { text: this.scrap!.title, cls: "zen-scrap-detail-title" });

    const headerControls = header.createDiv({ cls: "zen-scrap-detail-controls" });
    headerControls.createSpan({
      text: this.scrap!.status,
      cls: `zen-scrap-status zen-scrap-status-${this.scrap!.status}`,
    });

    if (this.scrap!.tags.length > 0) {
      const tagsEl = header.createDiv({ cls: "zen-scrap-detail-tags" });
      tagsEl.setText(this.scrap!.tags.map((t) => `#${t}`).join(" "));
    }
  }

  private async renderTimeline(container: HTMLElement): Promise<void> {
    const timeline = container.createDiv({ cls: "zen-scrap-timeline" });

    for (const entry of this.scrap!.entries) {
      const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

      const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });
      entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

      const toggleBtn = entryHeader.createEl("button", { cls: "zen-scrap-entry-toggle" });
      toggleBtn.innerHTML = "&#x25BC;"; // ▼

      const entryBody = entryEl.createDiv({ cls: "zen-scrap-entry-body znc" });
      entryBody.innerHTML = await markdownToHtml(entry.body);

      toggleBtn.addEventListener("click", () => {
        const collapsed = entryBody.style.display === "none";
        entryBody.style.display = collapsed ? "" : "none";
        toggleBtn.innerHTML = collapsed ? "&#x25BC;" : "&#x25B6;"; // ▼ or ▶
        entryEl.toggleClass("zen-scrap-entry-collapsed", !collapsed);
      });
    }

    timeline.scrollTop = timeline.scrollHeight;
  }

  private renderInputArea(container: HTMLElement): void {
    const inputArea = container.createDiv({ cls: "zen-scrap-input-area" });

    // タブヘッダー
    const tabHeader = inputArea.createDiv({ cls: "zen-scrap-input-tabs" });
    const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-input-tab zen-scrap-input-tab-active" });
    const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-input-tab" });

    // Markdownエディタ
    const textarea = inputArea.createEl("textarea", {
      placeholder: "ここに書き散らす...",
      cls: "zen-scrap-textarea",
    });

    // プレビューエリア
    const preview = inputArea.createDiv({ cls: "zen-scrap-preview znc" });
    preview.style.display = "none";

    // タブ切り替え
    mdTab.addEventListener("click", () => {
      mdTab.addClass("zen-scrap-input-tab-active");
      pvTab.removeClass("zen-scrap-input-tab-active");
      textarea.style.display = "";
      preview.style.display = "none";
    });

    pvTab.addEventListener("click", async () => {
      pvTab.addClass("zen-scrap-input-tab-active");
      mdTab.removeClass("zen-scrap-input-tab-active");
      textarea.style.display = "none";
      preview.style.display = "";
      if (textarea.value.trim()) {
        preview.innerHTML = await markdownToHtml(textarea.value);
      } else {
        preview.innerHTML = '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';
      }
    });

    // 投稿ボタン
    const submitBtn = inputArea.createEl("button", { text: "投稿", cls: "zen-scrap-submit-btn" });
    submitBtn.addEventListener("click", async () => {
      const body = textarea.value.trim();
      if (!body || !this.scrap) return;
      this.scrap = await this.repo.addEntry(this.scrap, body);
      await this.render();
    });

    textarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submitBtn.click();
      }
    });
  }
}
