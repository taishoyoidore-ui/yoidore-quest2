# 大正酔いどれクエスト - システム基本設計・機能仕様書

## 1. 概要と目的

### 1.1 プロジェクト概要
「大正酔いどれクエスト」は、大正区内の飲食店を巡る街ぶら・はしご酒イベント「大正酔いどれクエスト」の公式ガイド＆参加型クエストWebアプリです。

第1回イベントで好評だった「冒険の書（紙）」に店主が手書きサインを書くという**アナログな交流体験**を維持しながら、第2回以降では**LINE公式アカウントと連動したデジタル機能（店主サイン受取・酒場訪問記録・クーポン＆グッズ獲得・店頭消し込み）**を導入し、参加者の利便性向上とリピート促進・周遊促進を実現します。

### 1.2 主な目的
1. **LINE公式アカウントの友達獲得とエンゲージメント強化**: 参加導線をLINE公式アカウントに一本化。過去回次の友だち全員をそのまま引き継ぎ可能。
2. **スマートな酒場訪問（店主サイン受取）記録**: 各店舗に設置されたQRコードを読み取るだけで、店舗スタッフやお客さんに負担をかけずにのべ来店数を冒険の書に記録。
3. **達成度に応じた特典選択機能（クーポン＆グッズ）**: はしご達成店舗数（例: 5軒、10軒、20軒達成）に応じて、対象店舗クーポン（5店舗選択）や限定グッズ引換券（トートバッグ、Tシャツ等）を獲得。
4. **誤操作・権利未行使を防ぐバリデーション**: 店舗クーポン選択時、規定枚数（例: 5店舗）すべてを選択するまで確定ボタンを押せない設計とし、選択途中で権利が失われるトラブルを完全防止。
5. **フェーズに応じたクーポン利用制御**: 本開催中（サイン集め期間）はクーポンの消し込みをロックし、イベント終了翌日〜有効期限までの期間に店舗で使える運用を確立。
6. **確実な店頭消し込み**: 特典利用時に店舗スタッフがスマホ画面上で消し込み操作を実行し、二重利用を防止。
7. **安全な並行運用アーキテクチャ**: 9月末まで稼働している現行イベント・クーポンを一切阻害せず、同じLINEプロバイダー内で完全に共存・切り替え可能な設計。
8. **シーズン制（回次管理）アーキテクチャ**: 第2回、第3回、第4回…とソースコードの再構築なしにバックオフィスからワンクリックで開催回を切り替えられる設計。
9. **バックオフィスデータ管理（完全リセット・削除・状態復元）**: 管理画面からユーザー、来店ログ、クーポン、特典ランク、称号マスタを個別・一括で安全に登録・削除・状態変更できる運用設計。

---

## 2. システム構成・アーキテクチャ

```mermaid
flowchart TD
    subgraph LINE [LINE プラットフォーム (プロバイダー: 大正酔いどれ)]
        LineOA[大正酔いどれ公式<br/>(Messaging API / 既存友だち)]
        CurrentLIFF[現行クーポンLIFF<br/>(9月末まで通常稼働)]
        LIFF[大正酔いどれクエストⅡ LIFF<br/>(LIFF ID: 2011637649-WWv6pnTL)]
    end

    subgraph Client [クライアント (Webアプリ / GitHub Pages)]
        App[レトロRPG風 Webアプリ<br/>HTML5 / CSS3 / JavaScript]
        QRScanner[店頭QRコード読み取り<br/>①通常スマホカメラ / ②アプリ内スキャナー]
        CouponUI[冒険の書 / クーポン＆グッズ引換 / 店頭消し込みUI]
        NoticeBanner[開催・クーポン利用期限動的バナー]
    end

    subgraph Backend [バックエンド (Supabase BaaS / Single Source of Truth)]
        Auth[LINE UID 認証・ユーザー管理]
        DB[(PostgreSQL データベース<br/>seasons / stores / users / visits / user_coupons / reward_tiers / hero_titles)]
        Storage[(店舗ロゴ / 写真画像)]
    end

    subgraph Admin [バックオフィス運営管理システム (admin.html)]
        Dashboard[KPIダッシュボード / ランキング]
        StoreManage[店舗マスターCRUD / 特典対象ON/OFF]
        SeasonManage[シーズン作成・開催日程・アクティブ切替]
        TierManage[特典ランクCRUD (クーポン型/グッズ型)]
        TitleManage[勇者レベル・称号マスタ管理]
        DataManage[ユーザー・来店ログ・クーポン削除 & 状態復元]
        POPGen[全店舗A4卓上POP一括印刷・QR生成]
    end

    LineOA -->|トーク画面・リッチメニューから起動| LIFF
    LIFF -->|LINE UID / プロフィール連携| App
    App -->|リアルタイムデータ送受信| Backend
    QRScanner -->|店主サイン受取 (?checkin=store-XX)| App
    NoticeBanner -->|フェーズ状態判定| App
    Admin -->|運営・削除・設定変更| DB
```

