# 🔍 酔いどれクエスト2：矛盾・不整合・潜在不具合 監査レポート（Step 1）

- **監査実施日**: 2026-11-11
- **監査対象**:
  1. 仕様書: `doc/SPECIFICATION.md`
  2. DB定義: `doc/schema.sql`, `doc/schema_fix.sql`, `doc/schema_season_migration.sql`
  3. 通信層: `js/api.js`, `js/config.js`
  4. 制御層: `js/app.js`, `js/admin.js`
  5. UI層: `index.html`, `admin.html`

---

## 📊 1. 監査結果サマリー（一覧表）

| No | 区分 | 重大度 | 対象ファイルと箇所 | 不整合の内容・影響 | 推奨される修正方針 |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1** | **バグ** | **高** | `js/admin.js` (`saveStore` L2229, `parseExcelFile` L2839)<br>`admin.html` (L1097) | **「両方で参加」店舗の酔いどれセット情報が消失する致命的バグ**<br>`admin.html` の選択肢 value は `"「酔いどれセット」・「お遊びゲーム」両方で参加"` だが、`saveStore` と `parseExcelFile` のゲーム単体判定が `planType.includes('お遊びゲーム')` となっているため、「両方で参加」の店舗まで「ゲームのみ」と誤判定される。結果として保存・Excel取込時に `setName`, `setPrice`, `setContent`, `setCharge`, `setLimit`, `setNotes` がすべて空文字 `''` で上書き消去される。 | 判定条件を `planType.includes('お遊びゲーム」のみ')`、または `(planType.includes('クエスト') \|\| planType.includes('ゲーム')) && !planType.includes('両方') && !planType.includes('セット')` に修正する。 |
| **2** | **DB整合性** | **高** | `doc/schema.sql` (L18-62)<br>`doc/schema_fix.sql`<br>`doc/schema_season_migration.sql`<br>`doc/SPECIFICATION.md` (4.1節, 4.2節, 6.1.1節) | **SQL定義ファイルと本番稼働DB仕様の乖離**<br>① `schema.sql` L62 で `user_coupons.reward_tier_id` に `REFERENCES public.reward_tiers(id)` 外部キー制約があるが、仕様書4.1節では `reward_tiers` は廃止（旧2件のみ残存、新ティアは `__system_config__` 管理）と定義。DB側に外部キーが残っていると `tier_id >= 3` のクーポン発行が外部キー違反で失敗する。<br>② `schema.sql` L54 の `visits` が `UNIQUE(user_id, store_id)` のままで、仕様書4.1節の `UNIQUE(user_id, store_id, season_id)` に更新するDDLがマイグレーションSQLにない。<br>③ `schema.sql` L18 と `schema_season_migration.sql` L82 に `stores.address` カラムや廃止テーブル作成DDLが残っており、仕様書4.2節・6.1.1節（物理6カラム厳守）と矛盾する。 | `doc/` 配下のSQLを整理し、現在の本番4テーブル構成（`reward_tiers` 外部キー解除、`visits` のシーズン複合ユニーク制約、`stores` の物理6カラム定義）に合致する最新スナップショットSQLへ統一する。 |
| **3** | **バグ** | **中** | `js/admin.js` (`getSeasonPhaseInfo` L479-480, `renderSpecialDatePicker` L2383-2384, `getStoreEventDaysCount` L3352-3353)<br>`js/app.js` (`checkIsOpenToday` L33, `getStoreEventDaysCount` L426-427) | **`new Date("YYYY-MM-DD")` によるUTC/JST日付境界バグ（9時間のズレ）**<br>`api.js` (L454) では `parseLocalDate` でローカル時刻 `00:00:00` として安全に生成しているが、`admin.js` と `app.js` では `new Date(season.start_date)` を直接呼んでいる。JS仕様上 `"YYYY-MM-DD"` は **UTC 00:00（日本時間 09:00）** として解釈されるため、イベント初日の 00:00〜08:59 JST の間、管理画面で「開催前（準備中）」と誤判定されるほか、営業日数算出等で日付ズレを起こすリスクがある。 | `YYYY-MM-DD` 文字列をパースする共通ヘルパー（`new Date(y, m - 1, d)` 形式）に統一し、`new Date("YYYY-MM-DD")` の直接呼び出しを排除する。 |
| **4** | **仕様乖離 / バグ** | **中** | `js/admin.js` (`updateStoreKPIs` L1238-1259, `renderStoresTable` L1439)<br>`admin.html` (L483-527)<br>`doc/SPECIFICATION.md` (5章 L316, 6.7節 L585-588) | **店舗マスター管理の「参加/不参加」フィルタ欠落およびKPI集計の不整合**<br>① `admin.html` L485 のKPIラベルは `参加店舗数:` だが、`updateStoreKPIs` は `is_participating: false`（不参加店舗）も含めた全店舗数をカウントしている（他の4ピルも同様）。<br>② `renderStoresTable` (L1439) で `const isParticipating = Boolean(store.is_participating);` を定義しているが使用されておらず（未使用変数）、一覧上で不参加店舗を判別できない。<br>③ 仕様書5章・6.7節に明記されている `[全店舗] [参加中] [不参加]` の切替フィルタUIが `admin.html` に存在しない。 | ① KPIピルを参加中店舗の集計にする（または全店舗/参加併記にする）。<br>② 店舗一覧テーブルに「不参加」バッジ表示と `[全店舗] [参加中] [不参加]` フィルタを追加する。 |
| **5** | **バグ** | **中** | `js/admin.js` (`renderAnalytics` L713, `getAnalyticsStoreStats` L785-806, `exportAnalyticsStoresToCSV` L1171) | **集計分析（Analytics）タブにおける参加店舗数KPIと店舗別テーブルの母数不一致**<br>上部KPIカード `#analytics-total-stores`（L713）は `s.is_participating !== false` でフィルタしている一方、下部の店舗別集計テーブル `getAnalyticsStoreStats`（L786）およびCSV出力（L1171）は全店舗（不参加含む）を対象にしており、不参加店舗がある場合に上部KPIと下部テーブルの店舗数が一致しない。 | `getAnalyticsStoreStats` と `exportAnalyticsStoresToCSV` でも対象シーズンの参加店舗（`s.is_participating !== false`）に母数を統一する。 |
| **6** | **バグ** | **中** | `js/admin.js` (`renderAnalyticsTierTable` L1076-1081) | **特典（ティア）集計テーブルのキーワード検索におけるプロパティ名誤り**<br>検索フィルタ（L1078-1079）で `t.reward_desc` と `t.title_reward` を参照しているが、実際のティアオブジェクトのプロパティ名は `t.description` と `t.hero_title`（L1121-1122参照）。そのため特典内容や称号名でキーワード検索しても一切ヒットしない。 | 検索対象プロパティを `(t.description \|\| '')` と `(t.hero_title \|\| '')` に修正する。 |
| **7** | **バグ** | **中** | `js/app.js` (`openRedeemModal` L2805, `handlePopState` L1226-1228) | **未定義プロパティ `this.stores` / `STORES_DATA` 参照による店舗名解決失敗**<br>① `openRedeemModal`（L2805）で `(this.stores \|\| []).find(...)` としているが、`YoidoreQuestApp` に `this.stores` プロパティは存在せず（正しくは `this.getStores()`）、常に未定義となり店舗名ではなく生IDが表示される。<br>② `handlePopState`（L1226）でブラウザ戻る操作時に未定義のグローバル変数 `STORES_DATA` を参照しており、店舗詳細モーダルの復元に失敗する。 | 両箇所とも `this.getStores()` を使用するよう修正する。 |
| **8** | **バグ** | **中** | `js/admin.js` (`exportCurrentTableToCSV` L4596-4642)<br>`admin.html` (L764) | **「表示中のデータをCSV出力」が検索・絞り込み・ソートを無視して全件出力する**<br>`admin.html` L764 のボタン表記は `表示中のデータをCSV出力` であり、`renderUsersTable`（L3688）でも `this.lastFilteredUsers = filtered;` を保持しているにもかかわらず、`exportCurrentTableToCSV`（L4611）では未フィルタの `this.users` と `this.coupons` を全件ループして出力している。 | フィルタ・ソート適用後の配列（`this.lastFilteredUsers` 等、クーポンの場合は現在の絞り込み結果）をCSV出力するよう修正する。 |
| **9** | **バグ** | **低** | `js/admin.js` (`createSeason` L3630-3633) | **新規シーズン作成時の `adminSetActiveSeason` 重複呼び出し**<br>新規シーズンを「アクティブ」として作成する際、まだ `seasonsList` に該当IDが保存される前に `await this.api.adminSetActiveSeason(id)`（L3631）を呼び、直後に `await this.api.adminSaveSeason(seasonData)`（L3633）を呼んでいる。`adminSaveSeason` 内部で既に他シーズンの非アクティブ化処理が行われるため、L3631の呼び出しは冗長かつ無駄な通信を発生させている。 | `createSeason` 内の `if (isActive) { await this.api.adminSetActiveSeason(id); }` を削除し、`adminSaveSeason(seasonData)` に一本化する。 |
| **10** | **仕様乖離** | **中** | `doc/SPECIFICATION.md` (5章 L305, 6.2節 L422, 第8章 L642-665)<br>`js/app.js` (`renderQuestBookView` L1618-2055) | **仕様書記載の「冒険の書：過去シーズン切替UI」および「第8章：酒場ロゴコレクション（図鑑UI）」と実装の乖離**<br>仕様書5章・6.2節には冒険の書での「過去シーズン切替セレクター」、第8章には「4列グリッドの酒場ロゴ図鑑（`logo/XXX.png`）とタップ時の詳細モーダル」が記載されているが、実際の `app.js` はハイブリッド運用（紙サイン＋6桁パスコード）に移行済みで、冒険の書には「勇者ステータス・お店クーポン・グッズ特典・使い方ガイド」のみが実装されている（`logo/` フォルダも存在しない）。 | ハイブリッド運用への移行に伴う旧仕様の残存か、今後実装すべき機能かを確認し、現行仕様（紙サイン運用）が正であれば `SPECIFICATION.md` の該当記述を現行実装に合わせて更新する。 |
| **11** | **仕様乖離 / DOM不一致** | **低** | `doc/SPECIFICATION.md` (6.5.1節 L521, 第12章 L747-834)<br>`admin.html` (L613-1415)<br>`js/admin.js` (`saveStore` L2189-2341) | **仕様書第12章（管理画面入力項目定義）と `admin.html` の要素ID・タグ・必須属性の不一致**<br>① **電話番号 (`#edit-store-tel`)**: 仕様書6.5.1節・12.3節に記載があるが、`admin.html` および `js/admin.js` に該当入力欄が存在しない。<br>② **タブID**: 仕様書12.1節は `#tab-seasons` と記載しているが、`admin.html` L613 の実装は `#tab-tiers`。<br>③ **要素タグ**: 仕様書12.1・12.2節で `textarea` と定義されている `#edit-season-step1~3-desc`（`admin.html` L689-699）および `#edit-tier-exchange-notice`（`admin.html` L1411）が、実装では `<input type="text">` になっている。<br>④ **必須/任意マーク**: 仕様書12.3節で「任意」の `#edit-store-address` に `admin.html` L1032 で `<span class="required">*</span>` が付いており、逆に「必須」の `#edit-store-area-select` / `#edit-store-category-select` に HTML の `required` 属性や JS 保存時バリデーションがない。 | ① 電話番号欄が不要であれば仕様書から削除、必要であればモーダルに追加。<br>② タブID・input/textarea定義・住所の `*` 表記・エリア/業態の必須チェックを仕様書と `admin.html` / `js/admin.js` 間で統一する。 |
| **12** | **仕様乖離（第9章規約違反）** | **低** | `admin.html` (L162)<br>`js/admin.js` (L1222, L3264, L4683)<br>`js/app.js` (L2828-2835)<br>`doc/SPECIFICATION.md` (第9章 L668-713) | **第9章「データ取得・フォールバック偽装の完全禁止規約」に抵触するハードコード初期値の残存**<br>① `admin.html` L162 の初期HTMLに `<option value="2">大正酔いどれクエスト</option>` がハードコードされている。<br>② `js/admin.js` L4683 でシーズン名未取得時に `'大正酔いどれクエスト'`、L1222 で `required_visits \|\| 5`、L3264 でエリア初期値 `['大正駅前', 'サンクス平尾', 'その他']` にフォールバックしている。<br>③ `js/app.js` L2828-2835 の `openQrScannerModal`（レガシー関数）内に6段階のダミーティア定義が残存している。 | 第9章の規約通り、ハードコードされた旧イベント名やダミー配列を削除し、未ロード時はプレースホルダ（`読み込み中...`）またはエラー表示とする。 |

