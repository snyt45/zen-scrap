import { App, TFile } from "obsidian";
import markdownToHtml from "zenn-markdown-html";
import { renderEmbed } from "../../ui/embed-renderer";

export class MarkdownRenderer {
  constructor(private app: App) {}

  async renderBody(body: string): Promise<string> {
    // 0. Obsidianリンク [[ノート名]] / [[ノート名|表示テキスト]] をMarkdownリンクに変換
    // obsidian:// プロトコルはmarkdown-itにサニタイズされるため、#で代替しレンダリング後に処理する
    body = body.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => {
      const display = alias || target;
      return `[${display}](#zen-scrap-link:${encodeURIComponent(target)})`;
    });

    // 1. 埋め込み記法を抽出してプレースホルダーに置換（youtubeはzenn-markdown-htmlが処理するので除外）
    const embeds: { id: string; type: string; url: string }[] = [];
    const processed = body.replace(/@\[(tweet|card|github)\]\(([^)]+)\)/g, (_, type, url) => {
      const id = `ZENSCRAPEMBED${embeds.length}ZENSCRAPEMBED`;
      embeds.push({ id, type, url });
      return id;
    });

    // 2. markdownToHtml
    let html = await markdownToHtml(processed);

    // 3. 埋め込みプレースホルダーをリッチHTMLに置換（<p>で囲まれている場合も対応）
    for (const embed of embeds) {
      const embedHtml = await renderEmbed(embed.type, embed.url);
      const wrappedPattern = new RegExp(`<p[^>]*>${embed.id}</p>`);
      if (wrappedPattern.test(html)) {
        html = html.replace(wrappedPattern, embedHtml);
      } else {
        html = html.replace(embed.id, embedHtml);
      }
    }

    // 4. vault内画像パスをリソースURLに変換
    html = this.fixImagePaths(html);

    return html;
  }

  fixImagePaths(html: string): string {
    return html.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/g, (match, before, src, after) => {
      // 外部URLはスキップ
      if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("app://") || src.startsWith("data:")) {
        return match;
      }
      // vault内パスをリソースURLに変換
      const file = this.app.vault.getAbstractFileByPath(src);
      if (file instanceof TFile) {
        const resourcePath = this.app.vault.getResourcePath(file);
        return `<img${before}src="${resourcePath}"${after}>`;
      }
      return match;
    });
  }

  addLinkHandler(container: HTMLElement): void {
    container.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href) return;

      e.preventDefault();
      e.stopPropagation();

      if (href.startsWith("#zen-scrap-link:")) {
        const file = decodeURIComponent(href.replace("#zen-scrap-link:", ""));
        if (file) {
          this.app.workspace.openLinkText(file, "", false);
        }
      } else if (href.startsWith("http://") || href.startsWith("https://")) {
        window.open(href, "_blank");
      }
    });
  }

  addCopyButtons(container: HTMLElement): void {
    container.querySelectorAll("pre").forEach((pre) => {
      pre.style.position = "relative";
      const btn = document.createElement("button");
      btn.className = "zen-scrap-code-copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", () => {
        const code = pre.querySelector("code");
        if (!code) return;
        const clone = code.cloneNode(true) as HTMLElement;
        clone.querySelectorAll(".zen-scrap-gh-line-num").forEach((el) => el.remove());
        navigator.clipboard.writeText(clone.textContent || "");
      });
      pre.prepend(btn);
    });
  }
}