---

## 3. ユーザー体験（UX）フロー

```mermaid
sequenceDiagram
    autonumber
    actor User as 参加者 (お客さま)
    actor Shop as 店舗 / スタッフ
    participant LINE as LINE公式アカウント / LIFF
    participant App as 酔いどれクエストアプリ
    participant DB as データベース (Supabase)

    Note over User, LINE: 1. イベント参加・リピーター判定
    User->>LINE: 公式LINEトーク画面から「クエスト開始」タップ
    LINE->>App: LIFF起動（LINEユーザーID・表示名・アイコンを自動取得）
    App->>DB: ユーザー登録確認 / 過去シーズン来店実績検索
    alt 過去回次の参加実績あり
        App-->>User: 「🎖️ おかえりなさい！歴戦の古参勇者よ！」（限定称号授与）
    else 初参加
        App-->>User: レトロRPGスタート画面（冒険の書オープン）
    end

    Note over User, Shop: 2. 酒場訪問 ＆ 店主サイン受取
    User->>Shop: 入店・注文（「酔いどれセット」や「店舗クエスト」）
    User->>App: ボトムナビ「📷 サイン受取」より店頭QRを読み取る
    App->>DB: 来店ログ記録 (user_id, store_id, season_id, visited_at)
    App-->>User: 「〇〇酒場 を冒険の書に記録した！」（ファンファーレ演出＆✅冒険済マーク）

    Note over User, App: 3. はしご達成 ＆ 特典獲得（クーポン・グッズ）
    User->>App: 規定軒数（例: 5軒・10軒・20軒）はしご達成
    App-->>User: 「🎁 特典宝箱がアンロックされました！」
    alt 店舗クーポン型特典
        User->>App: 宝箱をタップ ➔ 対象店舗から【5店舗】を選択<br/>（※規定店舗数すべて選ぶまで確定ボタンはロック）
        App->>DB: クーポン獲得データを保存 (user_coupons: season_id紐付け)
        App-->>User: 「🎉 5店舗のクーポンを獲得しました！」
    else 記念品・グッズ引換型特典
        User->>App: 宝箱をタップ ➔ グッズ引換券（トートバッグ・Tシャツ等）を即時獲得
        App->>DB: グッズ引換券データを保存 (reward_type: 'goods')
        App-->>User: 「🎁 記念品引換券を獲得しました！」
    end

    Note over User, Shop: 4. 特典利用・店頭消し込み
    User->>Shop: 店舗でクーポンまたはグッズ引換画面を提示
    alt 本開催期間中（クーポン利用期間前）
        App-->>User: 「🔒 クーポン利用期間前（📅 イベント終了翌日〜）」案内表示（消し込みボタン無効化）
    else クーポン利用期間内（イベント終了翌日〜有効期限）
        Shop->>App: スタッフ専用「使用済みにする」ボタンをタップ
        App->>DB: クーポン状態を「使用済み (used)」に更新
        App-->>Shop: 消し込み完了スタンプ（USED）表示
    else 有効期限終了後
        App-->>Shop: 「🔒 有効期限終了」警告表示（消し込みボタン無効化）
    end
```

