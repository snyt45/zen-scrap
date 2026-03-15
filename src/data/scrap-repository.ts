import { App, TFile, TFolder, normalizePath } from "obsidian";
import { Scrap } from "./types";
import { parseScrapMarkdown, serializeScrap } from "./scrap-parser";
import type { ZenScrapSettings } from "../settings";

export class ScrapRepository {
  constructor(private app: App, private settings: ZenScrapSettings) {}

  private get folder(): string {
    return this.settings.scrapsFolder;
  }

  async ensureFolder(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(this.folder);
    if (!folder) {
      await this.app.vault.createFolder(this.folder);
    }
  }

  async listAll(): Promise<Scrap[]> {
    await this.ensureFolder();
    const folder = this.app.vault.getAbstractFileByPath(this.folder);
    if (!(folder instanceof TFolder)) return [];

    const scraps: Scrap[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        const content = await this.app.vault.read(child);
        const scrap = parseScrapMarkdown(content, child.path);
        scraps.push(scrap);
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
    const scrap = parseScrapMarkdown(content, file.path);
    return scrap;
  }

  async create(title: string, tags: string[]): Promise<Scrap> {
    await this.ensureFolder();
    const now = new Date().toISOString();
    const scrap: Scrap = {
      title,
      description: "",
      status: "open",
      tags,
      created: now,
      updated: now,
      archived: false,
      pinned: false,
      entries: [],
      filePath: normalizePath(`${this.folder}/${title}.md`),
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
      const content = serializeScrap(scrap);
      await this.app.vault.modify(file, content);
    }
  }

  async delete(scrap: Scrap): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(scrap.filePath);
    if (file instanceof TFile) {
      await this.app.vault.trash(file, false);
    }
  }

}
