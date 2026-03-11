# Markdown ガイド

Zen Scrap で使える Markdown 記法の一覧です。レンダリングには zenn-markdown-html を使用しています。

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

![サンプル画像]({{SAMPLE_IMAGE}})

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

文中に `console.log("hello")` のようにコードを埋め込めます。

### ブロック（言語指定なし）

```
const x = 1;
const y = 2;
console.log(x + y);
```

### JavaScript

```js
function greet(name) {
  return `Hello, ${name}!`;
}

console.log(greet("World"));
```

### TypeScript

```ts
interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): User {
  return { id, name: "Alice", email: "alice@example.com" };
}
```

### Python

```python
def fibonacci(n: int) -> list[int]:
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[-1] + fib[-2])
    return fib

print(fibonacci(10))
```

### HTML

```html
<div class="container">
  <h1>Hello World</h1>
  <p>This is a paragraph.</p>
</div>
```

### CSS

```css
.container {
  max-width: 780px;
  margin: 0 auto;
  padding: 16px;
}

.container h1 {
  color: #333;
  font-size: 2em;
}
```

### JSON

```json
{
  "name": "zen-scrap",
  "version": "0.1.0",
  "dependencies": {
    "zenn-markdown-html": "^0.4.6"
  }
}
```

### Shell

```bash
npm install
npm run build
git commit -m "update"
```

### diff

```diff
- const old = "before";
+ const updated = "after";
```

### ファイル名付きコードブロック

```js:src/main.ts
import { Plugin } from "obsidian";

export default class MyPlugin extends Plugin {
  async onload() {
    console.log("loaded");
  }
}
```

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

```js
console.log("コードブロックも可");
```
:::

:::details 長いサンプルコード
```ts
class EventBus {
  private handlers = new Map<string, Function[]>();

  on(event: string, handler: Function) {
    const list = this.handlers.get(event) || [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  emit(event: string, ...args: any[]) {
    const list = this.handlers.get(event) || [];
    list.forEach(fn => fn(...args));
  }
}
```
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

以下はZen Scrap固有の記法です。エディタの「+ 埋め込み」ボタンからも挿入できます。

### X (Twitter) の埋め込み

```
@[tweet](https://x.com/ユーザー名/status/ツイートID)
```

### YouTube の埋め込み

YouTubeはzenn-markdown-htmlの標準機能で処理されます。

```
@[youtube](https://youtu.be/動画ID)
```

### Web記事の埋め込み（OGPカード）

```
@[card](https://example.com/記事URL)
```

### GitHub コードの埋め込み

```
@[github](https://github.com/owner/repo/blob/branch/path/to/file.ts#L10-L20)
```

行番号を `#L10-L20` のように指定すると、その範囲のコードが表示されます。