---

## 🔎 2. 各項目の詳細解説と該当コード抜粋

### No.1 【バグ / 重大度：高】「両方で参加」店舗の酔いどれセット情報が消失する致命的バグ
- **箇所**:
  - `admin.html` L1094-1099
  - `js/admin.js` L2229 (`saveStore`) および L2839 (`parseExcelFile`)
- **詳細**:
  `admin.html` の参加プラン `<select id="edit-store-plan">` は以下のように定義されています。
  ```html
  <option value="「酔いどれセット」のみで参加">「酔いどれセット」のみで参加</option>
  <option value="「お遊びゲーム」のみで参加">「お遊びゲーム」のみで参加</option>
  <option value="「酔いどれセット」・「お遊びゲーム」両方で参加">「酔いどれセット」・「お遊びゲーム」両方で参加</option>
  ```
  しかし、`js/admin.js` の `saveStore`（L2229）と `parseExcelFile`（L2839）では、以下のように判定しています。
  ```javascript
  const isQuestOnly = planType.includes('クエスト」のみ') || planType.includes('ゲーム」のみ') || planType.includes('お遊びゲーム');
  ```
  `"「酔いどれセット」・「お遊びゲーム」両方で参加"` には `"お遊びゲーム"` という文字列が含まれるため、**「両方で参加」の店舗を保存またはExcelインポートすると `isQuestOnly` が `true` になってしまい、入力したセット名・価格・内容・チャージ・制限・備考がすべて `''` に消去されます**。

