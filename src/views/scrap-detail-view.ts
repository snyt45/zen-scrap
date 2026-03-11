import { ItemView, WorkspaceLeaf, TFile, Modal } from "obsidian";
import markdownToHtml from "zenn-markdown-html";
import { Scrap } from "../data/types";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";
import { EmbedModal, EmbedType } from "../ui/embed-modal";
import { renderEmbed } from "../ui/embed-renderer";
import markdownGuideRaw from "../../docs/markdown-guide.md";
import sampleImageUrl from "../../assets/sample.png";

export const VIEW_TYPE_SCRAP_DETAIL = "zen-scrap-detail";

export class ScrapDetailView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private scrap: Scrap | undefined;
  private isFullWidth = false;
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
    if (this.isFullWidth) container.addClass("zen-scrap-fullwidth");

    this.renderHeader(container);
    await this.renderTimeline(container);
    this.renderInputArea(container);
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "zen-scrap-detail-header" });

    const navRow = header.createDiv({ cls: "zen-scrap-detail-nav" });

    const backBtn = navRow.createEl("button", { cls: "zen-scrap-back-btn" });
    backBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> 一覧へ戻る';
    backBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.NAV_BACK_TO_LIST));

    const fullWidthBtn = navRow.createEl("button", { cls: "zen-scrap-fullwidth-toggle" });
    const expandIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
    const shrinkIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>';
    fullWidthBtn.innerHTML = this.isFullWidth ? shrinkIcon : expandIcon;
    fullWidthBtn.addEventListener("click", () => {
      this.isFullWidth = !this.isFullWidth;
      const container = this.containerEl.children[1] as HTMLElement;
      container.toggleClass("zen-scrap-fullwidth", this.isFullWidth);
      fullWidthBtn.innerHTML = this.isFullWidth ? shrinkIcon : expandIcon;
    });

    const metaRow = header.createDiv({ cls: "zen-scrap-detail-meta" });
    const labelCls = this.scrap!.status === "open" ? "zen-scrap-label-open" : "zen-scrap-label-closed";
    const labelText = this.scrap!.status === "open" ? "Open" : "Closed";
    metaRow.createSpan({ text: labelText, cls: labelCls });
    metaRow.createSpan({ text: formatDate(this.scrap!.created) + "に作成", cls: "zen-scrap-detail-meta-text" });
    metaRow.createSpan({ text: `${this.scrap!.entries.length}件のコメント`, cls: "zen-scrap-detail-meta-text" });

    // アクションドロップダウン
    const actionWrapper = metaRow.createDiv({ cls: "zen-scrap-action-dropdown" });
    const actionBtn = actionWrapper.createEl("button", {
      cls: "zen-scrap-action-dropdown-btn",
    });
    actionBtn.innerHTML = `操作 <span class="zen-scrap-dropdown-arrow"><svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8l5 5 5-5z"/></svg></span>`;

    const actionMenu = actionWrapper.createDiv({ cls: "zen-scrap-dropdown-menu" });
    actionMenu.style.display = "none";
    actionMenu.style.left = "auto";
    actionMenu.style.right = "0";

    const statusItem = actionMenu.createDiv({
      text: this.scrap!.status === "open" ? "クローズする" : "オープンにする",
      cls: "zen-scrap-dropdown-item",
    });
    statusItem.addEventListener("click", async () => {
      this.scrap!.status = this.scrap!.status === "open" ? "closed" : "open";
      this.scrap!.updated = new Date().toISOString();
      await this.repo.save(this.scrap!);
      this.eventBus.emit(EVENTS.SCRAP_CHANGED);
      await this.render();
    });

    const jsonItem = actionMenu.createDiv({
      text: "JSONをコピー",
      cls: "zen-scrap-dropdown-item",
    });
    jsonItem.addEventListener("click", () => {
      const json = JSON.stringify(this.scrap!, null, 2);
      navigator.clipboard.writeText(json);
      actionMenu.style.display = "none";
    });

    const openFileItem = actionMenu.createDiv({
      text: "ファイルを開く",
      cls: "zen-scrap-dropdown-item",
    });
    openFileItem.addEventListener("click", () => {
      this.app.workspace.openLinkText(this.scrap!.filePath, "", true);
      actionMenu.style.display = "none";
    });

    const deleteItem = actionMenu.createDiv({
      text: "削除",
      cls: "zen-scrap-dropdown-item zen-scrap-dropdown-item-danger",
    });
    deleteItem.addEventListener("click", async () => {
      if (!confirm(`「${this.scrap!.title}」を削除しますか？`)) return;
      await this.repo.delete(this.scrap!);
      this.eventBus.emit(EVENTS.SCRAP_CHANGED);
      this.eventBus.emit(EVENTS.NAV_BACK_TO_LIST);
    });

    actionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = actionMenu.style.display !== "none";
      actionMenu.style.display = isOpen ? "none" : "block";
    });

    const closeMenu = () => { actionMenu.style.display = "none"; };
    document.addEventListener("click", closeMenu);

    const titleRow = header.createDiv({ cls: "zen-scrap-detail-title-row" });
    titleRow.createEl("h2", { text: this.scrap!.title, cls: "zen-scrap-detail-title" });

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

    for (let i = 0; i < this.scrap!.entries.length; i++) {
      const entry = this.scrap!.entries[i];
      const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

      const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });
      entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

      const menuWrapper = entryHeader.createDiv({ cls: "zen-scrap-entry-menu" });
      const menuBtn = menuWrapper.createEl("button", { cls: "zen-scrap-entry-menu-btn" });
      menuBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

      const menu = menuWrapper.createDiv({ cls: "zen-scrap-entry-menu-dropdown" });
      menu.style.display = "none";

      const editItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: "編集" });
      const deleteItem = menu.createDiv({ cls: "zen-scrap-dropdown-item zen-scrap-dropdown-item-danger", text: "削除" });

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display !== "none";
        timeline.querySelectorAll<HTMLElement>(".zen-scrap-entry-menu-dropdown").forEach((m) => {
          m.style.display = "none";
        });
        menu.style.display = isOpen ? "none" : "";
      });

      const entryBody = entryEl.createDiv({ cls: "zen-scrap-entry-body znc" });
      entryBody.innerHTML = await this.renderBody(entry.body);
      this.addCopyButtons(entryBody);

      editItem.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.style.display = "none";
        this.renderEntryEditor(entryEl, entryBody, i);
      });

      deleteItem.addEventListener("click", async (e) => {
        e.stopPropagation();
        menu.style.display = "none";
        this.scrap!.entries.splice(i, 1);
        this.scrap!.updated = new Date().toISOString();
        await this.repo.save(this.scrap!);
        await this.render();
      });
    }

    document.addEventListener("click", () => {
      timeline.querySelectorAll<HTMLElement>(".zen-scrap-entry-menu-dropdown").forEach((m) => {
        m.style.display = "none";
      });
    });
  }

  private async renderBody(body: string): Promise<string> {
    // 1. 埋め込み記法を抽出してプレースホルダーに置換（youtubeはzenn-markdown-htmlが処理するので除外）
    const embeds: { id: string; type: string; url: string }[] = [];
    const processed = body.replace(/@\[(tweet|card|github)\]\(([^)]+)\)/g, (_, type, url) => {
      const id = `ZENSCRAPEMBED${embeds.length}ZENSCRAPEMBED`;
      embeds.push({ id, type, url });
      return id;
    });

    // 2. markdownToHtml
    let html = await markdownToHtml(processed);

    // 3. 埋め込みプレースホルダーをリッチHTMLに置換（<p>で囲まれている場合も対応）
    for (const embed of embeds) {
      const embedHtml = await renderEmbed(embed.type, embed.url);
      const wrappedPattern = new RegExp(`<p[^>]*>${embed.id}</p>`);
      if (wrappedPattern.test(html)) {
        html = html.replace(wrappedPattern, embedHtml);
      } else {
        html = html.replace(embed.id, embedHtml);
      }
    }

    // 4. vault内画像パスをリソースURLに変換
    html = this.fixImagePaths(html);

    return html;
  }

  private fixImagePaths(html: string): string {
    return html.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/g, (match, before, src, after) => {
      // 外部URLはスキップ
      if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("app://") || src.startsWith("data:")) {
        return match;
      }
      // vault内パスをリソースURLに変換
      const file = this.app.vault.getAbstractFileByPath(src);
      if (file instanceof TFile) {
        const resourcePath = this.app.vault.getResourcePath(file);
        return `<img${before}src="${resourcePath}"${after}>`;
      }
      return match;
    });
  }

  private renderInputArea(container: HTMLElement): void {
    const inputArea = container.createDiv({ cls: "zen-scrap-input-area" });

    const tabHeader = inputArea.createDiv({ cls: "zen-scrap-pill-tabs" });
    const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
    const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab" });
    this.renderMarkdownGuideLink(tabHeader);

    const textarea = inputArea.createEl("textarea", {
      placeholder: "スクラップにコメントを追加",
      cls: "zen-scrap-textarea",
    });
    this.setupAutoGrow(textarea);

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
        preview.innerHTML = await this.renderBody(textarea.value);
        this.addCopyButtons(preview);
      } else {
        preview.innerHTML = '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';
      }
    });

    const actionBar = inputArea.createDiv({ cls: "zen-scrap-action-bar" });

    const imgBtn = actionBar.createEl("button", { text: "画像", cls: "zen-scrap-img-btn" });
    imgBtn.addEventListener("click", () => this.handleImageUpload(textarea));

    this.renderEmbedButton(actionBar, textarea);

    const submitBtn = actionBar.createEl("button", { text: "投稿する", cls: "zen-scrap-submit-btn-new zen-scrap-ml-auto" });
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

  private addCopyButtons(container: HTMLElement): void {
    container.querySelectorAll("pre").forEach((pre) => {
      pre.style.position = "relative";
      const btn = document.createElement("button");
      btn.className = "zen-scrap-code-copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        if (code) navigator.clipboard.writeText(code.textContent || "");
      });
      pre.prepend(btn);
    });
  }

  private renderMarkdownGuideLink(parent: HTMLElement): void {
    const link = parent.createEl("a", {
      text: "Markdownガイド",
      cls: "zen-scrap-md-guide-link",
      href: "#",
    });
    link.addEventListener("click", async (e) => {
      e.preventDefault();
      const content = markdownGuideRaw;
      const modal = new Modal(this.app);
      modal.titleEl.setText("Markdown ガイド");
      modal.modalEl.addClass("zen-scrap-guide-modal");

      const tabHeader = modal.contentEl.createDiv({ cls: "zen-scrap-pill-tabs" });
      const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
      const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab" });

      const previewEl = modal.contentEl.createDiv({ cls: "znc zen-scrap-guide-content" });
      let guideHtml = await this.renderBody(content);
      guideHtml = guideHtml.replace(/src="zen-scrap-sample-image"/, `src="${sampleImageUrl}"`);
      previewEl.innerHTML = guideHtml;
      this.addCopyButtons(previewEl);

      const markdownEl = modal.contentEl.createEl("pre", { cls: "zen-scrap-guide-content zen-scrap-guide-raw" });
      markdownEl.createEl("code", { text: content });
      markdownEl.style.display = "none";

      pvTab.addEventListener("click", () => {
        pvTab.addClass("zen-scrap-pill-tab-active");
        mdTab.removeClass("zen-scrap-pill-tab-active");
        previewEl.style.display = "";
        markdownEl.style.display = "none";
      });
      mdTab.addEventListener("click", () => {
        mdTab.addClass("zen-scrap-pill-tab-active");
        pvTab.removeClass("zen-scrap-pill-tab-active");
        previewEl.style.display = "none";
        markdownEl.style.display = "";
      });

      modal.open();
    });
  }

  private setupAutoGrow(textarea: HTMLTextAreaElement): void {
    const adjust = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };
    textarea.addEventListener("input", adjust);
  }

  private renderEntryEditor(entryEl: HTMLElement, entryBody: HTMLElement, index: number): void {
    const entry = this.scrap!.entries[index];

    entryBody.style.display = "none";
    const editArea = entryEl.createDiv({ cls: "zen-scrap-entry-edit" });

    const tabHeader = editArea.createDiv({ cls: "zen-scrap-pill-tabs" });
    const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
    const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab" });
    this.renderMarkdownGuideLink(tabHeader);

    const textarea = editArea.createEl("textarea", {
      cls: "zen-scrap-textarea",
    });
    textarea.value = entry.body;
    this.setupAutoGrow(textarea);
    requestAnimationFrame(() => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    });

    const preview = editArea.createDiv({ cls: "zen-scrap-preview znc" });
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
        preview.innerHTML = await this.renderBody(textarea.value);
        this.addCopyButtons(preview);
      } else {
        preview.innerHTML = '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';
      }
    });

    const actionBar = editArea.createDiv({ cls: "zen-scrap-action-bar" });

    const imgBtn = actionBar.createEl("button", { text: "画像", cls: "zen-scrap-img-btn" });
    imgBtn.addEventListener("click", () => this.handleImageUpload(textarea));

    this.renderEmbedButton(actionBar, textarea);

    const cancelBtn = actionBar.createEl("button", { text: "キャンセル", cls: "zen-scrap-edit-cancel-btn" });

    const updateBtn = actionBar.createEl("button", { text: "更新する", cls: "zen-scrap-submit-btn-new" });

    cancelBtn.addEventListener("click", () => {
      editArea.remove();
      entryBody.style.display = "";
    });

    updateBtn.addEventListener("click", async () => {
      const body = textarea.value.trim();
      if (!body || !this.scrap) return;
      this.scrap.entries[index].body = body;
      this.scrap.updated = new Date().toISOString();
      await this.repo.save(this.scrap);
      await this.render();
    });

    textarea.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        updateBtn.click();
      }
    });

    textarea.focus();
  }
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
