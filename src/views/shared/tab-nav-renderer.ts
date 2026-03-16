import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";
import { OUTLINE_ICON, INBOX_ICON, COLLECTION_ICON } from "../../icons";

export type ActiveTab = "list" | "inbox" | "collection" | "none";

export interface TabNavDeps {
  eventBus: EventBus;
  activeTab: ActiveTab;
  inboxCount?: number;
}

export function renderTabNav(container: HTMLElement, deps: TabNavDeps): void {
  const nav = container.createDiv({ cls: "zen-scrap-tab-nav" });

  const tabs = nav.createDiv({ cls: "zen-scrap-tab-nav-tabs" });

  const listTab = tabs.createEl("button", {
    cls: `zen-scrap-tab${deps.activeTab === "list" ? " is-active" : ""}`,
  });
  listTab.innerHTML = `${OUTLINE_ICON}<span>一覧</span>`;
  listTab.addEventListener("click", () => {
    if (deps.activeTab !== "list") {
      deps.eventBus.emit(EVENTS.NAV_BACK_TO_LIST);
    }
  });

  const inboxTab = tabs.createEl("button", {
    cls: `zen-scrap-tab${deps.activeTab === "inbox" ? " is-active" : ""}`,
  });
  const badgeHtml = deps.inboxCount && deps.inboxCount > 0
    ? `<span class="zen-scrap-inbox-badge">${deps.inboxCount}</span>`
    : "";
  inboxTab.innerHTML = `${INBOX_ICON}<span>Inbox</span>${badgeHtml}`;
  inboxTab.addEventListener("click", () => {
    if (deps.activeTab !== "inbox") {
      deps.eventBus.emit(EVENTS.NAV_TO_INBOX_LIST);
    }
  });

  const collectionTab = tabs.createEl("button", {
    cls: `zen-scrap-tab${deps.activeTab === "collection" ? " is-active" : ""}`,
  });
  collectionTab.innerHTML = `${COLLECTION_ICON}<span>コレクション</span>`;
  collectionTab.addEventListener("click", () => {
    if (deps.activeTab !== "collection") {
      deps.eventBus.emit(EVENTS.NAV_TO_COLLECTION_LIST);
    }
  });
}
