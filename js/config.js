/**
 * 大正酔いどれクエストⅡ - システム設定ファイル
 */

const APP_CONFIG = {
  // Supabase 接続設定
  supabase: {
    url: 'https://fjpvmbzanbuwwpcjnajt.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcHZtYnphbmJ1d3dwY2puYWp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODg5MjYsImV4cCI6MjEwNTE2NDkyNn0.p_RCrxlxsF7HP0J_zgPP_PY5xDMkeDO00A37jvuDxpo'
  },

  // イベント開催期間
  eventPeriod: {
    startDate: '2026-08-01',
    endDate: '2026-08-31'
  },

  // LINE LIFF 設定
  liff: {
    id: '2011637649-WWv6pnTL'
  },


  // 特典ランク・クーポン獲得マイルストーン設定
  // ※はしご達成の必要店舗数（required_visits）や獲得できる店舗数（selectable_count）はここで簡単に変更できます
  fallbackRewardTiers: [
    {
      id: 1,
      required_visits: 5,
      title: '5軒はしご達成特典',
      selectable_count: 5,
      description: 'クーポン取扱店の中からお好きな5店舗を選んで特典チケットを獲得！'
    },
    {
      id: 2,
      required_visits: 10,
      title: '10軒はしご達成特典',
      selectable_count: 5,
      description: 'クーポン取扱店の中からさらにお好きな5店舗を選んで特典チケットを獲得！'
    }
  ]
};

// グローバル公開
window.APP_CONFIG = APP_CONFIG;
