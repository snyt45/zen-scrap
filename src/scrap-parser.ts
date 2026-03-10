import { Scrap, ScrapEntry } from "./types";

export function parseScrapMarkdown(content: string, filePath: string): Scrap {
  // Frontmatter解析
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter: Record<string, string> = {};
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();
        frontmatter[key] = value;
      }
    }
  }

  // tags解析: "[react, frontend]" → ["react", "frontend"]
  const tagsStr = frontmatter["tags"] || "[]";
  const tags = tagsStr
    .replace(/[\[\]]/g, "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // エントリ解析
  const bodyStart = fmMatch ? fmMatch[0].length : 0;
  const body = content.slice(bodyStart).trim();
  const entries: ScrapEntry[] = [];

  const entryRegex = /### (.+)\n([\s\S]*?)(?=\n---|\n### |$)/g;
  let match;
  while ((match = entryRegex.exec(body)) !== null) {
    entries.push({
      timestamp: match[1].trim(),
      body: match[2].trim(),
    });
  }

  return {
    title: frontmatter["title"] || filePath.replace(/\.md$/, "").split("/").pop() || "",
    status: (frontmatter["status"] as "open" | "closed") || "open",
    tags,
    created: frontmatter["created"] || "",
    updated: frontmatter["updated"] || "",
    archived: frontmatter["archived"] === "true",
    entries,
    filePath,
  };
}

export function serializeScrap(scrap: Scrap): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push(`title: ${scrap.title}`);
  lines.push(`status: ${scrap.status}`);
  lines.push(`tags: [${scrap.tags.join(", ")}]`);
  lines.push(`created: ${scrap.created}`);
  lines.push(`updated: ${scrap.updated}`);
  lines.push(`archived: ${scrap.archived}`);
  lines.push("---");
  lines.push("");

  for (const entry of scrap.entries) {
    lines.push(`### ${entry.timestamp}`);
    lines.push("");
    lines.push(entry.body);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
