import { Scrap } from "../../data/types";
import { ScrapRepository } from "../../data/scrap-repository";
import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";
import { formatDate, daysAgo } from "../../utils";
import { chevronDownIcon, PIN_ICON } from "../../icons";

export interface ListItemDeps {
  repo: ScrapRepository;
  eventBus: EventBus;
  onTagClick?: (tag: string) => void;
}

export function renderListItem(parent: HTMLElement, scrap: Scrap, deps: ListItemDeps): void {
  const { repo, eventBus } = deps;
  const item = parent.createDiv({ cls: "zen-scrap-list-item" });

  item.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest(".zen-scrap-item-menu") || target.closest(".zen-scrap-tag")) return;
    eventBus.emit(EVENTS.SCRAP_SELECT, scrap);
  });

  // 1行目: タイトル + メニューボタン
  const titleRow = item.createDiv({ cls: "zen-scrap-item-title-row" });
  if (scrap.pinned) {
    const pinIcon = titleRow.createSpan({ cls: "zen-scrap-pin-icon" });
    pinIcon.innerHTML = PIN_ICON;
  }
  titleRow.createSpan({ text: scrap.title, cls: "zen-scrap-item-title" });
  const menuWrapper = titleRow.createDiv({ cls: "zen-scrap-item-menu" });
  const menuBtn = menuWrapper.createEl("button", { cls: "zen-scrap-item-menu-btn" });
  menuBtn.innerHTML = chevronDownIcon(20, 2.5);

  const menu = menuWrapper.createDiv({ cls: "zen-scrap-item-menu-dropdown" });

  const pinLabel = scrap.pinned ? "ピン解除" : "ピン留め";
  const pinItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: pinLabel });
  pinItem.addEventListener("click", async (e) => {
    e.stopPropagation();
    const fresh = await repo.getByPath(scrap.filePath);
    if (!fresh) return;
    fresh.pinned = !fresh.pinned;
    fresh.updated = new Date().toISOString();
    await repo.save(fresh);
    eventBus.emit(EVENTS.SCRAP_CHANGED);
  });

  const archiveLabel = scrap.archived ? "オープンに戻す" : "アーカイブする";
  const archiveItem = menu.createDiv({ cls: "zen-scrap-dropdown-item", text: archiveLabel });
  archiveItem.addEventListener("click", async (e) => {
    e.stopPropagation();
    const fresh = await repo.getByPath(scrap.filePath);
    if (!fresh) return;
    fresh.archived = !fresh.archived;
    await repo.save(fresh);
    eventBus.emit(EVENTS.SCRAP_CHANGED);
  });

  const deleteItem = menu.createDiv({ cls: "zen-scrap-dropdown-item zen-scrap-dropdown-item-danger", text: "削除する" });
  deleteItem.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!confirm(`「${scrap.title}」を削除しますか？`)) return;
    await repo.delete(scrap);
    eventBus.emit(EVENTS.SCRAP_CHANGED);
  });

  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = menu.classList.contains("is-open");
    parent.querySelectorAll<HTMLElement>(".zen-scrap-item-menu-dropdown").forEach((m) => {
      m.classList.remove("is-open");
    });
    if (!isOpen) menu.classList.add("is-open");
  });

  // 2行目: ステータス + 日付情報
  const metaRow = item.createDiv({ cls: "zen-scrap-item-meta" });
  const labelCls = scrap.archived ? "zen-scrap-label-archived" : scrap.status === "open" ? "zen-scrap-label-open" : "zen-scrap-label-closed";
  const labelText = scrap.archived ? "Archived" : scrap.status === "open" ? "Open" : "Closed";
  metaRow.createSpan({ text: labelText, cls: labelCls });
  metaRow.createSpan({ text: formatDate(scrap.created) + "に作成", cls: "zen-scrap-item-time" });
  if (scrap.status === "closed") {
    metaRow.createSpan({ text: " / " + formatDate(scrap.updated) + "にクローズ", cls: "zen-scrap-item-time" });
  }
  metaRow.createSpan({ text: `${scrap.entries.length}件`, cls: "zen-scrap-item-count" });
  metaRow.createSpan({ text: daysAgo(scrap.updated), cls: "zen-scrap-item-ago" });

  // 3行目: タグ
  if (scrap.tags.length > 0) {
    const tagRow = item.createDiv({ cls: "zen-scrap-item-tags" });
    for (const tag of scrap.tags) {
      const pill = tagRow.createSpan({ text: tag, cls: "zen-scrap-tag" });
      pill.addEventListener("click", (e) => {
        e.stopPropagation();
        deps.onTagClick?.(tag);
      });
    }
  }
}
