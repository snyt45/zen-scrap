import { App, TFile, normalizePath } from "obsidian";
import { Collection, CollectionItem } from "./collection-types";
import type { ZenScrapSettings } from "../settings";

export class CollectionRepository {
  constructor(private app: App, private settings: ZenScrapSettings) {}

  private get filePath(): string {
    return normalizePath(`${this.settings.scrapsFolder}/collections.json`);
  }

  private async readAll(): Promise<Collection[]> {
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (!(file instanceof TFile)) return [];
    const content = await this.app.vault.read(file);
    try {
      return JSON.parse(content) as Collection[];
    } catch {
      return [];
    }
  }

  private async writeAll(collections: Collection[]): Promise<void> {
    const content = JSON.stringify(collections, null, 2);
    const file = this.app.vault.getAbstractFileByPath(this.filePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(this.filePath, content);
    }
  }

  async listAll(): Promise<Collection[]> {
    return this.readAll();
  }

  async get(id: string): Promise<Collection | null> {
    const collections = await this.readAll();
    return collections.find((c) => c.id === id) ?? null;
  }

  async create(title: string): Promise<Collection> {
    const now = new Date().toISOString();
    const collection: Collection = {
      id: Date.now().toString(36),
      title,
      items: [],
      created: now,
      updated: now,
    };
    const collections = await this.readAll();
    collections.push(collection);
    await this.writeAll(collections);
    return collection;
  }

  async save(collection: Collection): Promise<void> {
    const collections = await this.readAll();
    const index = collections.findIndex((c) => c.id === collection.id);
    if (index === -1) return;
    collections[index] = collection;
    await this.writeAll(collections);
  }

  async delete(id: string): Promise<void> {
    const collections = await this.readAll();
    const filtered = collections.filter((c) => c.id !== id);
    await this.writeAll(filtered);
  }

  async addItem(
    collectionId: string,
    item: Omit<CollectionItem, "order">
  ): Promise<{ collection: Collection; added: boolean }> {
    const collection = await this.get(collectionId);
    if (!collection) throw new Error(`Collection not found: ${collectionId}`);

    const duplicate = collection.items.some((i) =>
      i.type === item.type &&
      i.scrapPath === item.scrapPath &&
      i.entryTimestamp === item.entryTimestamp
    );
    if (duplicate) return { collection, added: false };

    const maxOrder =
      collection.items.length > 0
        ? Math.max(...collection.items.map((i) => i.order))
        : -1;
    collection.items.push({ ...item, order: maxOrder + 1 });
    collection.updated = new Date().toISOString();
    await this.save(collection);
    return { collection, added: true };
  }

  async removeItem(
    collectionId: string,
    index: number
  ): Promise<Collection> {
    const collection = await this.get(collectionId);
    if (!collection) throw new Error(`Collection not found: ${collectionId}`);
    collection.items.splice(index, 1);
    collection.updated = new Date().toISOString();
    await this.save(collection);
    return collection;
  }

  async reorderItems(
    collectionId: string,
    items: CollectionItem[]
  ): Promise<Collection> {
    const collection = await this.get(collectionId);
    if (!collection) throw new Error(`Collection not found: ${collectionId}`);
    collection.items = items;
    collection.updated = new Date().toISOString();
    await this.save(collection);
    return collection;
  }
}