---

### No.2 【DB整合性 / 重大度：高】SQL定義ファイルと本番稼働DB仕様の乖離
- **箇所**:
  - `doc/schema.sql`, `doc/schema_fix.sql`, `doc/schema_season_migration.sql`
  - `doc/SPECIFICATION.md` 4.1節、4.2節、6.1.1節
- **詳細**:
  1. `user_coupons.reward_tier_id` の外部キー制約（`REFERENCES public.reward_tiers(id)`）が `schema.sql` L62 にあり、解除用SQLが存在しません。仕様書4.1節の通り `reward_tiers` テーブルには過去データの2件（id=1, 2）しか入っていないため、外部キーが生きていた場合、`__system_config__` で作成した id=3 以降のティアやお店クーポン（`tier_id >= 100`）を発行した瞬間にPostgreSQLの外部キー制約エラーが発生します。
  2. `visits` テーブルのユニーク制約が `schema.sql` L54 で `UNIQUE(user_id, store_id)` のままになっており、複数シーズンで同じ店舗に来店した際に `UNIQUE(user_id, store_id, season_id)` となっていない場合、次シーズンで同一店舗の訪問記録が弾かれます。
  3. `schema.sql` や `schema_season_migration.sql` に `stores.address` カラム追加や廃止テーブル（`seasons`, `season_stores`）の `CREATE TABLE` が残っており、仕様書4.2節の「禁止事項」と矛盾しています。

