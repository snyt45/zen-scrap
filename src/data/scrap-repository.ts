import { App, TFile, TFolder, normalizePath } from "obsidian";
import { Scrap } from "./types";
import { parseScrapMarkdown, serializeScrap } from "./scrap-parser";

const SCRAPS_FOLDER = "Scraps";

export class ScrapRepository {
  constructor(private app: App) {}

  async ensureFolder(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(SCRAPS_FOLDER);
    if (!folder) {
      await this.app.vault.createFolder(SCRAPS_FOLDER);
    }
  }

  async listAll(): Promise<Scrap[]> {
    await this.ensureFolder();
    const folder = this.app.vault.getAbstractFileByPath(SCRAPS_FOLDER);
    if (!(folder instanceof TFolder)) return [];

    const scraps: Scrap[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        const content = await this.app.vault.read(child);
        scraps.push(parseScrapMarkdown(content, child.path));
      }
    }

    // updated降順でソート
    scraps.sort((a, b) => (a.updated > b.updated ? -1 : 1));
    return scraps;
  }

  async getByPath(filePath: string): Promise<Scrap | null> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return null;
    const content = await this.app.vault.read(file);
    return parseScrapMarkdown(content, file.path);
  }

  async create(title: string, tags: string[]): Promise<Scrap> {
    await this.ensureFolder();
    const now = new Date().toISOString();
    const scrap: Scrap = {
      title,
      status: "open",
      tags,
      created: now,
      updated: now,
      archived: false,
      entries: [],
      filePath: normalizePath(`${SCRAPS_FOLDER}/${title}.md`),
    };
    await this.app.vault.create(scrap.filePath, serializeScrap(scrap));
    return scrap;
  }

  async addEntry(scrap: Scrap, body: string): Promise<Scrap> {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    scrap.entries.push({ timestamp, body });
    scrap.updated = now.toISOString();
    await this.save(scrap);
    return scrap;
  }

  async save(scrap: Scrap): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(scrap.filePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, serializeScrap(scrap));
    }
  }

  async delete(scrap: Scrap): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(scrap.filePath);
    if (file instanceof TFile) {
      await this.app.vault.trash(file, false);
    }
  }
}
