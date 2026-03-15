export interface CollectionItem {
  type: "scrap" | "entry";
  scrapPath: string;
  entryTimestamp?: string;
  order: number;
}

export interface Collection {
  id: string;
  title: string;
  items: CollectionItem[];
  created: string;
  updated: string;
}