---

### No.3 【バグ / 重大度：中】`new Date("YYYY-MM-DD")` によるUTC/JST日付境界バグ（9時間のズレ）
- **箇所**:
  - `js/admin.js`: `getSeasonPhaseInfo` (L479-480), `renderSpecialDatePicker` (L2383-2384), `getStoreEventDaysCount` (L3352-3353)
  - `js/app.js`: `checkIsOpenToday` (L33), `getStoreEventDaysCount` (L426-427)
- **詳細**:
  JavaScriptの `new Date("2026-10-01")` は ISO 8601 の日付のみ形式として **UTC 00:00:00（日本時間 09:00:00）** に解釈されます。
  `api.js` (L454) ではこれを避けるため `const [y, m, d] = str.split('-').map(Number); new Date(y, m - 1, d, ...)` を使っていますが、`admin.js` の `getSeasonPhaseInfo` では以下のように記述されています。
  ```javascript
  const startDate = new Date(season.start_date);
  const endDate = new Date(season.end_date);
  endDate.setHours(23, 59, 59, 999);
  ```
  このため、イベント開始日の **00:00〜08:59（JST）** の間は `now < startDate` が `true` となり、開催初日の朝にもかかわらず「開催前（準備中）」と判定されます。

---

### No.4 【仕様乖離 / バグ / 重大度：中】店舗マスター管理の「参加/不参加」フィルタ欠落およびKPI集計の不整合
- **箇所**:
  - `js/admin.js`: `updateStoreKPIs` (L1238-1259), `renderStoresTable` (L1439)
  - `admin.html`: L483-527
  - `doc/SPECIFICATION.md`: 5章 (L316), 6.7節 (L585-588)
