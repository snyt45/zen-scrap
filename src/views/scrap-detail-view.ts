import { ItemView, WorkspaceLeaf } from "obsidian";
import markdownToHtml from "zenn-markdown-html";
import { Scrap } from "../data/types";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { EmbedModal, EmbedType } from "../ui/embed-modal";

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

    const metaRow = header.createDiv({ cls: "zen-scrap-detail-meta" });
    const labelCls = this.scrap!.status === "open" ? "zen-scrap-label-open" : "zen-scrap-label-closed";
    const labelText = this.scrap!.status === "open" ? "Open" : "Closed";
    metaRow.createSpan({ text: labelText, cls: labelCls });
    metaRow.createSpan({ text: formatDate(this.scrap!.created) + "に作成", cls: "zen-scrap-detail-meta-text" });
    metaRow.createSpan({ text: `${this.scrap!.entries.length}件のコメント`, cls: "zen-scrap-detail-meta-text" });

    const titleRow = header.createDiv({ cls: "zen-scrap-detail-title-row" });
    const titleEl = titleRow.createEl("h2", { text: this.scrap!.title, cls: "zen-scrap-detail-title" });

    const editBtn = titleRow.createEl("button", { cls: "zen-scrap-title-edit-btn" });
    editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';

    editBtn.addEventListener("click", () => {
      titleRow.empty();
      const input = titleRow.createEl("input", {
        type: "text",
        value: this.scrap!.title,
        cls: "zen-scrap-title-edit-input",
      });

      const saveBtn = titleRow.createEl("button", { text: "保存", cls: "zen-scrap-title-save-btn" });
      const cancelBtn = titleRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-title-cancel-btn" });

      const doSave = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== this.scrap!.title) {
          this.scrap!.title = newTitle;
          await this.repo.save(this.scrap!);
          this.eventBus.emit(EVENTS.SCRAP_CHANGED);
        }
        await this.render();
      };

      saveBtn.addEventListener("click", doSave);
      cancelBtn.addEventListener("click", () => this.render());
      input.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.isComposing) return;
        if (e.key === "Enter") { e.preventDefault(); doSave(); }
        if (e.key === "Escape") { this.render(); }
      });
      input.focus();
      input.select();
    });
  }

  private async renderTimeline(container: HTMLElement): Promise<void> {
    const timeline = container.createDiv({ cls: "zen-scrap-timeline" });

    if (this.scrap!.entries.length === 0) {
      const emptyCard = timeline.createDiv({ cls: "zen-scrap-empty-state" });
      emptyCard.setText("最初のコメントを追加しましょう");
      return;
    }

    for (const entry of this.scrap!.entries) {
      const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

      const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });
      entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

      const toggleBtn = entryHeader.createEl("button", { cls: "zen-scrap-entry-toggle" });
      toggleBtn.innerHTML = "&#x25BC;"; // ▼

      const entryBody = entryEl.createDiv({ cls: "zen-scrap-entry-body znc" });
      entryBody.innerHTML = postProcessEmbeds(await markdownToHtml(entry.body));

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

    const tabHeader = inputArea.createDiv({ cls: "zen-scrap-pill-tabs" });
    const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
    const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab" });

    const textarea = inputArea.createEl("textarea", {
      placeholder: "スクラップにコメントを追加",
      cls: "zen-scrap-textarea",
    });

    const preview = inputArea.createDiv({ cls: "zen-scrap-preview znc" });
    preview.style.display = "none";

    mdTab.addEventListener("click", () => {
      mdTab.addClass("zen-scrap-pill-tab-active");
      pvTab.removeClass("zen-scrap-pill-tab-active");
      textarea.style.display = "";
      preview.style.display = "none";
    });

    pvTab.addEventListener("click", async () => {
      pvTab.addClass("zen-scrap-pill-tab-active");
      mdTab.removeClass("zen-scrap-pill-tab-active");
      textarea.style.display = "none";
      preview.style.display = "";
      if (textarea.value.trim()) {
        preview.innerHTML = postProcessEmbeds(await markdownToHtml(textarea.value));
      } else {
        preview.innerHTML = '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';
      }
    });

    const actionBar = inputArea.createDiv({ cls: "zen-scrap-action-bar" });

    const imgBtn = actionBar.createEl("button", { text: "画像", cls: "zen-scrap-img-btn" });
    imgBtn.addEventListener("click", () => this.handleImageUpload(textarea));

    this.renderEmbedButton(actionBar, textarea);

    const submitBtn = actionBar.createEl("button", { text: "投稿する", cls: "zen-scrap-submit-btn-new" });
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

  private handleImageUpload(textarea: HTMLTextAreaElement): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      const buffer = await file.arrayBuffer();
      const fileName = `${Date.now()}-${file.name}`;
      const folderPath = "Scraps/images";

      if (!this.app.vault.getAbstractFileByPath(folderPath)) {
        await this.app.vault.createFolder(folderPath);
      }

      const filePath = `${folderPath}/${fileName}`;
      await this.app.vault.createBinary(filePath, buffer);

      const syntax = `![](${filePath})`;
      const pos = textarea.selectionStart;
      const before = textarea.value.substring(0, pos);
      const after = textarea.value.substring(pos);
      textarea.value = before + syntax + "\n" + after;
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = pos + syntax.length + 1;
    });
    input.click();
  }

  private renderEmbedButton(parent: HTMLElement, textarea: HTMLTextAreaElement): void {
    const wrapper = parent.createDiv({ cls: "zen-scrap-embed-wrapper" });
    const embedBtn = wrapper.createEl("button", { text: "+ 埋め込み", cls: "zen-scrap-embed-btn" });

    const menu = wrapper.createDiv({ cls: "zen-scrap-embed-menu" });
    menu.style.display = "none";

    const items: { label: string; type: EmbedType }[] = [
      { label: "X (Twitter)", type: "tweet" },
      { label: "YouTube", type: "youtube" },
      { label: "Web記事", type: "card" },
      { label: "GitHub", type: "github" },
    ];

    for (const item of items) {
      const menuItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: item.label });
      menuItem.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.style.display = "none";
        new EmbedModal(this.app, item.type, (syntax) => {
          const pos = textarea.selectionStart;
          const before = textarea.value.substring(0, pos);
          const after = textarea.value.substring(pos);
          textarea.value = before + syntax + "\n" + after;
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = pos + syntax.length + 1;
        }).open();
      });
    }

    embedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === "none" ? "" : "none";
    });

    document.addEventListener("click", () => {
      menu.style.display = "none";
    });
  }
}

function postProcessEmbeds(html: string): string {
  // zenn-markdown-htmlがサポートしない埋め込みをリンクカードに変換
  // tweet: x.com or twitter.com のリンクをツイートカードに
  // card/github: 通常のURLリンクをカード風に
  return html.replace(
    /<a href="(https?:\/\/(?:x\.com|twitter\.com)\/[^"]+)"[^>]*>([^<]*)<\/a>/g,
    '<div class="zen-scrap-link-card"><a href="$1" target="_blank" rel="noopener">X (Twitter): $2</a></div>'
  ).replace(
    /<a href="(https?:\/\/github\.com\/[^"]+)"[^>]*>([^<]*)<\/a>/g,
    '<div class="zen-scrap-link-card"><a href="$1" target="_blank" rel="noopener">GitHub: $2</a></div>'
  ).replace(
    /<a href="(https?:\/\/(?!(?:x\.com|twitter\.com|github\.com|www\.youtube|youtu\.be))[^"]+)"[^>]*>([^<]*)<\/a>/g,
    '<div class="zen-scrap-link-card"><a href="$1" target="_blank" rel="noopener">$2</a></div>'
  );
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
