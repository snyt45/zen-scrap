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
  openScrap: (scrap: Scrap) => void
): void {
  eventBus.on(EVENTS.SCRAP_SELECT, (scrap: Scrap) => {
    openScrap(scrap);
  });

  eventBus.on(EVENTS.SCRAP_CREATE_REQUEST, async () => {
    const title = await new TitlePromptModal(app).prompt();
    if (!title) return;
    const scrap = await repo.create(title, []);
    openScrap(scrap);
    eventBus.emit(EVENTS.SCRAP_CHANGED);
  });
}
