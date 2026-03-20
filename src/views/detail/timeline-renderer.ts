import { App, Notice } from "obsidian";
import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { CollectionRepository } from "../../data/collection-repository";
import { formatDate } from "../../utils";
import { chevronDownIcon, GRIP_ICON, INBOX_ICON, INBOX_FILLED_ICON } from "../../icons";
import { MarkdownRenderer } from "./markdown-renderer";
import { renderEntryEditor, EntryEditorDeps } from "./input-area-renderer";
import { CollectionPickerModal } from "../../ui/collection-picker-modal";
import { InboxRepository } from "../../data/inbox-repository";
import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";

export interface TimelineDeps {
  scrap: Scrap;
  repo: ScrapRepository;
  collectionRepo: CollectionRepository;
  app: App;
  render: () => Promise<void>;
  markdownRenderer: MarkdownRenderer;
  addDocumentClickHandler: (handler: () => void) => void;
  entryEditorDeps: Omit<EntryEditorDeps, "entryEl" | "entryBody" | "index">;
  inboxRepo: InboxRepository;
  eventBus: EventBus;
  ignoreNextChange: () => void;
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

interface DragScrollHelpers {
  startAutoScroll: (clientY: number) => void;
  stopAutoScroll: () => void;
}

function createDragScrollHelpers(timeline: HTMLElement): DragScrollHelpers {
  const scrollContainer = timeline.closest(".zen-scrap-detail-container") as HTMLElement | null;
  let autoScrollRaf = 0;

  const startAutoScroll = (clientY: number) => {
    cancelAnimationFrame(autoScrollRaf);
    if (!scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    const edgeZone = 60;
    const maxSpeed = 12;

    const tick = () => {
      const top = clientY - rect.top;
      const bottom = rect.bottom - clientY;
      if (top < edgeZone) {
        scrollContainer.scrollTop -= maxSpeed * (1 - top / edgeZone);
      } else if (bottom < edgeZone) {
        scrollContainer.scrollTop += maxSpeed * (1 - bottom / edgeZone);
      }
      autoScrollRaf = requestAnimationFrame(tick);
    };
    autoScrollRaf = requestAnimationFrame(tick);
  };

  const stopAutoScroll = () => cancelAnimationFrame(autoScrollRaf);
  return { startAutoScroll, stopAutoScroll };
}

function createEntryElement(
  timeline: HTMLElement,
  entry: { timestamp: string; body: string },
  i: number,
  deps: TimelineDeps,
  drag: DragScrollHelpers,
): { entryEl: HTMLElement; renderTask: () => Promise<void> } {
  const { scrap, repo, render, markdownRenderer } = deps;
  const entryEl = timeline.createDiv({ cls: "zen-scrap-entry" });

  if (scrap.entries.length > 1) {
    entryEl.dataset.entryIndex = String(i);

    entryEl.addEventListener("dragstart", (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".zen-scrap-drag-handle")) {
        e.preventDefault();
        return;
      }
      entryEl.addClass("zen-scrap-entry-dragging");
      e.dataTransfer!.effectAllowed = "move";
      e.dataTransfer!.setData("text/plain", String(i));
    });

    entryEl.addEventListener("dragend", () => {
      entryEl.removeClass("zen-scrap-entry-dragging");
      drag.stopAutoScroll();
      timeline.querySelectorAll(".zen-scrap-entry-dragover").forEach((el) => {
        el.removeClass("zen-scrap-entry-dragover");
      });
    });

    entryEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
      drag.startAutoScroll(e.clientY);
      if (!entryEl.hasClass("zen-scrap-entry-dragging")) {
        entryEl.addClass("zen-scrap-entry-dragover");
      }
    });

    entryEl.addEventListener("dragleave", () => {
      entryEl.removeClass("zen-scrap-entry-dragover");
    });

    entryEl.addEventListener("drop", async (e) => {
      e.preventDefault();
      drag.stopAutoScroll();
      entryEl.removeClass("zen-scrap-entry-dragover");
      const fromIndex = Number(e.dataTransfer!.getData("text/plain"));
      const toIndex = i;
      if (fromIndex === toIndex) return;

      const [moved] = scrap.entries.splice(fromIndex, 1);
      scrap.entries.splice(toIndex, 0, moved);
      scrap.updated = new Date().toISOString();
      await repo.save(scrap);
      await render();
    });
  }

  const entryHeader = entryEl.createDiv({ cls: "zen-scrap-entry-header" });

  if (scrap.entries.length > 1) {
    const handle = entryHeader.createEl("button", { cls: "zen-scrap-drag-handle" });
    handle.innerHTML = GRIP_ICON;
    handle.setAttribute("draggable", "true");
    handle.addEventListener("dragstart", (e) => {
      entryEl.dispatchEvent(new DragEvent("dragstart", {
        dataTransfer: e.dataTransfer,
        bubbles: true,
      }));
    });
  }

  entryHeader.createSpan({ text: entry.timestamp, cls: "zen-scrap-entry-time" });

  const inboxBtn = entryHeader.createEl("button", {
    cls: "zen-scrap-inbox-btn",
  });
  inboxBtn.innerHTML = INBOX_ICON;
  inboxBtn.setAttribute("aria-label", "Inboxに追加");
  inboxBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const currentlyInInbox = await deps.inboxRepo.has(scrap.filePath, entry.timestamp);
    if (currentlyInInbox) {
      await deps.inboxRepo.remove(scrap.filePath, entry.timestamp);
      inboxBtn.removeClass("is-active");
      inboxBtn.innerHTML = INBOX_ICON;
      inboxBtn.setAttribute("aria-label", "Inboxに追加");
    } else {
      await deps.inboxRepo.add(scrap.filePath, entry.timestamp);
      inboxBtn.addClass("is-active");
      inboxBtn.innerHTML = INBOX_FILLED_ICON;
      inboxBtn.setAttribute("aria-label", "Inboxから削除");
    }
    deps.eventBus.emit(EVENTS.INBOX_CHANGED);
  });

  const menuWrapper = entryHeader.createDiv({ cls: "zen-scrap-entry-menu" });
  const menuBtn = menuWrapper.createEl("button", { cls: "zen-scrap-entry-menu-btn" });
  menuBtn.innerHTML = chevronDownIcon(18);

  const entryBody = entryEl.createDiv({ cls: "zen-scrap-entry-body znc" });

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".zen-scrap-entry-menu-portal").forEach((m) => m.remove());

    const menu = document.createElement("div");
    menu.className = "zen-scrap-item-menu-dropdown zen-scrap-entry-menu-portal";
    menu.style.position = "fixed";
    menu.style.zIndex = "1000";

    const items: { text: string; cls?: string; handler: () => void }[] = [
      { text: "コピー", handler: async () => { await navigator.clipboard.writeText(entry.body); new Notice("セクションをコピーしました"); } },
      { text: "コレクションに追加", handler: () => { new CollectionPickerModal(deps.app, deps.collectionRepo, async (collectionId) => { const { added } = await deps.collectionRepo.addItem(collectionId, { type: "entry", scrapPath: scrap.filePath, entryTimestamp: entry.timestamp }); new Notice(added ? "コレクションに追加しました" : "すでに追加済みです"); }).open(); } },
      { text: "編集", handler: () => { renderEntryEditor({ ...deps.entryEditorDeps, entryEl, entryBody, index: i, ignoreNextChange: deps.ignoreNextChange }); } },
      { text: "削除", cls: "zen-scrap-dropdown-item-danger", handler: async () => { if (!confirm("このセクションを削除しますか？")) return; scrap.entries.splice(i, 1); scrap.updated = new Date().toISOString(); deps.ignoreNextChange(); await repo.save(scrap); entryEl.remove(); } },
    ];
    for (const item of items) {
      const el = document.createElement("div");
      el.className = "zen-scrap-dropdown-item" + (item.cls ? ` ${item.cls}` : "");
      el.textContent = item.text;
      el.addEventListener("click", (ev) => { ev.stopPropagation(); menu.remove(); item.handler(); });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);

    const rect = menuBtn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;

    requestAnimationFrame(() => menu.classList.add("is-open"));

    const onClickOutside = () => { menu.remove(); document.removeEventListener("click", onClickOutside); };
    document.addEventListener("click", onClickOutside);
  });

  const renderTask = async () => {
    entryBody.innerHTML = await markdownRenderer.renderBody(entry.body);
    markdownRenderer.addCopyButtons(entryBody);
    markdownRenderer.addLinkHandler(entryBody);

    const checkboxes = entryBody.querySelectorAll<HTMLInputElement>("input[type=\"checkbox\"]");
    checkboxes.forEach((cb, cbIndex) => {
      cb.disabled = false;
      cb.style.cursor = "pointer";
      cb.addEventListener("click", async (e) => {
        e.stopPropagation();
        const checked = cb.checked;
        let count = 0;
        entry.body = entry.body.replace(/- \[([ xX])\]/g, (match, state) => {
          if (count++ !== cbIndex) return match;
          return checked ? "- [x]" : "- [ ]";
        });
        deps.ignoreNextChange();
        await repo.save(scrap);
      });
    });

    const inInbox = await deps.inboxRepo.has(scrap.filePath, entry.timestamp);
    if (inInbox) {
      inboxBtn.addClass("is-active");
      inboxBtn.innerHTML = INBOX_FILLED_ICON;
      inboxBtn.setAttribute("aria-label", "Inboxから削除");
    }
  };

  return { entryEl, renderTask };
}

