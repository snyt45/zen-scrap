import { Modal, Notice } from "obsidian";
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";
import { formatDate } from "../../utils";
import { chevronLeftIcon, EXPAND_ICON, SHRINK_ICON, TRIANGLE_DOWN_ICON, EDIT_ICON, MORE_ICON, HELP_ICON } from "../../icons";
import { MarkdownRenderer } from "./markdown-renderer";
import shortcutGuideRaw from "../../../docs/shortcut-guide.md";

export interface HeaderDeps {
  scrap: Scrap;
  repo: ScrapRepository;
  eventBus: EventBus;
  app: import("obsidian").App;
  markdownRenderer: MarkdownRenderer;
  isFullWidth: boolean;
  setFullWidth: (v: boolean) => void;
  containerEl: HTMLElement;
  render: () => Promise<void>;
  openFile: (path: string) => void;
  addDocumentClickHandler: (handler: () => void) => void;
}

export function renderHeader(container: HTMLElement, deps: HeaderDeps): void {
  const { scrap, repo, eventBus, render, openFile, addDocumentClickHandler } = deps;
  const header = container.createDiv({ cls: "zen-scrap-detail-header" });

  const navRow = header.createDiv({ cls: "zen-scrap-detail-nav" });

  const backBtn = navRow.createEl("button", { cls: "zen-scrap-back-btn" });
  backBtn.innerHTML = `${chevronLeftIcon(14)} 一覧へ戻る`;
  backBtn.addEventListener("click", () => eventBus.emit(EVENTS.NAV_BACK_TO_LIST));

  const navRight = navRow.createDiv({ cls: "zen-scrap-detail-nav-right" });

  const fullWidthBtn = navRight.createEl("button", { cls: "zen-scrap-fullwidth-toggle" });
  fullWidthBtn.innerHTML = deps.isFullWidth ? SHRINK_ICON : EXPAND_ICON;
  fullWidthBtn.addEventListener("click", async () => {
    deps.setFullWidth(!deps.isFullWidth);
    await deps.render();
  });

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

    const saveBtn = titleRow.createEl("button", { text: "保存", cls: "zen-scrap-title-save-btn" });
    const cancelBtn = titleRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-title-cancel-btn" });

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

    const saveBtn = tagRow.createEl("button", { text: "保存", cls: "zen-scrap-title-save-btn" });
    const cancelBtn = tagRow.createEl("button", { text: "キャンセル", cls: "zen-scrap-title-cancel-btn" });

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
}
