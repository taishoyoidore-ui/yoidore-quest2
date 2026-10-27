/**
 * 大正酔いどれクエスト - システム設定ファイル
 */

const APP_CONFIG = {
  // システム共通バージョン番号（バックオフィス＆アプリ全体で連動）
  version: 'v2026.10.27.08',

  // テスト機能フラグ（QR読取画面のワンタップ達成ボタン＆実績リセットボタンの表示）
  // ※本番運用時はここを false に設定することで、画面上のテスト機能が一括非表示になります（URLに ?test=true を付ければ管理者のみ利用可能）
  testMode: false,

  // Supabase 接続設定
  supabase: {
    url: 'https://fjpvmbzanbuwwpcjnajt.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcHZtYnphbmJ1d3dwY2puYWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODg5MjYsImV4cCI6MjEwNTE2NDkyNn0.p_RCrxlxsF7HP0J_zgPP_PY5xDMkeDO00A37jvuDxpo'
  },

  // 公式LINEアカウント設定
  lineOfficialAccount: {
    addFriendUrl: 'https://line.me/R/ti/p/@277lqewi' // 公式LINE 友だち追加URL
  },

  // LINE LIFF 設定
  liff: {
    id: '2011637649-WWv6pnTL'
  }
};

// グローバル公開
window.APP_CONFIG = APP_CONFIG;