- **詳細**:
  - `admin.html` L485 では `参加店舗数: <strong id="kpi-store-total">0</strong>店` と表記されていますが、`updateStoreKPIs()` は `this.stores.length`（不参加店舗を含む全登録店舗）を表示しています。
  - `renderStoresTable` L1439 に `const isParticipating = Boolean(store.is_participating);` という記述がありますが、以降のテンプレートリテラル内で一度も参照されておらず、テーブル上でどの店舗が不参加（アーカイブ状態）なのか見分けがつきません。
  - 仕様書に記載のある `[全店舗] [参加中] [不参加]` の切替フィルタも未実装です。

---

### No.5 【バグ / 重大度：中】集計分析（Analytics）タブにおける参加店舗数KPIと店舗別テーブルの母数不一致
- **箇所**:
  - `js/admin.js`: `renderAnalytics` (L713), `getAnalyticsStoreStats` (L786), `exportAnalyticsStoresToCSV` (L1171)
- **詳細**:
  - 上部KPIカード（L713）: `const activeStores = this.stores.filter(s => s.is_participating !== false).length;`（参加店舗のみ）
  - 下部店舗別集計テーブル（L786）: `return (this.stores || []).map(store => ...)`（不参加店舗を含む全店舗）
  - このため、不参加店舗が1件以上存在するシーズンでは、上部の「参加店舗数」と下部テーブルの「全〇店舗」の数字が食い違います。

---

### No.6 【バグ / 重大度：中】特典（ティア）集計テーブルのキーワード検索におけるプロパティ名誤り
- **箇所**:
  - `js/admin.js`: `renderAnalyticsTierTable` (L1076-1081)
- **詳細**:
  ```javascript
  tiers = tiers.filter(t =>
      String(t.required_visits).includes(kw) ||
      (t.reward_desc || '').toLowerCase().includes(kw) ||
      (t.title_reward || '').toLowerCase().includes(kw)
  );
  ```
  ティアオブジェクトの実際のフィールド名は `description` と `hero_title`（同関数内の L1121-1122 では正しく `t.description`, `t.hero_title` を表示している）であるため、検索ボックスに特典名や称号名を入力しても一切ヒットしません。

---

### No.7 【バグ / 重大度：中】未定義プロパティ `this.stores` / `STORES_DATA` 参照による店舗名解決失敗
- **箇所**:
  - `js/app.js`: `openRedeemModal` (L2805), `handlePopState` (L1226-1228)
- **詳細**:
  - `openRedeemModal` L2805:
    ```javascript
    const store = (this.stores || []).find(s => String(s.id) === String(storeId));
    ```
    `YoidoreQuestApp` クラスでは店舗配列は `this.config.stores` に格納されており、取得メソッドは `this.getStores()` です。`this.stores` は常に `undefined` になるため、`store` が見つからずモーダルに店舗ID（数値等）がそのまま表示されます。
  - `handlePopState` L1226:
    ```javascript
    const store = typeof STORES_DATA !== 'undefined' ? STORES_DATA.find(s => s.id === e.state.storeId) : null;
    ```
    旧バージョンのグローバル定数名 `STORES_DATA` が残っており、常に `null` になります。

---

### No.8 【バグ / 重大度：中】「表示中のデータをCSV出力」が検索・絞り込み・ソートを無視して全件出力する
- **箇所**:
  - `js/admin.js`: `exportCurrentTableToCSV` (L4596-4642)
  - `admin.html`: L764
- **詳細**:
  ユーザー・クーポン管理タブのCSV出力ボタンは `表示中のデータをCSV出力` とラベル付けされていますが、`exportCurrentTableToCSV` はフィルタ済みの `this.lastFilteredUsers` を使わず、`this.users` / `this.coupons` 全件を出力しています。

---

