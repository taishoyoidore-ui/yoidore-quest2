# RFC: 特定日営業店舗を除外した全店制覇（40店舗）の仕様および実装手順書

**作成日時**: 2026-11-04  
**ステータス**: 運営検討中（保留・合意後に即時着手可能）  
**対象バージョン予定**: `v2026.11.04.02` 以降  

---

## 1. 提案の背景と課題

### 1.1 現状
- Season 2 の全参加店舗数は **41店舗**。
- うち1店舗（`store-45`: かのじょとカレー）は、**「2027-01-30 11:30〜15:30（4時間限定）」** のみの特定日営業。
- 現行のDB設定（`__system_config__` 内 Season 2 Tier 6）では、全店制覇の条件が `required_visits: 41`（全41店舗）となっている。

### 1.2 課題
- 参加者がこの4時間限定の営業に訪問できなかった場合、**全店制覇が物理的に不可能**になってしまう。
- 一方で、「かのじょとカレー」に来店したユーザーの訪問実績も正当に評価し、ハシゴ軒数としてカウントしたい。

### 1.3 解決方針（合意候補）
1. **全店制覇の達成条件**:
   - `41店舗 - 1店舗（特定日営業） = 40店舗` の訪問で「全店制覇（Tier 6）」達成と判定する。
   - 計算式: `全店制覇に必要な軒数 = シーズン対象店舗数 - 特定日営業店舗（special_dateが設定された店舗）数`
2. **特定日営業店舗のハシゴ実績**:
   - 特定日営業店舗に訪問した場合も、通常通り「ハシゴ軒数（+1軒）」としてカウントされる。
   - ※もし特定日店舗を含む41店舗すべてを回った場合は、41軒ハシゴ（全店制覇＋1軒余裕）となり、特典獲得に何ら不利益はない。
3. **ユーザーUIでの明確なアナウンス**:
   - 参加者が誤解・不安を抱かないよう、店舗一覧・店舗詳細・宝箱（クエスト帳）の3箇所に注記を表示する。

---

## 2. 影響範囲と変更箇所一覧

| 対象ファイル/DB | 種別 | 変更内容の概要 |
| :--- | :--- | :--- |
| **Supabase DB** (`users` テーブル) | データ更新 | `__system_config__` 内 `season_2` の Tier 6 の `required_visits` を `41` → `40` に更新 |
| **js/admin.js** | ロジック改修 | バックオフィスで Tier を保存する際、「全店制覇」フラグがONなら `参加店舗数 - 特定日店舗数` を自動計算して `required_visits` に設定 |
| **js/app.js** | UI表示改修 | ① 特定日店舗カード & モーダルに注記追加<br>② クエスト帳（Tier 6 宝箱）に達成条件と注記を追加 |
| **SPECIFICATION.md** | 仕様書更新 | 検討中フラグを解除し、正式確定仕様として履歴追記 |
| **js/config.js** / **HTML** | バージョン | キャッシュバスターおよびアプリバージョンを繰り上げ |

---

## 3. 詳細な実装差分（Ready-to-Implement）

### 3.1 データベース（Supabase）更新

`users` テーブルの `line_user_id = '__system_config__'` レコード内の `display_name`（JSON文字列）を更新する。

#### 更新内容:
```json
// season_2 の reward_tiers 内
{
  "id": "tier-s2-all",
  "season_id": "season_2",
  "tier_level": 6,
  "required_visits": 40,        // ← 41 から 40 に変更
  "is_all_stores": true,
  "badge_name": "全店制覇マスター",
  "reward_title": "Season 2 全店制覇の証",
  "reward_description": "シーズン2の全通常店舗を制覇した猛者に贈られる称号と特製ピンバッジ！",
  "is_special_reward": true,
  "bg_color": "#FFD700"
}
```

※SQLでの一括更新、またはバックオフィス（`admin.html`）の「リワード階層モーダル」で編集保存することで反映可能。

---

### 3.2 フロントエンド（管理画面: `js/admin.js`）

