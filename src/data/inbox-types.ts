export interface InboxItem {
  scrapPath: string;
  entryTimestamp: string;
  addedAt: string; // ISO 8601
}

export interface InboxData {
  items: InboxItem[];
}
