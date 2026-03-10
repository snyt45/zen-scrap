# 一覧画面リデザイン + EventBus導入 設計

## 方針
コールバック注入をEventBusに置き換え、一覧画面のUI改善を行う。ディレクトリ構成を機能別に整理する。

## ディレクトリ構成

```
src/
  events/
    constants.ts         ← イベント名定数
    event-bus.ts         ← EventBus実装（emit/on/off）
    scrap-handlers.ts    ← scrap系ハンドラ登録
    nav-handlers.ts      ← ナビゲーション系ハンドラ登録
  views/
    scrap-list-view.ts   ← 一覧ビュー
    scrap-detail-view.ts ← 詳細ビュー
  data/
    scrap-repository.ts  ← データアクセス
    scrap-parser.ts      ← Markdown解析
    types.ts             ← 型定義
  ui/
    title-prompt-modal.ts ← タイトル入力モーダル
  main.ts                ← Plugin本体
```

## EventBus設計

### イベント一覧（constants.ts）
- SCRAP_SELECT: スクラップ選択
- SCRAP_CREATE_REQUEST: 新規作成リクエスト
- SCRAP_CHANGED: スクラップ作成・更新完了
- NAV_BACK_TO_LIST: 一覧に戻る

### フロー
- ScrapListView: emit(SCRAP_SELECT), emit(SCRAP_CREATE_REQUEST), on(SCRAP_CHANGED)
- ScrapDetailView: emit(NAV_BACK_TO_LIST)
- scrap-handlers: on(SCRAP_SELECT) → 詳細ビュー開く, on(SCRAP_CREATE_REQUEST) → モーダル→作成→emit(SCRAP_CHANGED), on(SCRAP_CHANGED) は各View側でsubscribe
- nav-handlers: on(NAV_BACK_TO_LIST) → 一覧ビュー開く

### Viewコンストラクタ
変更前: (leaf, repo, onScrapSelect, onCreateNew)
変更後: (leaf, repo, eventBus)

## 一覧画面デザイン

### レイアウト
1. ヘッダー: 「Zen Scrap」タイトル + 右上に「+ 新規作成」ボタン（角丸）
2. 検索欄: タイトル・トピックで検索
3. フィルタ行: タブ（All / Open / Closed / Archived）+ 並び替えselect
4. スクラップ一覧

### ステータスラベル
- Open: 青背景、白文字
- Closed: 紫背景、白文字

### 並び替え
- 作成日が新しい順（デフォルト）
- コメントが新しい順

### リストアイテム
- ステータスラベル + タイトル + エントリ件数
- タグ + 相対時間