---

## 4. データベース設計 (Supabase / PostgreSQL)

```mermaid
erDiagram
    seasons ||--o{ reward_tiers : "シーズンごとの特典ルール"
    seasons ||--o{ visits : "シーズンごとの来店ログ"
    seasons ||--o{ user_coupons : "シーズンごとのクーポン"
    users ||--o{ visits : "1ユーザー 対 多来店ログ"
    stores ||--o{ visits : "1店舗 対 多来店ログ"
    users ||--o{ user_coupons : "1ユーザー 対 多クーポン"
    stores ||--o{ user_coupons : "1店舗 対 多クーポン"

    seasons {
        int id PK "シーズン番号 (2, 3, 4...)"
        string name "イベント名称 (例: 大正酔いどれクエストⅡ)"
        date start_date "開始日 (本開催初日)"
        date end_date "終了日 (本開催最終日)"
        date coupon_valid_until "クーポン利用有効期限"
        boolean is_active "現在アクティブ（開催中）フラグ"
        text description "説明文"
    }

    users {
        string line_user_id PK "LINE User ID"
        string display_name "LINE表示名"
        string picture_url "アイコン画像URL"
        timestamp created_at "初回利用日時"
        timestamp last_active_at "最終アクセス日時"
    }

    stores {
        string id PK "店舗ID (例: store-01)"
        string name "店舗名"
        string area "エリア (三軒家西, 三軒家東, 泉尾など)"
        string category "ジャンル (おばんざい, 居酒屋, 焼肉など)"
        string style "席スタイル (立呑み, テーブルあり, カウンター)"
        string yoidore_type "酔いどれタイプ (サク飲み, 腹ごしらえなど)"
        boolean takeout "テイクアウト可否"
        string catchphrase "キャッチコピー"
        string days "提供日 (月,火,水...)"
        string hours "提供時間"
        string payment "決済方法"
        string set_name "酔いどれセット名"
        string set_content "セット内容"
        int set_price "セット価格"
        string set_charge "チャージ有無"
        string set_limit "限定数"
        string set_notes "セット注意事項"
        string quest_name "クエスト名"
        string quest_content "クエスト内容"
        int quest_price "クエスト価格"
        string map_url "Google Map URL"
        string insta_url "Instagram URL"
        string photo_url "店舗写真URL"
        string logo_url "ロゴ画像URL"
        boolean is_coupon_target "クーポン取扱店フラグ (true/false)"
        int display_order "並び順"
    }

    reward_tiers {
        int id PK "特典ランクID"
        int season_id FK "シーズンID"
        string reward_type "特典種別 (store_coupon: 店舗クーポン / goods: グッズ引換)"
        int required_visits "必要来店店舗数 (例: 5, 10, 20)"
        string title "特典名 (例: 5軒ハシゴ達成特典 / 特製トートバッグ)"
        int selectable_count "選択可能店舗数 (クーポン型の場合、例: 5)"
        string goods_name "グッズ名称 (グッズ型の場合)"
        string exchange_location "引換場所 (グッズ型の場合)"
        string exchange_notice "引換注意事項 (グッズ型の場合)"
        string description "説明文"
    }

    hero_titles {
        int id PK "称号ID"
        int level "勇者レベル (1, 2, 3...)"
        int min_visits "必要制覇店舗数 (0, 1, 3, 5, 10, 20...)"
        string title "勇者称号名 (例: 駆け出しの呑兵衛, 大正の酔いどれ勇者)"
        string badge_color "バッジカラーコード (#facc15, #3b82f6 等)"
        int display_order "並び順"
        string description "称号説明文"
    }

    visits {
        uuid id PK "来店ログID"
        int season_id FK "シーズンID"
        string user_id FK "LINE User ID (CASCADE DELETE)"
        string store_id FK "店舗ID"
        timestamp visited_at "来店日時"
    }

    user_coupons {
        uuid id PK "ユーザー所持クーポンID"
        int season_id FK "シーズンID"
        string user_id FK "LINE User ID (CASCADE DELETE)"
        string store_id FK "選択した店舗ID (グッズ型の場合はnull)"
        int reward_tier_id FK "達成ランクID"
        string reward_type "特典種別 (store_coupon / goods)"
        string goods_name "グッズ名称 (グッズ型の場合)"
        string exchange_location "引換場所 (グッズ型の場合)"
        string exchange_notice "引換注意事項 (グッズ型の場合)"
        string status "状態 (active: 未使用 / used: 使用済み / expired: 期限切れ)"
        timestamp acquired_at "獲得日時"
        timestamp used_at "使用日時"
    }
```

