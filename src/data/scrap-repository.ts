import { App, TFile, TFolder, normalizePath } from "obsidian";
import { Scrap } from "./types";
import { parseScrapMarkdown, serializeScrap } from "./scrap-parser";

const SCRAPS_FOLDER = "Scraps";

export class ScrapRepository {
  constructor(private app: App) {}

  async ensureFolder(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(SCRAPS_FOLDER);
    if (!folder) {
      await this.app.vault.createFolder(SCRAPS_FOLDER);
    }
  }

  async listAll(): Promise<Scrap[]> {
    await this.ensureFolder();
    const folder = this.app.vault.getAbstractFileByPath(SCRAPS_FOLDER);
    if (!(folder instanceof TFolder)) return [];

    const scraps: Scrap[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        const content = await this.app.vault.read(child);
        scraps.push(parseScrapMarkdown(content, child.path));
      }
    }

    // updated降順でソート
    scraps.sort((a, b) => (a.updated > b.updated ? -1 : 1));
    return scraps;
  }

  async getByPath(filePath: string): Promise<Scrap | null> {
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return null;
    const content = await this.app.vault.read(file);
    return parseScrapMarkdown(content, file.path);
  }

  async create(title: string, tags: string[]): Promise<Scrap> {
    await this.ensureFolder();
    const now = new Date().toISOString();
    const scrap: Scrap = {
      title,
      status: "open",
      tags,
      created: now,
      updated: now,
      archived: false,
      entries: [],
      filePath: normalizePath(`${SCRAPS_FOLDER}/${title}.md`),
    };
    await this.app.vault.create(scrap.filePath, serializeScrap(scrap));
    return scrap;
  }

  async addEntry(scrap: Scrap, body: string): Promise<Scrap> {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    scrap.entries.push({ timestamp, body });
    scrap.updated = now.toISOString();
    await this.save(scrap);
    return scrap;
  }

  async save(scrap: Scrap): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(scrap.filePath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, serializeScrap(scrap));
    }
  }

  async delete(scrap: Scrap): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(scrap.filePath);
    if (file instanceof TFile) {
      await this.app.vault.trash(file, false);
    }
  }

  async ensureMarkdownGuide(): Promise<void> {
    await this.ensureFolder();

    const imgFolder = normalizePath(`${SCRAPS_FOLDER}/images`);
    if (!this.app.vault.getAbstractFileByPath(imgFolder)) {
      await this.app.vault.createFolder(imgFolder);
    }
    const imgPath = normalizePath(`${SCRAPS_FOLDER}/images/sample.png`);
    if (!this.app.vault.getAbstractFileByPath(imgPath)) {
      await this.app.vault.createBinary(imgPath, createSampleImage());
    }

    const path = normalizePath(`${SCRAPS_FOLDER}/markdown-guide.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, MARKDOWN_GUIDE);
    } else {
      await this.app.vault.create(path, MARKDOWN_GUIDE);
    }
  }
}

function createSampleImage(): ArrayBuffer {
  // 200x60 のシンプルなPNG（グラデーション風）を生成
  const w = 200, h = 60;
  const raw: number[] = [];
  for (let y = 0; y < h; y++) {
    raw.push(0); // filter none
    for (let x = 0; x < w; x++) {
      const r = Math.round(100 + (x / w) * 100);
      const g = Math.round(140 + (y / h) * 80);
      const b = Math.round(200 - (x / w) * 60);
      raw.push(r, g, b, 255);
    }
  }

  // Deflate (uncompressed blocks)
  const rawBytes = new Uint8Array(raw);
  const deflated = deflateUncompressed(rawBytes);

  // PNG construction
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const ihdr = pngChunk("IHDR", [
    ...u32be(w), ...u32be(h),
    8, // bit depth
    6, // color type RGBA
    0, 0, 0, // compression, filter, interlace
  ]);
  const idat = pngChunk("IDAT", Array.from(deflated));
  const iend = pngChunk("IEND", []);

  const png = new Uint8Array([...sig, ...ihdr, ...idat, ...iend]);
  return png.buffer;
}

function u32be(v: number): number[] {
  return [(v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function pngChunk(type: string, data: number[]): number[] {
  const typeBytes = Array.from(type).map((c) => c.charCodeAt(0));
  const crcInput = [...typeBytes, ...data];
  const crc = crc32(crcInput);
  return [...u32be(data.length), ...typeBytes, ...data, ...u32be(crc)];
}

function crc32(data: number[]): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function deflateUncompressed(data: Uint8Array): Uint8Array {
  // zlib header + uncompressed deflate blocks + adler32
  const blocks: number[] = [0x78, 0x01]; // zlib header (no compression)
  const maxBlock = 65535;
  for (let i = 0; i < data.length; i += maxBlock) {
    const remaining = data.length - i;
    const len = Math.min(remaining, maxBlock);
    const isFinal = i + len >= data.length ? 1 : 0;
    blocks.push(isFinal);
    blocks.push(len & 0xff, (len >> 8) & 0xff);
    blocks.push((~len) & 0xff, ((~len) >> 8) & 0xff);
    for (let j = 0; j < len; j++) blocks.push(data[i + j]);
  }
  // Adler-32
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  const adler = ((b << 16) | a) >>> 0;
  blocks.push(...u32be(adler));
  return new Uint8Array(blocks);
}

const MARKDOWN_GUIDE = `# Markdown ガイド

Zen Scrap で使える Markdown 記法の一覧です。

---

## 見出し

# 見出し1
## 見出し2
### 見出し3
#### 見出し4
##### 見出し5
###### 見出し6

---

## テキスト装飾

これは **太字** のテキストです。

これは *斜体* のテキストです。

これは ~~打ち消し線~~ のテキストです。

これは **太字の中に *斜体* を含む** テキストです。

---

## リンク

[Zenn](https://zenn.dev)

https://zenn.dev

---

## 画像

![サンプル画像](Scraps/images/sample.png)

vault内のパスまたは外部URLを指定できます。

---

## リスト

### 順序なしリスト

- リスト1
- リスト2
  - ネスト1
  - ネスト2
    - さらにネスト
- リスト3

### 順序付きリスト

1. 最初の項目
2. 次の項目
3. その次の項目
   1. ネストされた項目
   2. ネストされた項目

### チェックリスト

- [ ] 未完了のタスク
- [x] 完了したタスク
- [ ] もう一つの未完了タスク

---

## 引用

> これは引用です。
> 複数行にまたがることもできます。

> ネストされた引用
> > さらにネスト

---

## コードブロック

### インラインコード

文中に \`console.log("hello")\` のようにコードを埋め込めます。

### ブロック（言語指定なし）

\`\`\`
const x = 1;
const y = 2;
console.log(x + y);
\`\`\`

### JavaScript

\`\`\`js
function greet(name) {
  return \\\`Hello, \\\${name}!\\\`;
}

console.log(greet("World"));
\`\`\`

### TypeScript

\`\`\`ts
interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): User {
  return { id, name: "Alice", email: "alice@example.com" };
}
\`\`\`

### Python

\`\`\`python
def fibonacci(n: int) -> list[int]:
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[-1] + fib[-2])
    return fib

print(fibonacci(10))
\`\`\`

### HTML

\`\`\`html
<div class="container">
  <h1>Hello World</h1>
  <p>This is a paragraph.</p>
</div>
\`\`\`

### CSS

\`\`\`css
.container {
  max-width: 780px;
  margin: 0 auto;
  padding: 16px;
}
\`\`\`

### JSON

\`\`\`json
{
  "name": "zen-scrap",
  "version": "0.1.0",
  "dependencies": {
    "zenn-markdown-html": "^0.4.6"
  }
}
\`\`\`

### Shell

\`\`\`bash
npm install
npm run build
git commit -m "update"
\`\`\`

### diff

\`\`\`diff
- const old = "before";
+ const updated = "after";
\`\`\`

### ファイル名付きコードブロック

\`\`\`js:src/main.ts
import { Plugin } from "obsidian";

export default class MyPlugin extends Plugin {
  async onload() {
    console.log("loaded");
  }
}
\`\`\`

---

## テーブル

| ヘッダー1 | ヘッダー2 | ヘッダー3 |
| --- | :---: | ---: |
| 左寄せ | 中央寄せ | 右寄せ |
| データA | データB | データC |
| データD | データE | データF |

---

## 水平線

上のテキスト

---

下のテキスト

---

## アコーディオン（トグル）

:::details タイトル
ここに折りたたまれた内容を書きます。

- リストも使えます
- **太字** も OK

\`\`\`js
console.log("コードブロックも可");
\`\`\`
:::

---

## メッセージ（注意書き）

:::message
これは通常のメッセージです。補足情報などに使います。
:::

:::message alert
これは警告メッセージです。重要な注意事項に使います。
:::

---

## 脚注

本文中に脚注[^1]を入れることができます。複数の脚注[^2]も使えます。

[^1]: これが脚注の内容です。
[^2]: 2つ目の脚注です。

---

## Zen Scrap 独自の埋め込み記法

エディタの「+ 埋め込み」ボタンからも挿入できます。

### X (Twitter) の埋め込み

\`\`\`
@[tweet](https://x.com/ユーザー名/status/ツイートID)
\`\`\`

### YouTube の埋め込み

\`\`\`
@[youtube](https://youtu.be/動画ID)
\`\`\`

### Web記事の埋め込み（OGPカード）

\`\`\`
@[card](https://example.com/記事URL)
\`\`\`

### GitHub コードの埋め込み

\`\`\`
@[github](https://github.com/owner/repo/blob/branch/path/to/file.ts#L10-L20)
\`\`\`

行番号を \`#L10-L20\` のように指定すると、その範囲のコードが表示されます。
`;
