import { EventBus } from "../../events/event-bus";
import { EVENTS } from "../../events/constants";
import { OUTLINE_ICON, BOOKMARK_FILLED_ICON } from "../../icons";

export type ActiveTab = "list" | "marked" | "none";

export interface TabNavDeps {
  eventBus: EventBus;
  activeTab: ActiveTab;
  onNewScrap?: () => void;
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

  if (deps.onNewScrap) {
    const navRight = nav.createDiv({ cls: "zen-scrap-tab-nav-right" });
    const newBtn = navRight.createEl("button", { text: "+ 新規作成", cls: "zen-scrap-new-btn" });
    newBtn.addEventListener("click", () => deps.onNewScrap!());
  }
}