---

## 5. 実装機能一覧

| モジュール | 機能名 | 詳細・運用仕様 |
| :--- | :--- | :--- |
| **ユーザーアプリ** | **アプリ内蔵カメラQRリーダー** | ボトムナビ中央の「📷 サイン受取」から即座にWebカメラを起動し、卓上POPのQRコードを高速スキャン。 |
| **ユーザーアプリ** | **外部カメラ直接サイン受取** | スマホ標準カメラやLINE QRリーダーからの読み取り時も、自動ログイン後にシームレスに来店記録を実行。 |
| **ユーザーアプリ** | **RPG風達成演出モーダル** | サイン受取成功時にファンファーレとともに「店舗名」「制覇数」「宝箱アンロック通知」をリッチに表示。 |
| **ユーザーアプリ** | **1シーズン1店舗1回制限** | 同一店舗への重複スキャン時は「すでに冒険の書に記録済みです」と案内し、二重カウントを確実に防止。 |
| **ユーザーアプリ** | **開催フェーズ動的バナー** | 本開催中・後夜祭（クーポン利用期間）・期間終了の3状態を自動検知してヘッダーにリアルタイム告知。 |
| **ユーザーアプリ** | **リピーター自動判定** | 過去シーズンの来店実績を検出し「🎖️ 歴戦の古参勇者」の限定称号と初回歓迎モーダルを表示。 |
| **ユーザーアプリ** | **クーポン規定数完全選択** | 規定数（例: 5店舗）すべてを選択するまで確定ボタンをロックし、誤操作による権利消失を防止。 |
| **ユーザーアプリ** | **クーポン利用期間制御** | 本開催期間中はクーポン消し込みをロックし「📅 イベント終了翌日〜利用可能」の旨を表示。後夜祭期間に消し込みボタンを有効化。 |
| **ユーザーアプリ** | **記念品・グッズ引換対応** | 店舗クーポンだけでなく、トートバッグやTシャツ等のグッズ引換券の発行・店舗/本部消し込みに対応。 |
| **ユーザーアプリ** | **テスト用サイン記録機能** | 開発・事前検証用として、+5店舗、+10店舗、+15店舗のサイン一括付与および履歴リセットボタンを搭載。 |
| **バックオフィス** | **特典ランク・宝箱管理** | 店舗クーポン型／グッズ引換型の2系統に対応し、必要来店数やグッズ引換情報を完全GUIで新規作成・編集・削除。 |
| **バックオフィス** | **勇者レベル＆称号マスタ管理** | 制覇店舗数（0軒〜、1軒〜、3軒〜、5軒〜、10軒〜…）に応じたレベル・称号名・バッジカラー・説明文を追加・編集・削除。 |
| **バックオフィス** | **シーズン制（回次）管理** | 第2回、第3回…の新規作成、開催日程・クーポン利用期限設定、ワンクリックアクティブ切り替え。 |
| **バックオフィス** | **ユーザー完全削除** | ユーザーと紐づく来店履歴・獲得クーポンをカスケードで完全削除（テストデータ消去・初期化対応）。 |
| **バックオフィス** | **来店ログ個別削除** | 誤スキャンやテスト来店記録の個別取り消し。 |
| **バックオフィス** | **クーポン削除・状態切替** | クーポンデータの削除、および誤消し込み時の「未使用に戻す」ワンタップ復元。 |
| **バックオフィス** | **店舗マスター管理** | 33店舗の情報編集、新規追加、クーポン対象フラグの即時切替。 |
| **バックオフィス** | **全店舗POP一括印刷** | 全33店舗の卓上QRコードPOP（A4レイアウト）を即座に印刷・PDF出力。 |
| **バックオフィス** | **CSVエクスポート** | 参加者一覧、来店履歴、クーポン利用状況をExcel互換形式（UTF-8 BOM）で出力。 |

