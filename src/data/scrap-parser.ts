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

  // tags解析: inline "[react, frontend]" またはYAMLブロック形式に対応
  let tags: string[] = [];
  const tagsValue = frontmatter["tags"] || "";
  if (tagsValue.startsWith("[")) {
    // inline形式: tags: [react, frontend]
    tags = tagsValue
      .replace(/[\[\]]/g, "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  } else if (fmMatch) {
    // Obsidianが書き換えるYAMLブロック形式: tags:\n  - react\n  - frontend
    const fmLines = fmMatch[1].split("\n");
    const tagsIdx = fmLines.findIndex((l) => /^tags:\s*$/.test(l));
    if (tagsIdx >= 0) {
      for (let i = tagsIdx + 1; i < fmLines.length; i++) {
        const itemMatch = fmLines[i].match(/^\s+-\s+(.*)/);
        if (!itemMatch) break;
        const val = itemMatch[1].trim().replace(/^["']|["']$/g, "");
        if (val) tags.push(val);
      }
    }
  }

  // エントリ解析
  const bodyStart = fmMatch ? fmMatch[0].length : 0;
  const body = content.slice(bodyStart).trim();
  const entries: ScrapEntry[] = [];

  // タイムスタンプ形式（YYYY-MM-DD HH:MM）の見出しのみをエントリ区切りとする
  const entryRegex = /### (\d{4}-\d{2}-\d{2} \d{2}:\d{2})\n([\s\S]*?)(?=\n---\n\n### \d{4}-\d{2}-\d{2} \d{2}:\d{2}|$)/g;
  let match;
  while ((match = entryRegex.exec(body)) !== null) {
    // 末尾の区切り線 "---" を除去
    const entryBody = match[2].replace(/\n---\s*$/, "").trim();
    entries.push({
      timestamp: match[1].trim(),
      body: entryBody,
    });
  }

  return {
    title: frontmatter["title"] || filePath.replace(/\.md$/, "").split("/").pop() || "",
    status: (frontmatter["status"] as "open" | "closed") || "open",
    tags,
    created: frontmatter["created"] || "",
    updated: frontmatter["updated"] || "",
    archived: frontmatter["archived"] === "true",
    pinned: frontmatter["pinned"] === "true",
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
  lines.push(`pinned: ${scrap.pinned}`);
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
