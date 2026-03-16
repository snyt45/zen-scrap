import { App, TFile, normalizePath } from "obsidian";
import { InboxItem, InboxData } from "./inbox-types";
import type { ZenScrapSettings } from "../settings";

export class InboxRepository {
  constructor(private app: App, private settings: ZenScrapSettings) {}

  private get filePath(): string {
    return normalizePath(`${this.settings.scrapsFolder}/inbox.json`);
  }

  private async read(): Promise<InboxData> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return { items: [] };
    const content = await this.app.vault.read(file);
    try {
      return JSON.parse(content) as InboxData;
    } catch {
      return { items: [] };
    }
  }

  private async write(data: InboxData): Promise<void> {
    const content = JSON.stringify(data, null, 2);
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(this.filePath, content);
    }
  }

  async listAll(): Promise<InboxItem[]> {
    const data = await this.read();
    return data.items;
  }

  async add(scrapPath: string, entryTimestamp: string): Promise<boolean> {
    const data = await this.read();
    const duplicate = data.items.some(
      (i) => i.scrapPath === scrapPath && i.entryTimestamp === entryTimestamp
    );
    if (duplicate) return false;
    data.items.push({
      scrapPath,
      entryTimestamp,
      addedAt: new Date().toISOString(),
    });
    await this.write(data);
    return true;
  }

  async remove(scrapPath: string, entryTimestamp: string): Promise<void> {
    const data = await this.read();
    data.items = data.items.filter(
      (i) => !(i.scrapPath === scrapPath && i.entryTimestamp === entryTimestamp)
    );
    await this.write(data);
  }

  async has(scrapPath: string, entryTimestamp: string): Promise<boolean> {
    const data = await this.read();
    return data.items.some(
      (i) => i.scrapPath === scrapPath && i.entryTimestamp === entryTimestamp
    );
  }

  async count(): Promise<number> {
    const data = await this.read();
    return data.items.length;
  }
}
