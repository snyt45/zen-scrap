import { Modal, Notice, Scope } from "obsidian";
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { CollectionRepository } from "../../data/collection-repository";
import { CollectionPickerModal } from "../../ui/collection-picker-modal";
import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";
import { formatDate, stripMarkdown } from "../../utils";
import { EXPAND_ICON, SHRINK_ICON, TRIANGLE_DOWN_ICON, EDIT_ICON, MORE_ICON, HELP_ICON, OUTLINE_ICON, BOOKMARK_FILLED_ICON } from "../../icons";
import { renderTabNav } from "../shared/tab-nav-renderer";
import { MarkdownRenderer } from "./markdown-renderer";
import shortcutGuideRaw from "../../../docs/shortcut-guide.md";

export interface HeaderDeps {
  scrap: Scrap;
  repo: ScrapRepository;
  collectionRepo: CollectionRepository;
  eventBus: EventBus;
  app: import("obsidian").App;
  scope: import("obsidian").Scope | null;
  markdownRenderer: MarkdownRenderer;
  isFullWidth: boolean;
  setFullWidth: (v: boolean) => void;
  containerEl: HTMLElement;
  render: () => Promise<void>;
  openFile: (path: string) => void;
  addDocumentClickHandler: (handler: () => void) => void;
  scrollToEntry: (index: number) => void;
  filterMarked: boolean;
  setFilterMarked: (v: boolean) => void;
}

