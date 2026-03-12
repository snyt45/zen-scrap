import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { formatDate } from "../../utils";
import { chevronDownIcon } from "../../icons";
import { MarkdownRenderer } from "./markdown-renderer";
import { renderEntryEditor, EntryEditorDeps } from "./input-area-renderer";

export interface TimelineDeps {
  scrap: Scrap;
  repo: ScrapRepository;
  render: () => Promise<void>;
  markdownRenderer: MarkdownRenderer;
  addDocumentClickHandler: (handler: () => void) => void;
  entryEditorDeps: Omit<EntryEditorDeps, "entryEl" | "entryBody" | "index">;
}

export function renderClosedBanner(container: HTMLElement, scrap: Scrap): void {
  const banner = container.createDiv({ cls: "zen-scrap-closed-banner" });
  const icon = banner.createEl("div", { cls: "zen-scrap-closed-icon" });
  icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
  banner.createEl("div", {
    text: `このスクラップは${formatDate(scrap.updated)}にクローズされました`,
    cls: "zen-scrap-closed-text",
  });
}

export async function renderTimeline(container: HTMLElement, deps: TimelineDeps): Promise<void> {
  const { scrap, repo, render, markdownRenderer, addDocumentClickHandler } = deps;
  const timeline = container.createDiv({ cls: "zen-scrap-timeline" });

  if (scrap.entries.length === 0) {
    const emptyCard = timeline.createDiv({ cls: "zen-scrap-empty-state" });
    emptyCard.setText("最初のコメントを追加しましょう");
    return;
  }

  for (let i = 0; i < scrap.entries.length; i++) {
    const entry = scrap.entries[i];
    const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

    const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });
    entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

    const menuWrapper = entryHeader.createDiv({ cls: "zen-scrap-entry-menu" });
    const menuBtn = menuWrapper.createEl("button", { cls: "zen-scrap-entry-menu-btn" });
    menuBtn.innerHTML = chevronDownIcon(18);

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
    entryBody.innerHTML = await markdownRenderer.renderBody(entry.body);
    markdownRenderer.addCopyButtons(entryBody);

    editItem.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.style.display = "none";
      renderEntryEditor({ ...deps.entryEditorDeps, entryEl, entryBody, index: i });
    });

    deleteItem.addEventListener("click", async (e) => {
      e.stopPropagation();
      menu.style.display = "none";
      scrap.entries.splice(i, 1);
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await render();
    });
  }

  const closeEntryMenus = () => {
    timeline.querySelectorAll<HTMLElement>(".zen-scrap-entry-menu-dropdown").forEach((m) => {
      m.style.display = "none";
    });
  };
  addDocumentClickHandler(closeEntryMenus);
}