---

## 6. 店舗マスター ＆ アンケートExcelインポート仕様

### 6.1 アンケートExcelの全体構造（3セクション・全38列）
店舗情報アンケート（Googleフォーム集計結果）は、企画参加形態に応じた**条件分岐（セクション分岐）**を持つ特殊なレイアウト構造となっています。

```mermaid
flowchart TD
    A["① 基本共通情報 (A〜N列)<br>店名・エリア・営業日時・決済・クーポン"] --> Branch{"O列：どの企画で参加？"}
    
    Branch -->|"「酔いどれセット」のみ"| Sec1["②-1: セット専用列 (P〜U列)<br>セット名・内容・備考・価格・チャージ・限定数"]
    Branch -->|"「店舗クエスト」のみ"| Sec2["②-2: クエスト専用列 (V〜Z列)<br>クエスト名・内容/報酬・料金・チャージ・備考"]
    Branch -->|"両方で参加"| Sec3["②-3: 両方専用列 (AA〜AK列)<br>セット(AA〜AF) + クエスト(AG〜AK)"]
    
    Sec1 --> Tail["③ 共通末尾 (AL列)<br>参加証(缶バッチ)販売希望数"]
    Sec2 --> Tail
    Sec3 --> Tail
```

---

### 6.2 企画選択（O列）による条件分岐抽出仕様

* **【酔いどれセット情報の抽出元】**:
  * `O列` が `「酔いどれセット」のみで参加` ➔ **P〜U列** からセット名・内容・備考・価格・チャージ・限定数を抽出（クエスト項目は空・0・不要）
  * `O列` が `「酔いどれセット」・「店舗クエスト」両方で参加` ➔ **AA〜AF列** からセット名・内容・備考・価格・チャージ・限定数を抽出
  * `O列` が `「店舗クエスト」のみで参加` ➔ セット項目は空・0・不要
* **【店舗クエスト情報の抽出元】**:
  * `O列` が `「店舗クエスト」のみで参加` ➔ **V〜Z列** からクエスト名・内容/報酬・料金・チャージ・備考を抽出（セット項目は空・0・不要）
  * `O列` が `「酔いどれセット」・「店舗クエスト」両方で参加` ➔ **AG〜AK列** からクエスト名・内容/報酬・料金・チャージ・備考を抽出
  * `O列` が `「酔いどれセット」のみで参加` ➔ クエスト項目は空・0・不要

---

### 6.3 Excel列 ➔ データベース統一JSON ➔ UI 項目対照表

