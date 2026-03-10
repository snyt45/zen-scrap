import { requestUrl } from "obsidian";

const cache = new Map<string, string>();

export async function renderEmbed(type: string, url: string): Promise<string> {
  const cacheKey = `${type}:${url}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  let html: string;
  try {
    switch (type) {
      case "tweet": html = await renderTweet(url); break;
      case "card": html = await renderOgpCard(url); break;
      case "github": html = await renderGithubEmbed(url); break;
      default: html = fallbackCard(url); break;
    }
  } catch {
    html = fallbackCard(url);
  }

  cache.set(cacheKey, html);
  return html;
}

async function renderTweet(url: string): Promise<string> {
  const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`;
  const res = await requestUrl({ url: oembedUrl });
  if (res.json?.html) {
    return `<div class="zen-scrap-tweet-embed">${res.json.html}</div>`;
  }
  return fallbackCard(url, "X");
}

async function renderOgpCard(url: string): Promise<string> {
  const res = await requestUrl({ url });
  const text = res.text;

  const title = extractMeta(text, "og:title") || extractTitle(text) || url;
  const description = extractMeta(text, "og:description") || extractMeta(text, "description") || "";
  const image = extractMeta(text, "og:image") || "";
  const siteName = extractMeta(text, "og:site_name") || new URL(url).hostname;

  return `<a href="${esc(url)}" target="_blank" class="zen-scrap-ogp-card">
    ${image ? `<div class="zen-scrap-ogp-image-wrapper"><img src="${esc(image)}" /></div>` : ""}
    <div class="zen-scrap-ogp-content">
      <div class="zen-scrap-ogp-title">${esc(title)}</div>
      ${description ? `<div class="zen-scrap-ogp-desc">${esc(truncate(description, 120))}</div>` : ""}
      <div class="zen-scrap-ogp-site">${esc(siteName)}</div>
    </div>
  </a>`;
}

async function renderGithubEmbed(url: string): Promise<string> {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/([^#]+)(?:#L(\d+)(?:-L(\d+))?)?/);
  if (!match) return fallbackCard(url, "GitHub");

  const [, owner, repo, branch, path, startLineStr, endLineStr] = match;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  const res = await requestUrl({ url: rawUrl });
  const lines = res.text.split("\n");

  let displayLines: string[];
  let lineStart = 1;
  if (startLineStr) {
    lineStart = parseInt(startLineStr);
    const lineEnd = endLineStr ? parseInt(endLineStr) : lineStart;
    displayLines = lines.slice(lineStart - 1, lineEnd);
  } else {
    displayLines = lines.slice(0, 30);
  }

  const ext = path.split(".").pop() || "";
  const codeHtml = displayLines.map((line, i) => {
    const num = lineStart + i;
    return `<span class="zen-scrap-gh-line"><span class="zen-scrap-gh-num">${num}</span>${esc(line)}</span>`;
  }).join("\n");

  const label = `${owner}/${repo} - ${path}`;
  const lineLabel = startLineStr ? ` L${startLineStr}${endLineStr ? `-L${endLineStr}` : ""}` : "";

  return `<div class="zen-scrap-github-embed">
    <div class="zen-scrap-github-header">
      <a href="${esc(url)}" target="_blank">${esc(label)}${lineLabel}</a>
    </div>
    <pre class="zen-scrap-github-code"><code>${codeHtml}</code></pre>
  </div>`;
}

function extractMeta(html: string, property: string): string {
  const r1 = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"));
  if (r1) return r1[1];
  const r2 = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i"));
  if (r2) return r2[1];
  return "";
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? m[1].trim() : "";
}

function fallbackCard(url: string, label?: string): string {
  const display = label ? `${label}: ${url}` : url;
  return `<div class="zen-scrap-link-card"><a href="${esc(url)}" target="_blank">${esc(display)}</a></div>`;
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "..." : text;
}