export async function renderTimeline(container: HTMLElement, deps: TimelineDeps): Promise<void> {
  const { scrap } = deps;
  const timeline = container.createDiv({ cls: "zen-scrap-timeline" });

  if (scrap.entries.length === 0) {
    const emptyCard = timeline.createDiv({ cls: "zen-scrap-empty-state" });
    emptyCard.setText("最初のコメントを追加しましょう");
    return;
  }

  const drag = createDragScrollHelpers(timeline);
  const entriesToRender = scrap.entries.map((e, i) => ({ entry: e, originalIndex: i }));

  const results = entriesToRender.map(({ entry, originalIndex }) =>
    createEntryElement(timeline, entry, originalIndex, deps, drag)
  );

  await Promise.all(results.map((r) => r.renderTask()));
}

export async function appendEntryToTimeline(
  container: HTMLElement,
  entry: { timestamp: string; body: string },
  index: number,
  deps: TimelineDeps,
): Promise<HTMLElement> {
  let timeline = container.querySelector(".zen-scrap-timeline") as HTMLElement | null;
  if (!timeline) {
    timeline = container.createDiv({ cls: "zen-scrap-timeline" });
  }

  const emptyState = timeline.querySelector(".zen-scrap-empty-state");
  if (emptyState) emptyState.remove();

  // inputAreaの前に挿入
  const inputArea = container.querySelector(".zen-scrap-input-area");
  if (inputArea && timeline.parentElement === container) {
    container.insertBefore(timeline, inputArea);
  }

  const drag = createDragScrollHelpers(timeline);
  const { entryEl, renderTask } = createEntryElement(timeline, entry, index, deps, drag);
  await renderTask();
  return entryEl;
}
