import { ItemView, WorkspaceLeaf } from "obsidian";
import { Scrap } from "../data/types";
import { ScrapRepository } from "../data/scrap-repository";
import { EventBus } from "../events/event-bus";
import { EVENTS } from "../events/constants";

export const VIEW_TYPE_SCRAP_LIST = "zen-scrap-list";

export class ScrapListView extends ItemView {
  private repo: ScrapRepository;
  private eventBus: EventBus;
  private filter: "all" | "open" | "closed" | "archived" = "open";
  private sort: "created" | "updated" = "created";
  private searchQuery = "";
  private onScrapChangedHandler: () => void;

  constructor(leaf: WorkspaceLeaf, repo: ScrapRepository, eventBus: EventBus) {
    super(leaf);
    this.repo = repo;
    this.eventBus = eventBus;
    this.onScrapChangedHandler = () => this.render();
  }

  getViewType(): string {
    return VIEW_TYPE_SCRAP_LIST;
  }

  getDisplayText(): string {
    return "Zen Scrap";
  }

  getIcon(): string {
    return "message-square";
  }

  async onOpen(): Promise<void> {
    this.eventBus.on(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
    await this.render();
  }

  async onClose(): Promise<void> {
    this.eventBus.off(EVENTS.SCRAP_CHANGED, this.onScrapChangedHandler);
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("zen-scrap-list-container");

    this.renderHeader(container);
    this.renderSearch(container);
    this.renderToolbar(container);
    await this.renderList(container);
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "zen-scrap-list-header" });
    header.createEl("h2", { text: "Zen Scrap" });

