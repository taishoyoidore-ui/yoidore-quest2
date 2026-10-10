/**
 * 大正酔いどれクエスト - システム設定ファイル
 */

const APP_CONFIG = {
  // システム共通バージョン番号（バックオフィス＆アプリ全体で連動）
  version: 'v2026.10.10.03',

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

  // 案内所ガイダンス（イベント概要・はしご酒の導き・冒険の心得）デフォルトフォールバック
  fallbackSeasonGuidance: {
    overview: '大正区全域に広がる33の個性豊かな酒場をめぐるハシゴ酒RPG！\n各店自慢の限定「酔いどれセット」や「酒場クエスト」に挑み、ハシゴ酒の証を刻んで宝箱（酒場クーポン＆特製グッズ）を解放せよ！',
    guide_steps: [
      { step: '其の一', title: '酒場へ突入せよ', desc: '気になる酒場へ赴き「どれクエ参加」を伝え、限定セットやクエストを発注せよ！' },
      { step: '其の二', title: '冒険の書に刻印せよ', desc: '店内に設置された秘伝のQRコードをカメラで読み取り、制覇スタンプをGET！' },
      { step: '其の三', title: '秘宝の宝箱を開放せよ', desc: 'ハシゴ軒数を重ねて宝箱を解放！酒場クーポンや限定オリジナルグッズを獲得！' }
    ],
    rules_notes: '・飲酒運転および未成年者の飲酒は法律で固く禁じられています。\n・お水（チェイサー）を挟みつつ、無理のないペースでハシゴ酒をお楽しみください。\n・酒場や他の冒険者との出会いを大切に、マナーを守って楽しく乾杯しましょう！'
  },

  // LINE LIFF 設定
  liff: {
    id: '2011637649-WWv6pnTL'
  },

  // 特典ランク・クーポン・グッズ獲得マイルストーン設定（DB接続失敗時のフォールバック）
  // ※称号（hero_title, badge_color）も達成特典テーブルに統合
  fallbackRewardTiers: [
    {
      id: 1,
      reward_type: 'store_coupon',
      required_visits: 5,
      title: '5軒制覇特典',
      selectable_count: 5,
      hero_title: '酒場巡りの冒険者',
      badge_color: '#38bdf8',
      description: '対象酒場からお好きな5軒を選んで特典獲得！'
    },
    {
      id: 2,
      reward_type: 'store_coupon',
      required_visits: 10,
      title: '10軒制覇特典',
      selectable_count: 5,
      hero_title: '百戦錬磨の呑兵衛',
      badge_color: '#4ade80',
      description: '対象酒場からさらにお好きな5軒を選んで特典獲得！'
    },
    {
      id: 3,
      reward_type: 'goods',
      required_visits: 15,
      title: '15軒制覇記念品',
      selectable_count: 1,
      goods_name: '大正酔いどれ特製トートバッグ',
      exchange_location: '全参加酒場または運営本部にて引換可能',
      exchange_notice: '※お会計時またはご注文時にスタッフへご提示ください。',
      hero_title: '大正の酔いどれ勇者',
      badge_color: '#facc15',
      description: '大正酔いどれクエスト特製オリジナルグッズをプレゼント！'
    }
  ],

  // 互換用デフォルト称号（初期Lv.1 等）
  fallbackDefaultTitle: {
    level: 1,
    title: '駆け出しの呑兵衛',
    badge_color: '#94a3b8',
    description: 'まだ特典未獲得の初期冒険者'
  }
};

// グローバル公開
window.APP_CONFIG = APP_CONFIG;
