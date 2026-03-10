import { EventBus } from "./event-bus";
import { EVENTS } from "./constants";

export function registerNavHandlers(
  eventBus: EventBus,
  activateListView: () => void
): void {
  eventBus.on(EVENTS.NAV_BACK_TO_LIST, () => {
    activateListView();
  });
}
