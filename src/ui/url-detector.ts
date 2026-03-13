import { EmbedType } from "./embed-modal";

const YOUTUBE_PATTERNS = [
  /youtu\.be\/([^?&]+)/,
  /youtube\.com\/watch\?v=([^&]+)/,
  /youtube\.com\/embed\/([^?&]+)/,
];

const TWITTER_PATTERN = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/;
const GITHUB_BLOB_PATTERN = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/blob\//;

export function detectEmbedType(url: string): EmbedType | null {
  if (YOUTUBE_PATTERNS.some((p) => p.test(url))) return "youtube";
  if (TWITTER_PATTERN.test(url)) return "tweet";
  if (GITHUB_BLOB_PATTERN.test(url)) return "github";
  if (/^https?:\/\//.test(url)) return "card";
  return null;
}

export function extractYouTubeId(url: string): string {
  for (const p of YOUTUBE_PATTERNS) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return url;
}

export function buildEmbedSyntax(url: string, type: EmbedType): string {
  if (type === "youtube") {
    return `@[youtube](${extractYouTubeId(url)})`;
  }
  return `@[${type}](${url})`;
}