    const newBtn = header.createEl("button", { text: "+ 新規作成", cls: "zen-scrap-new-btn" });
    newBtn.addEventListener("click", () => this.eventBus.emit(EVENTS.SCRAP_CREATE_REQUEST));
  }

  private renderSearch(container: HTMLElement): void {
    const input = container.createEl("input", {
      cls: "zen-scrap-search",
      type: "text",
      placeholder: "スクラップを検索...",
    });
    input.value = this.searchQuery;
    let composing = false;
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => {
      composing = false;
      this.searchQuery = input.value;
      this.rerenderList();
    });
    input.addEventListener("input", () => {
      if (composing) return;
      this.searchQuery = input.value;
      this.rerenderList();
    });
  }

  private async rerenderList(): Promise<void> {
    const existing = this.containerEl.querySelector(".zen-scrap-list");
    if (existing) existing.remove();
    const container = this.containerEl.children[1] as HTMLElement;
    await this.renderList(container);
  }

  private renderToolbar(container: HTMLElement): void {
    const toolbar = container.createDiv({ cls: "zen-scrap-toolbar" });

    this.renderDropdown(toolbar, "公開状態", "all", [
      { value: "all", label: "All" },
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
      { value: "archived", label: "Archived" },
    ], this.filter, (v) => { this.filter = v as typeof this.filter; this.render(); });

    this.renderDropdown(toolbar, "並び替え", "created", [
      { value: "created", label: "作成日が新しい順" },
      { value: "updated", label: "更新日が新しい順" },
    ], this.sort, (v) => { this.sort = v as typeof this.sort; this.render(); });
  }

  private renderDropdown(
    parent: HTMLElement,
    label: string,
    defaultValue: string,
    options: { value: string; label: string }[],
    currentValue: string,
    onChange: (value: string) => void,
  ): void {
    const wrapper = parent.createDiv({ cls: "zen-scrap-dropdown" });

    const isDefault = currentValue === defaultValue;
    const displayText = isDefault ? label : options.find((o) => o.value === currentValue)?.label || label;

    const btn = wrapper.createEl("button", { cls: "zen-scrap-dropdown-btn" });
    btn.createSpan({ text: displayText });
    const arrow = btn.createSpan({ cls: "zen-scrap-dropdown-arrow" });
    arrow.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

    const menu = wrapper.createDiv({ cls: "zen-scrap-dropdown-menu" });
    menu.style.display = "none";

    for (const opt of options) {
      const item = menu.createDiv({ cls: "zen-scrap-dropdown-item" });
      item.setText(opt.label);
      if (opt.value === currentValue) {
        item.addClass("zen-scrap-dropdown-item-active");
      }
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.style.display = "none";
        onChange(opt.value);
      });
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = menu.style.display !== "none";
      // 他のドロップダウンを閉じる
      parent.querySelectorAll<HTMLElement>(".zen-scrap-dropdown-menu").forEach((m) => {
        m.style.display = "none";
      });
      menu.style.display = isOpen ? "none" : "";
    });

    // 外側クリックで閉じる
    document.addEventListener("click", () => {
      menu.style.display = "none";
    });
  }

  private async renderList(container: HTMLElement): Promise<void> {
    const scraps = await this.repo.listAll();

    // フィルタリング
    let filtered = scraps.filter((s) => {
      if (this.filter === "all") return !s.archived;
      if (this.filter === "archived") return s.archived;
      return s.status === this.filter && !s.archived;
    });

    // 全文検索
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter((s) => {
        if (s.title.toLowerCase().includes(q)) return true;
        return s.entries.some((e) => e.body.toLowerCase().includes(q));
      });
    }

    // 並び替え
    filtered.sort((a, b) => {
      if (this.sort === "created") {
        return new Date(b.created).getTime() - new Date(a.created).getTime();
      }
      return new Date(b.updated).getTime() - new Date(a.updated).getTime();
    });

    const list = container.createDiv({ cls: "zen-scrap-list" });

    if (filtered.length === 0) {
      list.createDiv({ cls: "zen-scrap-empty", text: "スクラップがありません" });
      return;
    }

    for (const scrap of filtered) {
      const item = list.createDiv({ cls: "zen-scrap-list-item" });

      // 1行目: タイトル + メニューボタン
      const titleRow = item.createDiv({ cls: "zen-scrap-item-title-row" });
      titleRow.createSpan({ text: scrap.title, cls: "zen-scrap-item-title" });
      titleRow.addEventListener("click", () => this.eventBus.emit(EVENTS.SCRAP_SELECT, scrap));

      const menuWrapper = titleRow.createDiv({ cls: "zen-scrap-item-menu" });
      const menuBtn = menuWrapper.createEl("button", { cls: "zen-scrap-item-menu-btn" });
      menuBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>';

      const menu = menuWrapper.createDiv({ cls: "zen-scrap-item-menu-dropdown" });
      menu.style.display = "none";

      const archiveLabel = scrap.archived ? "オープンに戻す" : "アーカイブする";
      const archiveItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: archiveLabel });
      archiveItem.addEventListener("click", async (e) => {
        e.stopPropagation();
        scrap.archived = !scrap.archived;
        await this.repo.save(scrap);
        this.eventBus.emit(EVENTS.SCRAP_CHANGED);
      });

      const deleteItem = menu.createDiv({ cls: "zen-scrap-dropdown-item zen-scrap-dropdown-item-danger", text: "削除する" });
      deleteItem.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm(`「${scrap.title}」を削除しますか？`)) return;
        await this.repo.delete(scrap);
        this.eventBus.emit(EVENTS.SCRAP_CHANGED);
      });

      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display !== "none";
        // 他のメニューを閉じる
        list.querySelectorAll<HTMLElement>(".zen-scrap-item-menu-dropdown").forEach((m) => {
          m.style.display = "none";
        });
        menu.style.display = isOpen ? "none" : "";
      });

      // 2行目: ステータス + 日付情報
      const metaRow = item.createDiv({ cls: "zen-scrap-item-meta" });
      metaRow.addEventListener("click", () => this.eventBus.emit(EVENTS.SCRAP_SELECT, scrap));
      const labelCls = scrap.status === "open" ? "zen-scrap-label-open" : "zen-scrap-label-closed";
      const labelText = scrap.status === "open" ? "Open" : "Closed";
      metaRow.createSpan({ text: labelText, cls: labelCls });
      metaRow.createSpan({ text: formatDate(scrap.created) + "に作成", cls: "zen-scrap-item-time" });
      if (scrap.status === "closed") {
        metaRow.createSpan({ text: " / " + formatDate(scrap.updated) + "にクローズ", cls: "zen-scrap-item-time" });
      }
      metaRow.createSpan({ text: `${scrap.entries.length}件`, cls: "zen-scrap-item-count" });
    }

    // 外側クリックでメニュー閉じる
    document.addEventListener("click", () => {
      list.querySelectorAll<HTMLElement>(".zen-scrap-item-menu-dropdown").forEach((m) => {
        m.style.display = "none";
      });
    });
  }
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
