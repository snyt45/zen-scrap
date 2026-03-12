import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";
import { formatDate } from "../../utils";
import { chevronLeftIcon, EXPAND_ICON, SHRINK_ICON, TRIANGLE_DOWN_ICON, EDIT_ICON } from "../../icons";

export interface HeaderDeps {
  scrap: Scrap;
  repo: ScrapRepository;
  eventBus: EventBus;
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

  const fullWidthBtn = navRow.createEl("button", { cls: "zen-scrap-fullwidth-toggle" });
  fullWidthBtn.innerHTML = deps.isFullWidth ? SHRINK_ICON : EXPAND_ICON;
  fullWidthBtn.addEventListener("click", () => {
    const next = !deps.isFullWidth;
    deps.setFullWidth(next);
    deps.containerEl.toggleClass("zen-scrap-fullwidth", next);
    fullWidthBtn.innerHTML = next ? SHRINK_ICON : EXPAND_ICON;
  });

  const metaRow = header.createDiv({ cls: "zen-scrap-detail-meta" });
  const labelCls = scrap.archived ? "zen-scrap-label-archived" : scrap.status === "open" ? "zen-scrap-label-open" : "zen-scrap-label-closed";
  const labelText = scrap.archived ? "Archived" : scrap.status === "open" ? "Open" : "Closed";
  metaRow.createSpan({ text: labelText, cls: labelCls });
  metaRow.createSpan({ text: formatDate(scrap.created) + "に作成", cls: "zen-scrap-detail-meta-text" });
  metaRow.createSpan({ text: `${scrap.entries.length}件のコメント`, cls: "zen-scrap-detail-meta-text" });

  if (scrap.tags.length > 0) {
    for (const tag of scrap.tags) {
      metaRow.createSpan({ text: tag, cls: "zen-scrap-tag" });
    }
  }

  // アクションドロップダウン
  const actionWrapper = metaRow.createDiv({ cls: "zen-scrap-action-dropdown" });
  const actionBtn = actionWrapper.createEl("button", {
    cls: "zen-scrap-action-dropdown-btn",
  });
  actionBtn.innerHTML = `操作 <span class="zen-scrap-dropdown-arrow">${TRIANGLE_DOWN_ICON}</span>`;

  const actionMenu = actionWrapper.createDiv({ cls: "zen-scrap-dropdown-menu" });
  actionMenu.style.display = "none";
  actionMenu.style.left = "auto";
  actionMenu.style.right = "0";

  const statusItem = actionMenu.createDiv({
    text: scrap.status === "open" ? "クローズする" : "オープンにする",
    cls: "zen-scrap-dropdown-item",
  });
  statusItem.addEventListener("click", async () => {
    scrap.status = scrap.status === "open" ? "closed" : "open";
    scrap.updated = new Date().toISOString();
    await repo.save(scrap);
    eventBus.emit(EVENTS.SCRAP_CHANGED);
    await render();
  });

  const jsonItem = actionMenu.createDiv({
    text: "JSONをコピー",
    cls: "zen-scrap-dropdown-item",
  });
  jsonItem.addEventListener("click", () => {
    const json = JSON.stringify(scrap, null, 2);
    navigator.clipboard.writeText(json);
    actionMenu.style.display = "none";
  });

  const openFileItem = actionMenu.createDiv({
    text: "ファイルを開く",
    cls: "zen-scrap-dropdown-item",
  });
  openFileItem.addEventListener("click", () => {
    openFile(scrap.filePath);
    actionMenu.style.display = "none";
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
    const isOpen = actionMenu.style.display !== "none";
    actionMenu.style.display = isOpen ? "none" : "block";
  });

  const closeMenu = () => { actionMenu.style.display = "none"; };
  addDocumentClickHandler(closeMenu);

  const titleRow = header.createDiv({ cls: "zen-scrap-detail-title-row" });
  titleRow.createEl("h2", { text: scrap.title, cls: "zen-scrap-detail-title" });

  const editBtn = titleRow.createEl("button", { cls: "zen-scrap-title-edit-btn" });
  editBtn.innerHTML = EDIT_ICON;

  editBtn.addEventListener("click", () => {
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
        eventBus.emit(EVENTS.SCRAP_CHANGED);
      }
      await render();
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
}
