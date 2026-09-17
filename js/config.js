/**
 * 大正酔いどれクエストⅡ - システム設定ファイル
 */

const APP_CONFIG = {
  // Supabase 接続設定
  supabase: {
    url: 'https://fjpvmbzanbuwwpcinajt.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcHZtYnphbmJ1d3dwY2puYWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODg5MjYsImV4cCI6MjEwNTE2NDkyNn0.p_RCrxlxsF7HP0J_zgPP_PY5xDMkeDO00A37jvuDxpo'
  },

  // LINE LIFF 設定
  liff: {
    id: '2011634811-l3iZWcv7'
  },

  // 開発・テスト用モック設定（LINE外やPCブラウザで動かした際の自動フォールバック）
  devMock: {
    enabled: true,
    defaultUser: {
      userId: 'mock-hero-001',
      displayName: '酔いどれ勇者タロウ',
      pictureUrl: 'assets/banner.png'
    }
  },

  // 特典デフォルトランク（Supabase取得失敗時のフォールバック用）
  fallbackRewardTiers: [
    {
      id: 1,
      required_visits: 3,
      title: '3軒はしご達成クーポン',
      selectable_count: 1,
      description: 'クーポン対象店舗の中からお好きな1店舗の特典を選べます！'
    },
    {
      id: 2,
      required_visits: 5,
      title: '5軒完全制覇クーポン',
      selectable_count: 5,
      description: 'クーポン対象店舗の中からお好きな5店舗の特典を選べます！'
    }
  ]
};

// グローバル公開
window.APP_CONFIG = APP_CONFIG;
