import { App } from "obsidian";
import { EventBus } from "./event-bus";
import { EVENTS } from "./constants";
import { ScrapRepository } from "../data/scrap-repository";
import { TitlePromptModal } from "../ui/title-prompt-modal";
import { Scrap } from "../data/types";

export function registerScrapHandlers(
  eventBus: EventBus,
  app: App,
  repo: ScrapRepository,
  openScrap: (scrap: Scrap, scrollToEntryIndex?: number) => void
): void {
  eventBus.on(EVENTS.SCRAP_SELECT, (scrap: Scrap, scrollToEntryIndex?: number) => {
    openScrap(scrap, scrollToEntryIndex);
  });

  eventBus.on(EVENTS.SCRAP_CREATE_REQUEST, () => {
    new TitlePromptModal(app, async (title, tags) => {
      if (!title) return;
      const scrap = await repo.create(title, tags);
      openScrap(scrap);
      eventBus.emit(EVENTS.SCRAP_CHANGED);
    }).open();
  });
}