### No.9 【バグ / 重大度：低】新規シーズン作成時の `adminSetActiveSeason` 重複呼び出し
- **箇所**:
  - `js/admin.js`: `createSeason` (L3630-3633)
- **詳細**:
  ```javascript
  if (isActive) {
      await this.api.adminSetActiveSeason(id);
  }
  await this.api.adminSaveSeason(seasonData);
  ```
  新規作成時はまだ `seasonsList` に `id` が存在しない状態で `adminSetActiveSeason(id)` を呼んでおり、さらに直後の `adminSaveSeason(seasonData)` 内部（`api.js` L502-505）でも `seasonObj.is_active` が `true` なら他シーズンを `false` に更新して保存する処理が入っているため、完全に重複しています。

---

### No.10 【仕様乖離 / 重大度：中】仕様書記載の「冒険の書：過去シーズン切替UI」および「第8章：酒場ロゴコレクション（図鑑UI）」と実装の乖離
- **箇所**:
  - `doc/SPECIFICATION.md`: 5章 (L305), 6.2節 (L422), 第8章 (L642-665)
  - `js/app.js`: `renderQuestBookView` (L1618-2055)
- **詳細**:
  仕様書には過去シーズン切替セレクターや4列グリッドの酒場ロゴ図鑑（`logo/XXX.png`）の仕様が記載されていますが、現行の `app.js` は紙のサイン帳＋6桁パスコードによるハイブリッド運用に最適化されており、これらのUIは存在しません。

---

### No.11 【仕様乖離 / DOM不一致 / 重大度：低】仕様書第12章（管理画面入力項目定義）と `admin.html` の不一致
- **箇所**:
  - `doc/SPECIFICATION.md`: 6.5.1節 (L521), 第12章 (L747-834)
  - `admin.html`: L613-1415
- **詳細**:
  1. `#edit-store-tel`（電話番号）が仕様書6.5.1節・12.3節にあるが、`admin.html` / `admin.js` に存在しない。
  2. 仕様書12.1節のタブIDが `#tab-seasons` となっている（実装は `#tab-tiers`）。
  3. 仕様書12.1・12.2節で `textarea` となっている `#edit-season-step1~3-desc` と `#edit-tier-exchange-notice` が、実装では `<input type="text">`。
  4. 仕様書12.3節で「任意」の `#edit-store-address` に `*`（必須マーク）が付いており、逆に「必須」のエリア・業態セレクトボックスに `required` 属性がない。

---

### No.12 【仕様乖離（第9章規約違反） / 重大度：低】第9章「データ取得・フォールバック偽装の完全禁止規約」に抵触するハードコード初期値の残存
- **箇所（全4分類・19か所）**:
  - **[完了] 分類①（ダミー特典データの除去：2か所）**: `js/app.js` (`openQrScannerModal` のダミー特典配列、`renderQuestBookView` の旧テスト処理)
  - **[完了] 分類②（特典の `selectable_count` / `required_visits` に対する `|| 5` 補填の除去：12か所）**: `js/api.js` (L1026)、`js/admin.js` (L1152, L1234, L1242, L3292, L4012, L4506, L4627, L4715)、`js/app.js` (L1715, L1741, L3129)
  - **[完了] 分類③（シーズン名未取得時の `'大正酔いどれクエスト'` フォールバック・HTML初期値の除去：4か所）**: `admin.html` (L162, L996/L1444)、`js/admin.js` (L4705)、`js/app.js` (L1465)
  - **[完了] 分類④（グッズ引換場所未設定時の架空テキスト補填の除去：2か所）**: `js/app.js` (L2621)、`js/admin.js` (L4326)

---

## ✅ 3. Step 2（修正方針決定）用チェックリスト

ご確認の上、各項目の対応方針をご指示ください。

