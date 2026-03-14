import { EventBus } from "./event-bus";
import { EVENTS } from "./constants";

export function registerNavHandlers(
  eventBus: EventBus,
  activateListView: () => void,
  openMarkedList: () => void
): void {
  eventBus.on(EVENTS.NAV_BACK_TO_LIST, () => {
    activateListView();
  });
  eventBus.on(EVENTS.NAV_TO_MARKED_LIST, () => {
    openMarkedList();
  });
}