| Excel列（全38列） | データベース統一JSONキー | 型 | アプリ画面（ユーザー画面） | バックオフィス管理画面 |
|---|---|---|---|---|
| A: タイムスタンプ | *(取込判定用)* | string | - | - |
| B: 店名 | `name` | string | 酒場名タイトル | 酒場名（正式名称） |
| C: 参加意思 | *(取込判定用)* | string | （参加店舗のみ表示） | 取り込み対象判定 |
| D: エリア | `area` | string | エリアバッジ (三軒家西/東/駅前/泉尾/平尾) | エリア選択 |
| E: カテゴリ | `category` | string | カテゴリバッジ (居酒屋, おばんざい等) | ジャンル/カテゴリ |
| F: スタイル | `style` | string | 席スタイル情報 | 席スタイル |
| G: タイプ | `type` | string | 酔いどれタイプ (サク飲み/腹ごしらえ等) | 酔いどれタイプ |
| H: テイクアウト | `takeout` | string | テイクアウトバッジ (OK/不可/専門) | テイクアウト |
| I: 提供曜日 | `days` | string | 提供曜日 (`月,火,水,木,金,土`) | 提供曜日チェック |
| J: 提供時間：開始<br>K: 提供時間：終了 | `hours` | string | 提供時間 (`17:00〜22:00`) | 提供時間 |
| L: 提供時間に対する補足 | `time_notes` | string | **💡 提供時間補足バッジ** | **提供時間・補足** |
| M: 決済方法 | `payment` | string | 利用可能な決済方法 | 決済方法 |
| N: 店舗クーポン希望 | `is_coupon_target` | boolean | 🎁 クーポン対象バッジ | クーポン対象チェック |
| O: 参加企画 | `plan_type` | string | （セット/クエスト/両方の表示制御） | 参加企画 |
| P / AA: 酔いどれセット名 | `set_name` | string | セット名見出し | セット名 |
| Q / AB: 酔いどれセット内容 | `set_content` | string | セット内容詳細 | セット内容 |
| R / AC: セット内容備考 | `set_notes` | string | セット備考・注記 | セット内容備考 |
| S / AD: 価格(税込) | `set_price` | number | セット価格 (`¥1,000`) | 価格(税込) |
| T / AE: チャージ料(税込) | `set_charge` | string | チャージ料 (`不要` / `¥300`) | チャージ料 |
| U / AF: 限定数量 | `set_limit` | string | 限定数量 (`無くなるまで`等) | 限定数量 |
| V / AG: クエスト名 | `quest_name` | string | クエストカード見出し | クエスト名 |
| W / AH: クエスト内容/報酬 | `quest_content` | string | クエスト達成条件・報酬 | クエスト内容/報酬 |
| X / AI: クエスト料金(税込) | `quest_price` | number | クエスト参加料金 | クエスト料金 |
| Y / AJ: クエストチャージ料 | `quest_charge` | string | クエストチャージ | クエストチャージ |
| Z / AK: クエスト備考 | `quest_notes` | string | クエスト注意事項 | クエスト備考 |
| AL: 缶バッチ販売希望数 | `badge_sales_count` | string | - | 缶バッチ希望数 |
| *(システム保持)* キャッチコピー | `catchphrase` | string | 酒場カードのサブコピー | キャッチコピー |
| *(システム保持)* Google Map URL | `map_url` | string | 地図を開くボタン | Google Map URL |
| *(システム保持)* Instagram URL | `insta_url` | string | Instagramリンク | Instagram URL |
| *(システム保持)* 店舗写真 | `photo_url` | string | 写真画像 (`photo/002.jpg`) | 写真ファイル名 |
| *(システム保持)* 店舗ロゴ | `logo_url` | string | ロゴ画像 (`logo/002.png`) | ロゴファイル名 |

---

### 6.4 データ型・クレンジング・正規化ルール

1. **提供時間（`hours`）**:
   - Excel内部の小数シリアル値（例: `0.5`, `0.625`, `0.708`）やTime型を判定し、`HH:mm〜HH:mm` 形式（例: `15:00〜22:30`, `12:00〜00:00`）へ自動変換。
2. **提供曜日（`days`）**:
   - `全て` ➔ `月,火,水,木,金,土,日`
   - 「月曜日」「火曜日」等の「曜日」の「日」に誤爆しないよう正規表現（`/日曜日|日曜/`）で厳密に判定し、`月,火,水,木,金,土` 形式に正規化。
