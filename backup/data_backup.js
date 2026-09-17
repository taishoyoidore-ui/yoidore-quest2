/**
 * 大正酔いどれクエストⅡ - 基本定数定義
 * ※店舗データはすべてデータベース (Supabase) からリアルタイムに直接取得します。
 */

const EVENT_PERIOD = {
  "startDate": "2026-08-01",
  "endDate": "2026-08-31"
};

// 初期店舗配列（空配列で初期化し、100% Supabaseから取得します）
const STORES_DATA = [];

const AREAS_LIST = ['三軒家西', '三軒家東', '駅前', '泉尾', '平尾'];
const CATEGORIES_LIST = ['おばんざい', '居酒屋', '立ち呑み', '中華', 'カフェ', 'バー', 'BAR', '焼肉', 'バル', '食堂'];
const STYLES_LIST = ['テーブルあり', '立ち呑み', 'カウンター'];
const TYPES_LIST = ['腹ごしらえ', 'サク呑み', 'ひと休み', '夜遊び', 'テイクアウト'];

if (typeof window !== 'undefined') {
  window.STORES_DATA = STORES_DATA;
  window.AREAS_LIST = AREAS_LIST;
  window.CATEGORIES_LIST = CATEGORIES_LIST;
  window.STYLES_LIST = STYLES_LIST;
  window.TYPES_LIST = TYPES_LIST;
  window.EVENT_PERIOD = EVENT_PERIOD;
}
