import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";
import { OUTLINE_ICON, BOOKMARK_FILLED_ICON, COLLECTION_ICON } from "../../icons";

export type ActiveTab = "list" | "marked" | "collection" | "none";

export interface TabNavDeps {
  eventBus: EventBus;
  activeTab: ActiveTab;
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

  const markedTab = tabs.createEl("button", {
    cls: `zen-scrap-tab${deps.activeTab === "marked" ? " is-active" : ""}`,
  });
  markedTab.innerHTML = `${BOOKMARK_FILLED_ICON}<span>マーク</span>`;
  markedTab.addEventListener("click", () => {
    if (deps.activeTab !== "marked") {
      deps.eventBus.emit(EVENTS.NAV_TO_MARKED_LIST);
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
