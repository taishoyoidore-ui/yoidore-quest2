# 大正酔いどれクエストⅡ (Taisho Yoidore Quest II)

大阪市大正区で開催されるはしご酒・街巡り回遊イベント「大正酔いどれクエスト」の公式Webアプリケーションおよび運営管理システムです。

---

## 📚 ドキュメント・仕様書（`doc/` 配下）

システムの設計、仕様、改定履歴はすべて [`doc/`](file:///C:/AG_WORK/yoidore-quest2/doc/) ディレクトリ内に集約・管理されています。開発・改修時は必ず最新のドキュメントを参照してください。

| ドキュメント | 概要 | リンク |
| :--- | :--- | :--- |
| **システム仕様書 (本体)** | システム概要、アーキテクチャ、DB設計、UXフロー、API仕様、バックオフィス全項目定義 | [doc/SPECIFICATION.md](file:///C:/AG_WORK/yoidore-quest2/doc/SPECIFICATION.md) |
| **バージョン改定履歴** | 歴代全バージョンの改定内容、バグ修正、機能追加の詳細ログ（Changelog） | [doc/CHANGELOG.md](file:///C:/AG_WORK/yoidore-quest2/doc/CHANGELOG.md) |

---

## 🗂️ ディレクトリ構成

```text
C:\AG_WORK\yoidore-quest2/
├── README.md                   # 本ファイル（プロジェクト概要・ドキュメント案内）
├── index.html                  # 【ユーザーアプリ】メイン画面（案内所、酒場一覧、冒険の書、マップ、QR読取）
├── admin.html                  # 【バックオフィス】運営管理画面（店舗、シーズン、特典、参加者、分析、POP）
├── start_server.bat            # ローカル検証用簡易HTTPサーバー起動スクリプト
├── js/
│   ├── config.js               # システム設定（Supabase接続URL/anonKey、LIFF ID、公式LINE URL等）
│   ├── api.js                  # Supabase REST API通信層（認証、stores、visits、user_coupons、__system_config__）
│   ├── app.js                  # ユーザーアプリ制御層（LIFF初期化、フレンドシップガード、画面遷移、ステータス）
│   └── admin.js                # バックオフィス制御層（Supabase Auth認証、Excel取込、店舗・シーズン・特典管理）
├── css/
│   ├── app.css                 # ユーザーアプリ用スタイルシート（ドラクエ・レトロRPG風テーマ）
│   └── admin.css               # バックオフィス管理画面用スタイルシート（レスポンシブ、ダッシュボード）
├── assets/                     # 共通画像アセット（アイコン、宝箱、バナー等）
├── photo/                      # 店舗外観・料理写真
├── data/                       # インポート用Excel等（店舗アンケート回答シート）
└── doc/                        # 仕様書・ドキュメント・SQL定義
    ├── SPECIFICATION.md        # システム仕様書（Single Source of Truth）
    ├── CHANGELOG.md            # バージョン改定履歴（Changelog）
    └── *.sql                   # 初期SQLスキーマ・マイグレーション用リファレンス
```

---

## 🚀 ローカル起動方法

本システムはビルドツール不要のネイティブ HTML5 / Vanilla JS / CSS3 構成です。

1. `start_server.bat` をダブルクリック（またはターミナルで `python -m http.server 8080` を実行）
2. ブラウザでアクセス:
   - **一般参加者向けアプリ**: `http://localhost:8080/index.html`
   - **運営バックオフィス**: `http://localhost:8080/admin.html`