- [x] **No.1（両方で参加店舗のセット情報消失バグ）**: コードを修正する（2026-11-11 修正完了）
- [x] **No.2（SQL定義ファイルの不整合）**: `doc/` のSQLファイルを本番4テーブル仕様に合わせて整理・更新する（2026-11-11 修正完了）
- [x] **No.3（UTC/JST日付境界バグ）**: ローカル日付パースに統一してコードを修正する（2026-11-11 修正完了）
- [x] **No.4（店舗マスターの参加/不参加フィルタ＆KPI）**: B案（KPIを参加店舗基準に修正・一覧に不参加バッジ追加・仕様書の廃止済みフィルタ記述を整理）にて修正完了（2026-11-11）
- [x] **No.5（集計分析タブの店舗母数不一致）**: 店舗別集計テーブルも参加店舗のみに統一する（2026-11-11 修正完了）
- [x] **No.6（特典集計テーブルの検索バグ）**: プロパティ名を `description` / `hero_title` に修正する（2026-11-11 修正完了）
- [x] **No.7（`this.stores` / `STORES_DATA` 未定義参照）**: `this.getStores()` に修正する（2026-11-11 修正完了）
- [x] **No.8（表示中データのCSV出力バグ）**: フィルタ・ソート後のデータを出力するよう修正する（2026-11-11 修正完了）
- [x] **No.9（新規シーズン作成時の重複API呼び出し）**: 案1-A（新規作成時は常に準備中とし、本番切替は `adminSetActiveSeason` に完全分離）にて修正完了（2026-11-11）
- [x] **No.10（仕様書の酒場ロゴ図鑑・過去シーズン切替記述）**: 現行実装を正として `doc/SPECIFICATION.md` を更新する（2026-11-11 修正完了）
- [x] **No.11（仕様書第12章と `admin.html` の差異）**: 現行実装を正として仕様書を更新し、住所の `*` 表記を整理（2026-11-11 修正完了）
- [x] **No.12（第9章規約違反のハードコード残存）**: 全4分類（ダミー特典配列・`|| 5` 固定補填・旧イベント名・架空引換場所）をすべて除去（2026-11-11 修正完了）

---

## 🔍 4. 第2回 クロスチェック監査結果（再点検で見つかった項目と要否仕分け）

第1回監査（No.1〜No.12）の改修完了後に再点検を実施した結果、以下の項目が検出されました。
**「過剰な仕様変更や、無理やりな小細工を入れない」** という原則に基づき、**本当に修正が必要な項目（5件）** と **現状のままで問題なく修正不要な項目（2件）** に厳密に仕分けしています。

### 🟢 A. シンプルかつ実用上修正すべき項目（計5件）

#### No.2-1 【UI連携漏れ / 重大度：中】Excel一括取込モーダルの対象イベント名（`#import-modal-season-badge`）の更新漏れ
- **箇所**: `admin.html` (L1444)、`js/admin.js` (`openExcelImportModal` L2535-2546)
- **詳細**: No.12で `admin.html` の初期テキストから `'大正酔いどれクエスト'` の固定値を外して `'-'` にした際、店舗編集モーダル（`openStoreModal` L1826）には選択中シーズン名をセットする処理がありますが、`openExcelImportModal` 側にはその処理がなかったため、モーダルを開いても「取り込み対象イベント: -」のままになります。
- **修正案（シンプル・3行追加のみ）**: `openStoreModal` と全く同じ3行を `openExcelImportModal` に追加し、選択中シーズン名を表示します。

#### No.2-2 【旧固定値残存 / 重大度：中】特典ランク設定モーダルの獲得可能クーポン数（`#edit-tier-selectable`）における旧上限 `max="33"` の残存
- **箇所**: `admin.html` (L1388)
- **詳細**: 第1回（33店舗時代）の `max="33"` が `<input type="number" id="edit-tier-selectable" min="1" max="33">` に残っています。現在51店舗あるため、34枠以上のクーポンを設定しようとするとHTML標準バリデーションで保存が弾かれます。
- **修正案（シンプル・属性1か所のみ）**: 直上の `#edit-tier-required`（L1358）と同じ `max="100"` に揃えます。

#### No.2-3 【判定条件の統一 / 重大度：中】店舗マスターの絞り込み（`filterStores` / `quickFilterStores`）における「セットのみ・ゲームのみ」判定の統一
- **箇所**: `js/admin.js` (`filterStores` L1581-1582、`quickFilterStores` L1682, L1687)
- **詳細**: No.1・No.4で修正した `updateStoreKPIs`（L1264-1269）や `renderStoresTable`（L1483-1486）では、`!isQuestOnly` / `!isSetOnly` および参加店舗条件（`s.is_participating !== false`）で判定していますが、`filterStores` と `quickFilterStores` のみ旧判定のままになっています。
- **修正案（シンプル・既存条件に揃えるのみ）**: 新しい状態管理などは一切追加せず、`updateStoreKPIs` と同じ判定条件に揃えます。