3. **価格・料金（`set_price`, `quest_price`）**:
   - `800円(税込)`, `2,000円`, `1000` などの文字列から数字のみを抽出し、**数値型（`number`）** として格納。
4. **チャージ料・限定数量（`set_charge`, `set_limit` 等）**:
   - `None` や空文字は `不要` または `""` にクレンジングし、酒場の自由記述（例: `酔いどれセットの方は０円`, `おばんざいが無くなるまで。`）をそのまま尊重して保持。
5. **スタイル（`style`）**:
   - `テールブあり` などの誤字補正を行いながら、`カウンターメイン、テーブル1席あり` などの詳細記述をそのまま維持。
6. **既存マスタ情報保護（写真・ロゴ・地図URL・キャッチコピー）**:
   - アンケートExcelに含まれないシステム管理項目（`photo_url`, `logo_url`, `map_url`, `insta_url`, `catchphrase`）は、インポート時に既存マスタ（DB）の値を自動継承し、空文字上書きを防止。

---

### 6.5 統一JSONスキーマ定義（stores テーブル raw_data）

データベース（Supabase `stores` テーブルの `raw_data`）には、日本語キーや重複キーを一切含まず、以下の**スネークケース英語キー**で統一保存されます。

```json
{
  "id": "store-01",
  "name": "Tようび",
  "area": "三軒家西",
  "category": "おばんざい",
  "style": "テーブルあり",
  "type": "サク飲み",
  "takeout": "テイクアウトOK",
  "days": "火,水,木,金,土,日",
  "hours": "17:00〜22:00",
  "time_notes": "土日祝は15時～22時",
  "payment": "現金, paypay, クレジットカード, d払い、楽天pay、aupay、wesmo",
  "is_coupon_target": true,
  "plan_type": "「酔いどれセット」のみで参加",
  "set_name": "選べるおばんざい3種セット",
  "set_content": "おばんざい小盛3種+ドリンク1杯",
  "set_price": 800,
  "set_charge": "酔いどれセットの方は０円",
  "set_limit": "おばんざいが無くなるまで。",
  "set_notes": "数種類あるおばんざいから3種類選べます。",
  "quest_name": "",
  "quest_content": "",
  "quest_price": 0,
  "quest_charge": "不要",
  "quest_notes": "",
  "badge_sales_count": "",
  "catchphrase": "牛すじとお酒とおばんざい",
  "map_url": "https://maps.app.goo.gl/zEmF7y9d2rdJpG8a7",
  "insta_url": "https://www.instagram.com/t_youbi_",
  "photo_url": "photo/001.jpg",
  "logo_url": "logo/001.png"
}
```

---

### 6.6 バックオフィス店舗入力・編集画面（admin.html）の連携仕様

1. **席スタイル（`style`）の自由記述対応**:
   - 既定選択肢（`テーブルあり`, `カウンター`, `立ち飲み`, `テイクアウト専門`）に加え、`その他 (直接入力)` をサポート。
   - アンケートで自由入力された詳細（例: `カウンターメイン、テーブル1席あり`）を丸めずに保持・編集可能とする。
2. **参加企画（`plan_type`）の選択**:
   - `両方で参加` / `「酔いどれセット」のみで参加` / `「店舗クエスト」のみで参加` のプルダウン選択を新設。
3. **参加証(缶バッチ)販売希望数（`badge_sales_count`）の確認・編集**:
   - アンケートAL列の回答を確認・編集できる入力フィールドを画面上に配置。
4. **決済方法（`payment`）の双方向同期**:
   - チェックボックス（現金/カード/PayPay等）と、「その他決済」テキスト欄を組み合わせて自由記述（QR決済の種類等）を漏れなく保持。
5. **店舗情報の確実な保存・即時反映（CRUD安定化）**:
   - 既存店舗の編集保存時は `PATCH stores?id=eq.{id}`（または UPSERT）で確実にDBを更新し、APIキャッシュバスターを介して最新マスタを即座に再取得・画面再描画を実行。

