import { EventBus } from "./event-bus";
import { EVENTS } from "./constants";

export function registerNavHandlers(
  eventBus: EventBus,
  activateListView: () => void,
  openInboxList: () => void,
  openCollectionList: () => void,
  openCollectionDetail: (id: string) => void
): void {
  eventBus.on(EVENTS.NAV_BACK_TO_LIST, () => {
    activateListView();
  });
  eventBus.on(EVENTS.NAV_TO_INBOX_LIST, () => {
    openInboxList();
  });
  eventBus.on(EVENTS.NAV_TO_COLLECTION_LIST, () => {
    openCollectionList();
  });
  eventBus.on(EVENTS.NAV_TO_COLLECTION_DETAIL, (id: string) => {
    openCollectionDetail(id);
  });
}
