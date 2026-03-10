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
  // URLからユーザー名とステータスIDを抽出
  const match = url.match(/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/);
  if (!match) return fallbackCard(url, "X");

  const [, username, statusId] = match;
  const apiUrl = `https://api.fxtwitter.com/${username}/status/${statusId}`;
  const res = await requestUrl({ url: apiUrl });
  const tweet = res.json?.tweet;
  if (!tweet) return fallbackCard(url, "X");

  const avatarHtml = tweet.author?.avatar_url
    ? `<img src="${esc(tweet.author.avatar_url)}" class="zen-scrap-tweet-avatar" />`
    : "";
  const name = tweet.author?.name || username;
  const handle = tweet.author?.screen_name || username;
  const text = esc(tweet.text || "").replace(/\n/g, "<br>");
  const date = tweet.created_at ? formatTweetDate(tweet.created_at) : "";

  // メディア（画像）
  let mediaHtml = "";
  if (tweet.media?.photos?.length) {
    const photo = tweet.media.photos[0];
    mediaHtml = `<img src="${esc(photo.url)}" class="zen-scrap-tweet-media" />`;
  }

  return `<div class="zen-scrap-tweet-card">
    <div class="zen-scrap-tweet-header">
      ${avatarHtml}
      <div class="zen-scrap-tweet-author">
        <span class="zen-scrap-tweet-name">${esc(name)}</span>
        <span class="zen-scrap-tweet-handle">@${esc(handle)}</span>
      </div>
      <svg class="zen-scrap-tweet-logo" viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    </div>
    <div class="zen-scrap-tweet-text">${text}</div>
    ${mediaHtml}
    ${date ? `<div class="zen-scrap-tweet-date">${esc(date)}</div>` : ""}
    <a href="${esc(url)}" target="_blank" class="zen-scrap-tweet-link">ポストを表示</a>
  </div>`;
}

function formatTweetDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${day}日 ${h}:${min}`;
}

async function renderOgpCard(url: string): Promise<string> {
  const res = await requestUrl({ url });
  const text = res.text;

  const title = extractMeta(text, "og:title") || extractTitle(text) || url;
  const description = extractMeta(text, "og:description") || extractMeta(text, "description") || "";
  let image = extractMeta(text, "og:image") || "";
  const siteName = extractMeta(text, "og:site_name") || new URL(url).hostname;

  // 画像が読み込めるかチェック（相対パスや壊れたURLは除外）
  let imageHtml = "";
  if (image && image.startsWith("http")) {
    try {
      await requestUrl({ url: image, method: "HEAD" });
      imageHtml = `<div class="zen-scrap-ogp-image-wrapper"><img src="${esc(image)}" /></div>`;
    } catch {
      // 画像が取得できなければ非表示
    }
  }

  return `<a href="${esc(url)}" target="_blank" class="zen-scrap-ogp-card">
    ${imageHtml}
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

  const codeRows = displayLines.map((line, i) => {
    const num = lineStart + i;
    return `<tr class="zen-scrap-gh-row"><td class="zen-scrap-gh-num">${num}</td><td class="zen-scrap-gh-code">${esc(line) || " "}</td></tr>`;
  }).join("");

  const label = `${owner}/${repo}`;
  const filePath = path;
  const lineLabel = startLineStr ? `#L${startLineStr}${endLineStr ? `-L${endLineStr}` : ""}` : "";

  return `<div class="zen-scrap-github-embed">
    <div class="zen-scrap-github-header">
      <svg viewBox="0 0 16 16" width="16" height="16" class="zen-scrap-gh-icon"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
      <a href="${esc(url)}" target="_blank">${esc(label)} / ${esc(filePath)}${lineLabel}</a>
    </div>
    <div class="zen-scrap-github-code-wrapper">
      <table class="zen-scrap-gh-table"><tbody>${codeRows}</tbody></table>
    </div>
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
