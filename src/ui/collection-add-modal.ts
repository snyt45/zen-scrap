import { App, Modal } from "obsidian";
import { ScrapRepository } from "../data/scrap-repository";
import { Scrap } from "../data/types";

export interface CollectionAddItem {
  type: "scrap" | "entry";
  scrapPath: string;
  entryTimestamp?: string;
}

export class CollectionAddModal extends Modal {
  private repo: ScrapRepository;
  private onAdd: (item: CollectionAddItem) => void;
  private mode: "scrap" | "entry" = "scrap";
  private searchQuery = "";
  private allScraps: Scrap[] = [];
  private selectedScrap: Scrap | null = null;

  constructor(app: App, repo: ScrapRepository, onAdd: (item: CollectionAddItem) => void) {
    super(app);
    this.repo = repo;
    this.onAdd = onAdd;
  }

  async onOpen() {
    this.modalEl.addClass("zen-scrap-collection-add-modal");
    this.titleEl.setText("コレクションに追加");
    this.allScraps = await this.repo.listAll();
    this.renderContent();
  }

  onClose() {
    this.contentEl.empty();
  }

  private renderContent() {
    this.contentEl.empty();

    // 検索入力欄
    const input = this.contentEl.createEl("input", {
      type: "text",
      placeholder: "スクラップを検索...",
      cls: "zen-scrap-collection-add-search",
    });
    input.value = this.searchQuery;

    let composing = false;
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => {
      composing = false;
      this.searchQuery = input.value;
      this.renderList();
    });
    input.addEventListener("input", () => {
      if (composing) return;
      this.searchQuery = input.value;
      this.renderList();
    });

    // モード切り替え（pill tabs）
    const tabHeader = this.contentEl.createDiv({ cls: "zen-scrap-pill-tabs" });
    const scrapTab = tabHeader.createEl("button", {
      text: "スクラップ全体を追加",
      cls: `zen-scrap-pill-tab${this.mode === "scrap" ? " zen-scrap-pill-tab-active" : ""}`,
    });
    const entryTab = tabHeader.createEl("button", {
      text: "エントリを選んで追加",
      cls: `zen-scrap-pill-tab${this.mode === "entry" ? " zen-scrap-pill-tab-active" : ""}`,
    });

    scrapTab.addEventListener("click", () => {
      this.mode = "scrap";
      this.selectedScrap = null;
      scrapTab.addClass("zen-scrap-pill-tab-active");
      entryTab.removeClass("zen-scrap-pill-tab-active");
      this.renderList();
    });
    entryTab.addEventListener("click", () => {
      this.mode = "entry";
      this.selectedScrap = null;
      entryTab.addClass("zen-scrap-pill-tab-active");
      scrapTab.removeClass("zen-scrap-pill-tab-active");
      this.renderList();
    });

    // リスト表示エリア
    this.contentEl.createDiv({ cls: "zen-scrap-collection-add-list" });
    this.renderList();
    input.focus();
  }

  private renderList() {
    const listEl = this.contentEl.querySelector(".zen-scrap-collection-add-list") as HTMLElement;
    if (!listEl) return;
    listEl.empty();

    // エントリモードで特定スクラップが選択されている場合はエントリ一覧を表示
    if (this.mode === "entry" && this.selectedScrap) {
      this.renderEntryList(listEl, this.selectedScrap);
      return;
    }

    // スクラップ一覧
    const query = this.searchQuery.toLowerCase();
    const filtered = query
      ? this.allScraps.filter((s) => s.title.toLowerCase().includes(query))
      : this.allScraps;

    if (filtered.length === 0) {
      listEl.createDiv({ cls: "zen-scrap-empty", text: "該当するスクラップがありません" });
      return;
    }

    for (const scrap of filtered) {
      const row = listEl.createDiv({ cls: "zen-scrap-collection-add-item" });
      row.createDiv({ text: scrap.title, cls: "zen-scrap-collection-add-item-title" });

      row.addEventListener("click", () => {
        if (this.mode === "scrap") {
          this.onAdd({ type: "scrap", scrapPath: scrap.filePath });
          this.close();
        } else {
          this.selectedScrap = scrap;
          this.renderList();
        }
      });
    }
  }

  private renderEntryList(listEl: HTMLElement, scrap: Scrap) {
    // 戻るリンク
    const backLink = listEl.createDiv({ cls: "zen-scrap-collection-add-back" });
    const backBtn = backLink.createEl("a", { text: "\u2190 スクラップ一覧に戻る" });
    backBtn.addEventListener("click", () => {
      this.selectedScrap = null;
      this.renderList();
    });

    listEl.createDiv({ text: scrap.title, cls: "zen-scrap-collection-add-scrap-name" });

    if (scrap.entries.length === 0) {
      listEl.createDiv({ cls: "zen-scrap-empty", text: "エントリがありません" });
      return;
    }

    for (const entry of scrap.entries) {
      const row = listEl.createDiv({ cls: "zen-scrap-collection-add-item" });
      row.createDiv({ text: entry.timestamp, cls: "zen-scrap-collection-add-item-timestamp" });

      const stripped = entry.body
        .replace(/[#*`>\-\[\]()!]/g, "")
        .replace(/\n/g, " ")
        .trim()
        .slice(0, 120);
      const preview = stripped + (entry.body.length > 120 ? "..." : "");
      row.createDiv({ text: preview, cls: "zen-scrap-collection-add-item-preview" });

      row.addEventListener("click", () => {
        this.onAdd({ type: "entry", scrapPath: scrap.filePath, entryTimestamp: entry.timestamp });
        this.close();
      });
    }
  }
}
