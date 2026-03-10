export interface ScrapEntry {
  timestamp: string; // "2026-03-10 14:30" 形式
  body: string;
}

export interface Scrap {
  title: string;
  status: "open" | "closed";
  tags: string[];
  created: string; // ISO 8601
  updated: string; // ISO 8601
  archived: boolean;
  entries: ScrapEntry[];
  filePath: string; // vault内のパス
}