export function renderHeader(container: HTMLElement, deps: HeaderDeps): void {
  const { scrap, repo, eventBus, render, openFile, addDocumentClickHandler } = deps;
  const header = container.createDiv({ cls: "zen-scrap-detail-header" });

  renderTabNav(header, {
    eventBus,
    activeTab: "none",
  });

  const navRight = header.createDiv({ cls: "zen-scrap-detail-nav-right" });

  const fullWidthBtn = navRight.createEl("button", { cls: "zen-scrap-fullwidth-toggle" });
  fullWidthBtn.innerHTML = deps.isFullWidth ? SHRINK_ICON : EXPAND_ICON;
  fullWidthBtn.addEventListener("click", async () => {
    deps.setFullWidth(!deps.isFullWidth);
    await deps.render();
  });

  // マーク絞り込みトグル
  const hasMarked = scrap.entries.some(e => e.marked);
  if (hasMarked || deps.filterMarked) {
    const filterMarkBtn = navRight.createEl("button", {
      cls: `zen-scrap-filter-mark-btn${deps.filterMarked ? " is-active" : ""}`,
    });
    filterMarkBtn.innerHTML = BOOKMARK_FILLED_ICON;
    filterMarkBtn.setAttribute("aria-label", deps.filterMarked ? "全て表示" : "マーク済みのみ");
    filterMarkBtn.addEventListener("click", async () => {
      deps.setFilterMarked(!deps.filterMarked);
      await deps.render();
    });
  }

  // アウトラインドロップダウン
  if (scrap.entries.length > 0) {
    const outlineWrapper = navRight.createDiv({ cls: "zen-scrap-outline-wrapper" });
    const outlineBtn = outlineWrapper.createEl("button", { cls: "zen-scrap-outline-btn" });

    const outlineEntries = deps.filterMarked
      ? scrap.entries.map((e, i) => ({ entry: e, index: i })).filter(({ entry }) => entry.marked)
      : scrap.entries.map((e, i) => ({ entry: e, index: i }));

    outlineBtn.innerHTML = `${OUTLINE_ICON}<span class="zen-scrap-outline-badge">${outlineEntries.length}</span>`;
    outlineBtn.setAttribute("aria-label", "アウトライン");

    const outlineMenu = outlineWrapper.createDiv({ cls: "zen-scrap-outline-menu" });

    const outlineHeader = outlineMenu.createDiv({ cls: "zen-scrap-outline-header" });
    outlineHeader.setText("アウトライン");

    const outlineList = outlineMenu.createDiv({ cls: "zen-scrap-outline-list" });
    const tooltip = outlineMenu.createDiv({ cls: "zen-scrap-outline-tooltip" });

    outlineEntries.forEach(({ entry, index: originalIndex }, displayIndex) => {
      const item = outlineList.createDiv({ cls: "zen-scrap-outline-item" });
      const meta = item.createDiv({ cls: "zen-scrap-outline-item-meta" });
      meta.createSpan({ text: `${originalIndex + 1}`, cls: "zen-scrap-outline-item-number" });
      meta.createSpan({ text: entry.timestamp, cls: "zen-scrap-outline-item-time" });

      const preview = stripMarkdown(entry.body, 40);
      if (preview) {
        item.createDiv({ text: preview, cls: "zen-scrap-outline-item-preview" });
      }

      const tooltipText = entry.body.trim().slice(0, 200);
      item.addEventListener("mouseenter", () => {
        tooltip.setText(tooltipText);
        tooltip.style.display = "block";
        const menuRect = outlineMenu.getBoundingClientRect();
        const itemRect = item.getBoundingClientRect();
        tooltip.style.top = (itemRect.top - menuRect.top) + "px";
      });
      item.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
      });

      item.addEventListener("click", () => {
        outlineMenu.classList.remove("is-open");
        // タイムスタンプでDOM上のエントリを特定してスクロール
        const container = deps.containerEl;
        const entryEls = Array.from(container.querySelectorAll<HTMLElement>(".zen-scrap-entry"));
        for (const el of entryEls) {
          const timeEl = el.querySelector(".zen-scrap-entry-time");
          if (timeEl && timeEl.textContent === entry.timestamp) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            el.addClass("zen-scrap-entry-highlight");
            setTimeout(() => el.removeClass("zen-scrap-entry-highlight"), 2000);
            break;
          }
        }
      });
    });

    outlineBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      outlineMenu.classList.toggle("is-open");
    });

    const closeOutline = () => { outlineMenu.classList.remove("is-open"); };
    addDocumentClickHandler(closeOutline);
  }

  const helpBtn = navRight.createEl("button", { cls: "zen-scrap-help-btn" });
  helpBtn.innerHTML = HELP_ICON;
  helpBtn.setAttribute("aria-label", "ショートカットガイド");
  helpBtn.addEventListener("click", async () => {
    const modal = new Modal(deps.app);
    modal.titleEl.setText("ショートカット・操作ガイド");
    modal.modalEl.addClass("zen-scrap-guide-modal");
    const content = modal.contentEl.createDiv({ cls: "znc zen-scrap-guide-content" });
    content.innerHTML = await deps.markdownRenderer.renderBody(shortcutGuideRaw);
    modal.open();
  });

  const titleRow = header.createDiv({ cls: "zen-scrap-detail-title-row" });
  const titleEl = titleRow.createEl("h2", { text: scrap.title, cls: "zen-scrap-detail-title zen-scrap-detail-title-editable" });

  titleEl.addEventListener("click", () => {
    titleRow.empty();
    const input = titleRow.createEl("input", {
      type: "text",
      value: scrap.title,
      cls: "zen-scrap-title-edit-input",
    });

    const saveBtn = titleRow.createEl("button", { text: "保存", cls: "zen-scrap-btn-primary zen-scrap-title-save-btn" });
    const cancelBtn = titleRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-btn-secondary zen-scrap-title-cancel-btn" });

    const doSave = async () => {
      const newTitle = input.value.trim();
      if (newTitle && newTitle !== scrap.title) {
        scrap.title = newTitle;
        await repo.save(scrap);
      }
      await render();
      eventBus.emit(EVENTS.SCRAP_CHANGED);
    };

    saveBtn.addEventListener("click", doSave);
    cancelBtn.addEventListener("click", () => render());
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); doSave(); }
      if (e.key === "Escape") { render(); }
    });
    input.focus();
    input.select();
  });

  const metaRow = header.createDiv({ cls: "zen-scrap-detail-meta" });

  // ステータス切り替えドロップダウン
  const statusWrapper = metaRow.createDiv({ cls: "zen-scrap-status-switcher" });
  const currentStatus = scrap.archived ? "archived" : scrap.status;
  const statusConfig: Record<string, { label: string; cls: string }> = {
    open: { label: "Open", cls: "zen-scrap-label-open" },
    closed: { label: "Closed", cls: "zen-scrap-label-closed" },
    archived: { label: "Archived", cls: "zen-scrap-label-archived" },
  };
  const current = statusConfig[currentStatus];
  const statusBtn = statusWrapper.createEl("button", {
    text: current.label,
    cls: `zen-scrap-status-btn ${current.cls}`,
  });
  statusBtn.innerHTML = `${current.label} <span class="zen-scrap-status-arrow">${TRIANGLE_DOWN_ICON}</span>`;

  const statusMenu = statusWrapper.createDiv({ cls: "zen-scrap-status-menu" });
  for (const [key, config] of Object.entries(statusConfig)) {
    if (key === currentStatus) continue;
    const item = statusMenu.createDiv({ cls: "zen-scrap-status-menu-item" });
    item.createSpan({ text: config.label, cls: `zen-scrap-status-dot ${config.cls}` });
    item.addEventListener("click", async () => {
      if (key === "archived") {
        scrap.archived = true;
        scrap.status = "closed";
      } else {
        scrap.archived = false;
        scrap.status = key as "open" | "closed";
      }
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await render();
      eventBus.emit(EVENTS.SCRAP_CHANGED);
    });
  }

  statusBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    statusMenu.classList.toggle("is-open");
  });
  const closeStatusMenu = () => { statusMenu.classList.remove("is-open"); };
  addDocumentClickHandler(closeStatusMenu);
  metaRow.createSpan({ text: formatDate(scrap.created) + "に作成", cls: "zen-scrap-detail-meta-text" });
  metaRow.createSpan({ text: `${scrap.entries.length}件のコメント`, cls: "zen-scrap-detail-meta-text" });

  // アクションドロップダウン
  const actionWrapper = metaRow.createDiv({ cls: "zen-scrap-action-dropdown" });
  const actionBtn = actionWrapper.createEl("button", {
    cls: "zen-scrap-action-more-btn",
  });
  actionBtn.innerHTML = MORE_ICON;

  const actionMenu = actionWrapper.createDiv({ cls: "zen-scrap-dropdown-menu" });
  actionMenu.style.left = "auto";
  actionMenu.style.right = "0";

  const jsonItem = actionMenu.createDiv({
    text: "JSONをコピー",
    cls: "zen-scrap-dropdown-item",
  });
  jsonItem.addEventListener("click", () => {
    const json = JSON.stringify(scrap, null, 2);
    navigator.clipboard.writeText(json);
    new Notice("JSONをクリップボードにコピーしました");
    actionMenu.classList.remove("is-open");
  });

  const openFileItem = actionMenu.createDiv({
    text: "ファイルを開く",
    cls: "zen-scrap-dropdown-item",
  });
  openFileItem.addEventListener("click", () => {
    openFile(scrap.filePath);
    actionMenu.classList.remove("is-open");
  });

  const addToCollectionItem = actionMenu.createDiv({
    text: "コレクションに追加",
    cls: "zen-scrap-dropdown-item",
  });
  addToCollectionItem.addEventListener("click", () => {
    actionMenu.classList.remove("is-open");
    new CollectionPickerModal(deps.app, deps.collectionRepo, async (collectionId) => {
      const { added } = await deps.collectionRepo.addItem(collectionId, { type: "scrap", scrapPath: scrap.filePath });
      new Notice(added ? "コレクションに追加しました" : "すでに追加済みです");
    }).open();
  });

  const deleteItem = actionMenu.createDiv({
    text: "削除",
    cls: "zen-scrap-dropdown-item zen-scrap-dropdown-item-danger",
  });
  deleteItem.addEventListener("click", async () => {
    if (!confirm(`「${scrap.title}」を削除しますか？`)) return;
    await repo.delete(scrap);
    eventBus.emit(EVENTS.SCRAP_CHANGED);
    eventBus.emit(EVENTS.NAV_BACK_TO_LIST);
  });

  actionBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    actionMenu.classList.toggle("is-open");
  });

  const closeMenu = () => { actionMenu.classList.remove("is-open"); };
  addDocumentClickHandler(closeMenu);

  // タグ行
  const tagRow = header.createDiv({ cls: "zen-scrap-tag-row" });

  const renderTagDisplay = () => {
    tagRow.empty();
    if (scrap.tags.length > 0) {
      for (const tag of scrap.tags) {
        tagRow.createSpan({ text: tag, cls: "zen-scrap-tag" });
      }
      const tagEditBtn = tagRow.createEl("button", { cls: "zen-scrap-tag-edit-btn" });
      tagEditBtn.innerHTML = EDIT_ICON;
      tagEditBtn.addEventListener("click", () => renderTagEdit());
    } else {
      const addLink = tagRow.createSpan({ text: "+ タグを追加", cls: "zen-scrap-tag-add-link" });
      addLink.addEventListener("click", () => renderTagEdit());
    }
  };

  const renderTagEdit = () => {
    tagRow.empty();
    const input = tagRow.createEl("input", {
      type: "text",
      value: scrap.tags.join(", "),
      cls: "zen-scrap-tag-edit-input",
      placeholder: "タグをカンマ区切りで入力",
    });

    const saveBtn = tagRow.createEl("button", { text: "保存", cls: "zen-scrap-btn-primary zen-scrap-title-save-btn" });
    const cancelBtn = tagRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-btn-secondary zen-scrap-title-cancel-btn" });

    const doSave = async () => {
      const newTags = input.value
        .split(",")
        .map((t: string) => t.trim())
        .filter((t: string) => t.length > 0);
      scrap.tags = newTags;
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await render();
      eventBus.emit(EVENTS.SCRAP_CHANGED);
    };

    saveBtn.addEventListener("click", doSave);
    cancelBtn.addEventListener("click", () => renderTagDisplay());
    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.key === "Enter") { e.preventDefault(); doSave(); }
      if (e.key === "Escape") { renderTagDisplay(); }
    });
    input.focus();
  };

  renderTagDisplay();

  // Description
  const descSection = header.createDiv({ cls: "zen-scrap-description-section" });

  const renderDescDisplay = async () => {
    descSection.empty();
    if (scrap.description) {
      const descBody = descSection.createDiv({ cls: "zen-scrap-description-body znc" });
      descBody.innerHTML = await deps.markdownRenderer.renderBody(scrap.description);
      deps.markdownRenderer.addCopyButtons(descBody);
      deps.markdownRenderer.addLinkHandler(descBody);
      const editBtn = descSection.createEl("button", { cls: "zen-scrap-description-edit-btn" });
      editBtn.innerHTML = EDIT_ICON;
      editBtn.addEventListener("click", () => renderDescEdit());
    } else {
      const addLink = descSection.createSpan({ text: "+ 説明を追加", cls: "zen-scrap-description-add-link" });
      addLink.addEventListener("click", () => renderDescEdit());
    }
  };

  const EMPTY_PREVIEW_HTML = '<p style="color: var(--text-muted)">プレビューする内容がありません</p>';

  const renderDescEdit = () => {
    descSection.empty();
    const editArea = descSection.createDiv({ cls: "zen-scrap-description-edit" });

    const tabHeader = editArea.createDiv({ cls: "zen-scrap-pill-tabs" });
    const mdTab = tabHeader.createEl("button", { text: "Markdown", cls: "zen-scrap-pill-tab zen-scrap-pill-tab-active" });
    const pvTab = tabHeader.createEl("button", { text: "Preview", cls: "zen-scrap-pill-tab" });

    const textarea = editArea.createEl("textarea", { cls: "zen-scrap-textarea" });
    textarea.value = scrap.description;
    textarea.placeholder = "説明を追加";

    const adjustHeight = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };
    textarea.addEventListener("input", adjustHeight);
    requestAnimationFrame(adjustHeight);

    const preview = editArea.createDiv({ cls: "zen-scrap-preview znc" });
    preview.style.display = "none";
    preview.tabIndex = -1;

    mdTab.addEventListener("click", () => {
      mdTab.addClass("zen-scrap-pill-tab-active");
      pvTab.removeClass("zen-scrap-pill-tab-active");
      textarea.style.display = "";
      preview.style.display = "none";
      textarea.focus();
    });

    pvTab.addEventListener("click", async () => {
      pvTab.addClass("zen-scrap-pill-tab-active");
      mdTab.removeClass("zen-scrap-pill-tab-active");
      textarea.style.display = "none";
      preview.style.display = "";
      preview.focus();
      if (textarea.value.trim()) {
        preview.innerHTML = await deps.markdownRenderer.renderBody(textarea.value);
        deps.markdownRenderer.addCopyButtons(preview);
        deps.markdownRenderer.addLinkHandler(preview);
      } else {
        preview.innerHTML = EMPTY_PREVIEW_HTML;
      }
    });

    const actionBar = editArea.createDiv({ cls: "zen-scrap-action-bar" });
    const cancelBtn = actionBar.createEl("button", { text: "キャンセル", cls: "zen-scrap-btn-secondary zen-scrap-edit-cancel-btn" });
    const saveBtn = actionBar.createEl("button", { text: "保存する", cls: "zen-scrap-btn-primary zen-scrap-submit-btn-new" });

    const doSave = async () => {
      scrap.description = textarea.value.trim();
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await renderDescDisplay();
      eventBus.emit(EVENTS.SCRAP_CHANGED);
    };

    cancelBtn.addEventListener("click", () => renderDescDisplay());
    saveBtn.addEventListener("click", doSave);

    const descScope = new Scope(deps.scope ?? undefined);
    descScope.register(["Mod"], "Enter", (e: KeyboardEvent) => {
      e.preventDefault();
      saveBtn.click();
      return false;
    });
    descScope.register(["Mod"], "E", (e: KeyboardEvent) => {
      e.preventDefault();
      if (preview.style.display === "none") {
        pvTab.click();
      } else {
        mdTab.click();
      }
      return false;
    });
    textarea.addEventListener("focus", () => deps.app.keymap.pushScope(descScope));
    textarea.addEventListener("blur", () => deps.app.keymap.popScope(descScope));
    preview.addEventListener("focus", () => deps.app.keymap.pushScope(descScope));
    preview.addEventListener("blur", () => deps.app.keymap.popScope(descScope));

    textarea.focus();
  };

  renderDescDisplay();
}