#### No.2-4 【非同期処理の順序 / 重大度：低】店舗一覧「クーポン取扱」ワンクリック切替（`toggleCouponTarget`）の代入順序と再描画引数
- **箇所**: `js/admin.js` (`toggleCouponTarget` L1734, L1765)
- **詳細**: API通信前に `store.is_coupon_target = newStatus` を書き換えているため通信エラー時に表示がズレる点と、通信成功後に引数なしで `this.renderStoresTable()` を呼んでいるため現在の絞り込みやページ位置が1ページ目に戻る点があります。
- **修正案（シンプル・2行の調整のみ）**: `store.is_coupon_target = newStatus` をAPI成功後に移動し、再描画を `this.renderStoresTable(this.lastFilteredStores, true)`（現在の絞り込みとページを維持）にします。

#### No.2-5 【小細工の撤廃・シンプル化 / 重大度：中】特典獲得取消API（`adminRevokeUserRewardTier`）の旧フォールバック・エラー握りつぶし撤廃
- **箇所**: `js/api.js` (`adminRevokeUserRewardTier` L1247-1267)
- **詳細**: 旧DB仕様時代の残骸である `status=like.tier_*` の削除処理と、エラーを握りつぶす `try { ... } catch (e) {}` が残っており、通信失敗や認証切れでも常に `{ success: true }` を返してしまいます。また、引数 `seasonId` がクエリに使われていません。
- **修正案（無理やりな旧仕様の撤廃・シンプル化）**: `adminDeleteVisit` / `adminDeleteCoupon`（L1222-1229）と同様に、不要な `try/catch` と旧 `status=like.tier_*` 削除を撤廃し、`user_id`・`reward_tier_id`・`season_id` を指定する素直な1回の `DELETE` 通信にシンプル化します。

---

### ⚪ B. 再検証の結果「過剰・修正不要」と判断した項目（計2件）

#### No.2-6 【修正不要】エリアプルダウン（`#area-filter` 等）の再生成および日付ガード
- **理由**: `this.stores` は初回ロード時（`loadAllData`）に全店舗マスタ（`stores` テーブル全件）を取得するため、シーズンを切り替えても店舗の基本属性である `area` の種類は変わりません。したがって初回生成のみで実用上100%問題なく、毎回再生成する処理を入れるのは過剰な改修となるため**修正不要（現状維持）**とします。

#### No.2-7 【修正不要（仕様書の記述1行のみ任意）】`js/admin.js` 内の旧DOM ID参照（`#kpi-card-store-*` 等）
- **理由**: すべて `if (el)` の存在チェック付きで安全にガードされており、動作上の悪影響はゼロです。無理にコードを触る必要はなく、必要であれば仕様書（`doc/SPECIFICATION.md` 12.3節）の表に `#edit-store-style-custom` の記載を1行補記するのみで十分です。

---

### ✅ 第2回監査 チェックリスト

- [x] **No.2-1（Excel取込モーダルの対象イベント名表示）**: `openExcelImportModal` にシーズン名表示（3行）を追加する（2026-11-11 修正完了）
- [x] **No.2-2（`#edit-tier-selectable` / `#edit-tier-required` の固定 `max` 属性削除）**: `admin.html` から不要な `max="33"` / `max="100"` を削除し、仕様書通り `min="1"` のみに統一（2026-11-11 修正完了）
- [ ] **No.2-3（店舗絞り込みのセット/ゲーム判定条件統一）**: `filterStores` / `quickFilterStores` の判定式を `updateStoreKPIs` と揃える
- [ ] **No.2-4（`toggleCouponTarget` の成功後代入とページ維持）**: 代入位置の移動と `renderStoresTable(this.lastFilteredStores, true)` への変更
- [ ] **No.2-5（`adminRevokeUserRewardTier` のシンプル化）**: 不要な `try/catch` と旧 `status=like` を撤廃し、素直なDELETE通信にする
- [x] **No.2-6（エリアプルダウン再生成等）**: 過剰改修を避けるため現状維持（対応不要）
- [ ] **No.2-7（仕様書12.3節の `#edit-store-style-custom` 補記）**: コード変更なし・仕様書の表のみ補記する
