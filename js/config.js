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


  // 特典ランク・クーポン・グッズ獲得マイルストーン設定（DB接続失敗時のフォールバック）
  // reward_type: 'store_coupon' (店舗クーポン型) または 'goods' (グッズ・記念品引換型)
  fallbackRewardTiers: [
    {
      id: 1,
      reward_type: 'store_coupon',
      required_visits: 5,
      title: '5軒はしご達成特典',
      selectable_count: 5,
      description: 'クーポン取扱店の中からお好きな5店舗を選んで特典チケットを獲得！'
    },
    {
      id: 2,
      reward_type: 'store_coupon',
      required_visits: 10,
      title: '10軒はしご達成特典',
      selectable_count: 5,
      description: 'クーポン取扱店の中からさらにお好きな5店舗を選んで特典チケットを獲得！'
    },
    {
      id: 3,
      reward_type: 'goods',
      required_visits: 15,
      title: '15軒完全制覇記念品',
      selectable_count: 1,
      goods_name: '大正酔いどれ特製トートバッグ',
      exchange_location: '全参加店舗または運営本部にて引換可能',
      exchange_notice: '※お会計時またはご注文時にスタッフへご提示ください。',
      description: '大正酔いどれクエスト特製オリジナルグッズをプレゼント！'
    }
  ],

  // 勇者レベル・称号マスタ設定（デフォルトフォールバック）
  // ※制覇店舗数（min_visits）に応じて称号とレベルを判定
  fallbackHeroTitles: [
    { level: 1, min_visits: 0, title: '駆け出しの呑兵衛', badge_color: '#94a3b8', description: 'まだ1店舗も巡っていない初期状態' },
    { level: 2, min_visits: 1, title: '見習い巡回兵', badge_color: '#38bdf8', description: '最初のハシゴ酒を記録した勇者' },
    { level: 3, min_visits: 3, title: 'ほろ酔い冒険者', badge_color: '#4ade80', description: '順調にハシゴ酒を楽しむ冒険者' },
    { level: 4, min_visits: 5, title: '酒場制覇の豪傑', badge_color: '#facc15', description: '5店舗を制覇した頼もしい豪傑' },
    { level: 5, min_visits: 10, title: '大正の伝説マスター', badge_color: '#f43f5e', description: '10店舗以上を制覇した伝説の呑兵衛' },
    { level: 6, min_visits: 20, title: '酔いどれ覇王', badge_color: '#c084fc', description: '大正区全域を掌握する至高の覇王' },
    { level: 7, min_visits: 33, title: '完全制覇グランドマスター', badge_color: '#eab308', description: '全33店舗を完全制覇した神話の勇者' }
  ]
};

// グローバル公開
window.APP_CONFIG = APP_CONFIG;