#### 変更箇所: `saveTierForm()` 関数内
全店制覇（`is_all_stores`）がチェックされた際、単純な全店舗数ではなく「特定日営業店舗（`special_date` を持つ店舗）」を除外した店舗数を自動セットする。

```javascript
// 【変更前】(js/admin.js)
if (isAllStores) {
    const seasonStores = currentStores.filter(s => s.season_id === currentSeasonId);
    requiredVisits = seasonStores.length;
}

// 【変更後】
if (isAllStores) {
    const seasonStores = currentStores.filter(s => s.season_id === currentSeasonId);
    // special_date が設定されている店舗（特定日営業）を除外した店舗数を計算
    const regularStores = seasonStores.filter(s => !s.special_date || s.special_date.trim() === '');
    requiredVisits = regularStores.length;
    console.log(`[Admin] 全店制覇の必要軒数を自動計算: 全${seasonStores.length}店舗 - 特定日${seasonStores.length - regularStores.length}店舗 = ${requiredVisits}店舗`);
}
```

---

### 3.3 フロントエンド（参加者画面: `js/app.js`）

#### A. 店舗カード & 店舗詳細モーダルの注記
`special_date` が存在する店舗に、「全店制覇の必須店舗ではない」旨を表示。

```javascript
// 1. renderStoreCard(store) 内の special_date 表示部
if (store.special_date) {
    specialBadge = `
        <div class="store-special-date-badge">
            <i class="fas fa-calendar-alt"></i> 特別営業: ${escapeHtml(store.special_date)}
            <div class="store-special-date-note">※全店制覇の必須店舗ではありません（ハシゴ軒数にはカウントされます）</div>
        </div>
    `;
}

// 2. showStoreDetailModal(store) 内
if (store.special_date) {
    detailHtml += `
        <div class="modal-special-date-alert">
            <p><strong><i class="fas fa-calendar-star"></i> 特別営業日:</strong> ${escapeHtml(store.special_date)}</p>
            <p class="modal-special-date-sub">※この店舗に行かなくても全店制覇（40店舗）は達成可能です。来店時はハシゴ軒数として加算されます。</p>
        </div>
    `;
}
```

#### B. クエスト帳（宝箱一覧）の表示
Tier 6（`is_all_stores: true`）の宝箱カードに注記を表示。

```javascript
// renderQuestBookView() または renderRewardTiers() 内
// 条件テキストのレンダリング部
let conditionText = `🍺 条件: ${tier.required_visits}店舗ハシゴ`;
let specialNoteHtml = '';

if (tier.is_all_stores) {
    conditionText = `🍺 条件: 通常営業 ${tier.required_visits}店舗ハシゴ（全店制覇）`;
    specialNoteHtml = `<div class="tier-special-notice">※特定日営業の店舗（かのじょとカレー）に行かなくても達成できます</div>`;
}
```

---

## 4. 検証・テスト手順（作業後のチェックリスト）

1. **管理画面（admin.html）での動作確認**:
   - リワード階層設定で「全店制覇」にチェックを入れた際、必要店舗数が `40` と自動入力されること。
   - 保存後、リワード一覧テーブルに「40店舗」と表示され、DBの `__system_config__` に `40` で保存されること。
2. **参加者画面（index.html）での表示確認**:
   - 店舗一覧で「かのじょとカレー」に `※全店制覇の必須店舗ではありません` の注記が出ていること。
   - クエスト帳（宝箱一覧）でTier 6に `通常営業 40店舗ハシゴ` および注記が表示されていること。
3. **達成判定のシミュレーション**:
   - `visitedCount = 39`: 未達成
   - `visitedCount = 40`: **Tier 6 開封可能（達成！）**
   - （特定日を含む41店舗を回った場合）`visitedCount = 41`: 正常に達成維持

---

## 5. 合意後の作業開始コマンド・指示例

運営メンバーでの検討が完了し、本仕様を採用することが決定した際は、AIに対して以下のいずれかのメッセージを送信してください：

> **指示例文**:  
> 「`doc/RFC_all_stores_conquest_special_date_rule.md` の仕様に沿って改修を実行してください。」
