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
    const path = normalizePath(`${SCRAPS_FOLDER}/markdown-guide.md`);
    if (this.app.vault.getAbstractFileByPath(path)) return;
    await this.app.vault.create(path, MARKDOWN_GUIDE);
  }
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

![代替テキスト](https://via.placeholder.com/600x200)

*画像のキャプション*

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

## 数式（KaTeX）

### インライン数式

$a^2 + b^2 = c^2$ はピタゴラスの定理です。

### ブロック数式

$$
\\\\int_{0}^{\\\\infty} e^{-x^2} dx = \\\\frac{\\\\sqrt{\\\\pi}}{2}
$$

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
