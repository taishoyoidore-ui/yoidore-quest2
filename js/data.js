/**
 * 大正酔いどれクエストⅡ - 店舗マスターデータ
 * ※このファイルは convert_xlsx_to_js.py によって STORES.xlsx から自動生成されたものです。
 * ※直接編集せず、STORES.xlsx を編集した後に update_data.bat を実行してください。
 */

const EVENT_PERIOD = {
  "startDate": "2026-08-01",
  "endDate": "2026-08-31"
};

const STORES_DATA = [
  {
    "id": "store-01",
    "name": "Tようび",
    "ruby": "てぃーようび",
    "area": "三軒家西",
    "category": "おばんざい",
    "type": "食事向け",
    "isOpenToday": true,
    "isQuestActive": true,
    "quest": {
      "title": "ジャンケン勝負！",
      "price": 0,
      "charge": "不要",
      "content": "ジャンケン勝負！勝ったらクーポン進呈！",
      "notes": "1名様1日1回まで"
    },
    "catchphrase": "牛すじとお酒とおばんざい",
    "yoidoreSet": {
      "title": "おばんざい軽盛り3種+ドリンク1杯",
      "content": "お好きなおばんざい3種と、お好きなドリンク1杯のセットです",
      "price": 1000,
      "charge": "不要",
      "includeCharge": false,
      "notes": "冒険の書（紙）をご提示された方限定。他クーポン併用不可。"
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "限定30セット / 日",
      "soldOutEnd": true
    },
    "paymentMethods": [
      "現金",
      "PayPay",
      "クレジットカード"
    ],
    "googleMapUrl": "https://maps.app.goo.gl/zEmF7y9d2rdJpG8a7",
    "instagramUrl": "https://www.instagram.com/t_youbi_",
    "photoUrl": "photo/001.jpg",
    "mapPos": {
      "top": "34%",
      "left": "42%"
    }
  },
  {
    "id": "store-02",
    "name": "BAR 8-BIT QUESTZ",
    "ruby": "ばー はちびっとくえすと",
    "area": "三軒家西",
    "category": "BAR",
    "type": "休憩向け",
    "isOpenToday": true,
    "isQuestActive": true,
    "quest": {
      "title": "レトロゲームチャレンジ",
      "price": 0,
      "charge": "不要",
      "content": "店主とワンゲーム対戦でチャージ割引！",
      "notes": "※酔いどれセットご注文の方はチャージ重複なし。"
    },
    "catchphrase": "どこか懐かしいピコピコ音が流れる、大人の隠れ家バー",
    "yoidoreSet": {
      "title": "魔法のカクテル＆スモーキーナッツセット",
      "content": "特製青いポーションカクテル（またはハイボール） ＋ 自家製燻製ナッツ",
      "price": 1200,
      "charge": "不要",
      "includeCharge": false,
      "notes": "チャージ料金（通常500円）はセット価格に含まれます。"
    },
    "conditions": {
      "days": "金,土,日",
      "hours": "19:00-02:00",
      "limit": "1日15セット限定",
      "soldOutEnd": true
    },
    "paymentMethods": [
      "現金",
      "クレジットカード",
      "電子マネー"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区三軒家西1",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "41%",
      "left": "53%"
    }
  },
  {
    "id": "store-03",
    "name": "スナック 大正ロマン",
    "ruby": "すなっく たいしょうろまん",
    "area": "泉尾",
    "category": "スナック",
    "type": "はしご向け",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "昭和・大正の情緒漂う商店街の名物ママがいるアットホームスナック",
    "yoidoreSet": {
      "title": "昭和レトロカラオケ＆酔いどれ焼酎セット",
      "content": "こだわり芋・麦焼酎（ロックまたは水割り）2杯 ＋ おまかせ手作りお通し3種盛り ＋ カラオケ1曲無料",
      "price": 1500,
      "charge": "不要",
      "includeCharge": false,
      "notes": "混雑時はお席90分制とさせていただきます。"
    },
    "conditions": {
      "days": "火,水,木,金,土,日",
      "hours": "18:00-23:30",
      "limit": "数量制限なし",
      "soldOutEnd": false
    },
    "paymentMethods": [
      "現金",
      "PayPay"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区泉尾2",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "48%",
      "left": "64%"
    }
  },
  {
    "id": "store-04",
    "name": "純喫茶＆バル たいしょう",
    "ruby": "じゅんきっさあんどばる たいしょう",
    "area": "千島",
    "category": "カフェ",
    "type": "休憩向け",
    "isOpenToday": true,
    "isQuestActive": true,
    "quest": {
      "title": "喫茶クエスチョン",
      "price": 0,
      "charge": "不要",
      "content": "店内のレトロ謎解き成功でミニデザートプレゼント！",
      "notes": "※喫茶・カフェタイムからのご参加も大歓迎です！"
    },
    "catchphrase": "昼は濃厚ナポリタン、夜はクラフトビールが楽しめる和洋折衷カフェ",
    "yoidoreSet": {
      "title": "大正浪漫クラフトビール＆厚切りガーリックトーストセット",
      "content": "選べる地ビール1本 ＋ サクサク濃厚ガーリックトースト2切れ",
      "price": 1000,
      "charge": "不要",
      "includeCharge": false,
      "notes": "カフェタイム（15:00〜）から注文可能です。"
    },
    "conditions": {
      "days": "月,火,木,金,土,日",
      "hours": "15:00-21:00",
      "limit": "限定20セット",
      "soldOutEnd": true
    },
    "paymentMethods": [
      "現金",
      "PayPay",
      "クレジットカード",
      "電子マネー"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区千島1",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "55%",
      "left": "75%"
    }
  },
  {
    "id": "store-05",
    "name": "ホルモン焼肉 酔魔神",
    "ruby": "ほるもんやきにく よいまじん",
    "area": "平尾",
    "category": "焼肉",
    "type": "食事向け",
    "isOpenToday": true,
    "isQuestActive": true,
    "quest": {
      "title": "肉くじクエスト",
      "price": 0,
      "charge": "不要",
      "content": "特賞は「極上A5カルビ1皿無料券」！",
      "notes": "※酔いどれセットご注文のお客さま1名につき1回挑戦可能！"
    },
    "catchphrase": "秘伝のタレと新鮮ホルモン！スタミナ回復ならここにおまかせ！",
    "yoidoreSet": {
      "title": "スタミナ回復！メガハイボール＆ホルモン3種盛りセット",
      "content": "メガ角ハイボール ＋ 本日の新鮮ホルモン3種（塩タン・ハツ・ミノ）",
      "price": 1300,
      "charge": "込",
      "includeCharge": true,
      "notes": "別途ワンドリンク制ではありませんが、テーブルチャージ200円が加算されます。"
    },
    "conditions": {
      "days": "月,火,木,金,土,日",
      "hours": "17:00-22:30",
      "limit": "限定25セット",
      "soldOutEnd": true
    },
    "paymentMethods": [
      "現金",
      "PayPay"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区平尾3",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "62%",
      "left": "26%"
    }
  },
  {
    "id": "store-06",
    "name": "お好み焼き 鉄板クエスト",
    "ruby": "おこのみやき てっぱんくえすと",
    "area": "三軒家西",
    "category": "お好み焼き",
    "type": "食事向け",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "外はカリッ、中はふわふわ！大正名物のすじkon焼きが自慢",
    "yoidoreSet": {
      "title": "大正名物すじコン焼き＆こだわりチューハイセット",
      "content": "名物すじコン玉（ミニサイズ） ＋ プレーンチューハイ（またはソフトドリンク）",
      "price": 1000,
      "charge": "不要",
      "includeCharge": false,
      "notes": "テイクアウトも可能です（箱代別途50円）。"
    },
    "conditions": {
      "days": "月,火,水,木,金,土,日",
      "hours": "16:30-22:00",
      "limit": "限定30セット",
      "soldOutEnd": true
    },
    "paymentMethods": [
      "現金",
      "PayPay",
      "QR決済"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区三軒家西2",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "69%",
      "left": "37%"
    }
  },
  {
    "id": "store-07",
    "name": "ダイニング ギルドバル",
    "ruby": "だいにんぐ ぎるどばる",
    "area": "駅前エリア",
    "category": "ダイニング",
    "type": "食事向け",
    "isOpenToday": true,
    "isQuestActive": true,
    "quest": {
      "title": "パーティークエスト",
      "price": 0,
      "charge": "不要",
      "content": "4人以上のパーティ来店でボトルワイン1本半額！",
      "notes": "※4名以上のパーティ来店で自動適用されます！"
    },
    "catchphrase": "洋風バルメニューと厳選ワインが揃う、冒険者たちの宴会場",
    "yoidoreSet": {
      "title": "ギルド特製生ハム盛り合わせ＆グラスワインセット",
      "content": "スパークリングまたは赤・白ワイン1グラス ＋ スペイン産生ハムとチーズ盛り合わせ",
      "price": 1200,
      "charge": "不要",
      "includeCharge": false,
      "notes": "テーブル席・カウンター席どちらでも利用いただけます。"
    },
    "conditions": {
      "days": "火,水,木,金,土,日",
      "hours": "17:30-23:00",
      "limit": "1日20セット",
      "soldOutEnd": false
    },
    "paymentMethods": [
      "現金",
      "クレジットカード",
      "PayPay",
      "電子マネー"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区三軒家東2",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "76%",
      "left": "48%"
    }
  },
  {
    "id": "store-08",
    "name": "海鮮居酒屋 昭和横丁",
    "ruby": "かいせんいざかや しょうわよこちょう",
    "area": "泉尾",
    "category": "居酒屋",
    "type": "はしご向け",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "毎朝市場から仕入れる新鮮な魚介と日本酒が勢ぞろい！",
    "yoidoreSet": {
      "title": "本日の厳選お刺身3種盛り＆冷酒ぐい呑みセット",
      "content": "おすすめ地酒1杯 ＋ 旬の鮮魚お刺身3種盛り",
      "price": 1000,
      "charge": "不要",
      "includeCharge": false,
      "notes": "仕入れ状況により刺身の内容が変わります。"
    },
    "conditions": {
      "days": "月,火,水,木,金,土",
      "hours": "17:00-22:30",
      "limit": "限定20セット",
      "soldOutEnd": true
    },
    "paymentMethods": [
      "現金",
      "PayPay"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区泉尾1",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "23%",
      "left": "59%"
    }
  },
  {
    "id": "store-09",
    "name": "クラフトBAR クラーケン",
    "ruby": "くらふとばー くらーけん",
    "area": "千島",
    "category": "BAR",
    "type": "はしご向け",
    "isOpenToday": true,
    "isQuestActive": true,
    "quest": {
      "title": "ダーククエスト",
      "price": 500,
      "charge": "込",
      "content": "黒ビールご注文でオリジナルステッカープレゼント！",
      "notes": "※ステッカーは無くなり次第終了となります。"
    },
    "catchphrase": "世界のクラフトビールが常時8种タップで味わえる本格タップルーム",
    "yoidoreSet": {
      "title": "",
      "content": "",
      "price": 0,
      "charge": "込",
      "includeCharge": true,
      "notes": "チャージなし。"
    },
    "conditions": {
      "days": "水,木,金,土,日",
      "hours": "18:00-00:00",
      "limit": "限定15セット",
      "soldOutEnd": true
    },
    "paymentMethods": [
      "現金",
      "クレジットカード",
      "電子マネー"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区千島2",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "30%",
      "left": "70%"
    }
  },
  {
    "id": "store-10",
    "name": "沖縄ダイニング 琉球クエスト",
    "ruby": "おきなわだいにんぐ りゅうきゅうくえすと",
    "area": "平尾",
    "category": "ダイニング",
    "type": "食事向け",
    "isOpenToday": true,
    "isQuestActive": true,
    "quest": {
      "title": "三線ライブクエスト",
      "price": 0,
      "charge": "不要",
      "content": "毎週土曜夜は三線ライブ開催！盛り上がろう！",
      "notes": "※土曜夜限定の特別ライブイベントです！"
    },
    "catchphrase": "「リトル沖縄」大正区ならではの本格沖縄料理と泡盛の店",
    "yoidoreSet": {
      "title": "オリオン生ビール＆じっくり煮込んだラフテーセット",
      "content": "オリオン生ビール1杯 ＋ とろとろ自家製ラフテー（豚角煮）",
      "price": 1000,
      "charge": "不要",
      "includeCharge": false,
      "notes": "泡盛への変更も可能です。"
    },
    "conditions": {
      "days": "月,火,水,木,金,土,日",
      "hours": "17:00-23:00",
      "limit": "限定30セット",
      "soldOutEnd": true
    },
    "paymentMethods": [
      "現金",
      "PayPay",
      "クレジットカード"
    ],
    "googleMapUrl": "https://maps.google.com/?q=大阪府大阪市大正区平尾2",
    "instagramUrl": "https://instagram.com/",
    "photoUrl": null,
    "mapPos": {
      "top": "37%",
      "left": "21%"
    }
  }
];

const AREAS_LIST = [
  "三軒家西",
  "泉尾",
  "千島",
  "平尾",
  "駅前エリア"
];
const CATEGORIES_LIST = [
  "おばんざい",
  "BAR",
  "スナック",
  "カフェ",
  "焼肉",
  "お好み焼き",
  "ダイニング",
  "居酒屋"
];
const TYPES_LIST = [
  "食事向け",
  "休憩向け",
  "はしご向け"
];

/**
 * 店舗が「今日・今」営業中かを動的に判定する関数
 */
function checkIsOpenToday(store, eventPeriod = (typeof EVENT_PERIOD !== 'undefined' ? EVENT_PERIOD : null), now = new Date()) {
  if (!store) return false;

  // 1. イベント期間判定 (YYYY-MM-DD)
  if (eventPeriod && eventPeriod.startDate && eventPeriod.endDate) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    if (todayStr < eventPeriod.startDate || todayStr > eventPeriod.endDate) {
      return false;
    }
  }

  // 2. 曜日判定
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const rawDays = (store.conditions && store.conditions.days) ? store.conditions.days : '';
  const allowedDays = rawDays.split(',').map(s => s.trim());

  // 3. 営業時間判定 (HH:MM-HH:MM)
  const rawHours = (store.conditions && store.conditions.hours) ? store.conditions.hours : '';
  if (!rawHours || !rawHours.includes('-')) {
    return false;
  }

  const parts = rawHours.split('-').map(s => s.trim());
  if (parts.length !== 2) return false;

  const [startStr, endStr] = parts;
  const [startH, startM] = startStr.split(':').map(Number);
  const [endH, endM] = endStr.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
    return false;
  }

  const curMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  const isOvernight = endMinutes <= startMinutes;

  if (!isOvernight) {
    // 通常営業（同日内）
    const currentDayName = dayNames[now.getDay()];
    if (!allowedDays.includes(currentDayName)) return false;
    return curMinutes >= startMinutes && curMinutes < endMinutes;
  } else {
    // 深夜（日跨ぎ）営業
    if (curMinutes >= startMinutes) {
      // 当日夜のシフト枠
      const currentDayName = dayNames[now.getDay()];
      return allowedDays.includes(currentDayName);
    } else if (curMinutes < endMinutes) {
      // 翌日早朝のシフト枠（前日営業枠の継続）
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayName = dayNames[yesterday.getDay()];
      return allowedDays.includes(yesterdayName);
    } else {
      return false;
    }
  }
}

/**
 * Excel(XLSX) ArrayBufferをSTORES_DATAオブジェクト配列にパースする関数（Webサーバー閲覧時の動的更新用）
 */
function parseXLSXToStoresData(arrayBuffer) {
  if (!arrayBuffer) return null;
  if (typeof XLSX === 'undefined') {
    console.error('SheetJS (XLSX) ライブラリがロードされていません。');
    return null;
  }

  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  // イベント期間のパース
  let parsedEventPeriod = null;
  if (workbook.SheetNames.includes('イベント期間')) {
    const eventSheet = workbook.Sheets['イベント期間'];
    const eventJson = XLSX.utils.sheet_to_json(eventSheet, { header: 1, defval: '' });
    if (eventJson && eventJson.length >= 2) {
      const startVal = String(eventJson[1][0] || '').trim().split(' ')[0];
      const endVal = String(eventJson[1][1] || '').trim().split(' ')[0];
      parsedEventPeriod = { startDate: startVal, endDate: endVal };
      if (typeof EVENT_PERIOD !== 'undefined') {
        EVENT_PERIOD.startDate = startVal;
        EVENT_PERIOD.endDate = endVal;
      }
    }
  }

  const firstSheetName = workbook.SheetNames.includes('店舗一覧') ? '店舗一覧' : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (!jsonData || jsonData.length <= 1) return null;

  const headers = jsonData[0].map(h => String(h || '').trim());
  const newStores = [];

  for (let i = 1; i < jsonData.length; i++) {
    const cols = jsonData[i].map(c => String(c === undefined || c === null ? '' : c).trim());
    if (cols.length === 0 || cols.every(c => c === '')) continue;

    const getVal = (...headerNames) => {
      for (const name of headerNames) {
        const target = String(name).toLowerCase().trim();
        const idx = headers.findIndex(h => String(h || '').toLowerCase().trim() === target);
        if (idx !== -1 && cols[idx] !== undefined && cols[idx] !== null && String(cols[idx]).trim() !== '') {
          return String(cols[idx]).trim();
        }
      }
      return '';
    };

    const id = getVal("ID", "id") || `store-${String(i).padStart(2, '0')}`;
    const name = getVal("店舗名", "名", "店名");
    if (!name) continue;

    const ruby = getVal("よみがな", "フリガナ", "かな");
    const area = getVal("エリア", "地域");
    const category = getVal("カテゴリ", "カテゴリー", "ジャンル", "店の種類");
    const type = getVal("タイプ", "店舗タイプ", "スタイル");
    const catchphrase = getVal("キャッチコピー", "コピー");

    const set_title = getVal("酔いどれセット名", "セット名");
    const set_content = getVal("セット内容", "内容");
    const priceStr = getVal("価格(円)", "価格", "金額", "セット価格(円)", "セット価格").replace(/[^\d]/g, '');
    const price = priceStr ? parseInt(priceStr, 10) : 0;
    const includeChargeStr = getVal("チャージ", "セットチャージ");
    const setCharge = (includeChargeStr.includes("不要") || includeChargeStr.includes("無")) ? "不要" : "込";

    const days = getVal("提供日");
    const hours = getVal("提供時間");
    const limit = getVal("限定数");
    const setNotes = getVal("セット備考", "備考・注意事項", "備考", "注意事項");

    const questTitle = getVal("クエスト名");
    const questPriceStr = getVal("クエスト価格(円)", "クエスト価格", "クエスト金額(円)", "クエスト金額").replace(/[^\d]/g, '');
    const questPrice = questPriceStr ? parseInt(questPriceStr, 10) : 0;
    const questChargeStr = getVal("クエストチャージ");
    const questCharge = questChargeStr.includes("込") ? "込" : "不要";

    const questContent = getVal("クエスト内容", "イベント情報", "イベント");
    const questNotes = getVal("クエスト備考");
    const isQuestActive = !!(questTitle || questContent);

    const paymentMethodsRaw = getVal("決済方法", "支払い方法");
    const paymentMethods = paymentMethodsRaw
      ? paymentMethodsRaw.split(/[,/、\s]+/).filter(Boolean)
      : [];

    const googleMapUrl = getVal("Google Map URL", "GoogleMapURL", "マップURL");
    const instagramUrl = getVal("Instagram URL", "InstagramURL", "インスタURL");
    let photoFileName = getVal("photo", "Photo", "PHOTO", "写真", "画像");
    if (photoFileName) {
      photoFileName = photoFileName.replace(/^photo[/\\]/i, '');
    }
    const photoUrl = photoFileName ? `photo/${photoFileName}` : null;

    const existing = (typeof STORES_DATA !== 'undefined') ? STORES_DATA.find(s => s.id === id || s.name === name) : null;
    const mapPos = existing ? existing.mapPos : { top: `${20 + (i * 7) % 60}%`, left: `${20 + (i * 11) % 60}%` };

    const storeObj = {
      id,
      name,
      ruby,
      area,
      category,
      type,
      isOpenToday: true,
      isQuestActive,
      quest: {
        title: questTitle,
        price: questPrice,
        charge: questCharge,
        content: questContent,
        notes: questNotes
      },
      catchphrase,
      yoidoreSet: {
        title: set_title,
        content: set_content,
        price,
        charge: setCharge,
        includeCharge: setCharge === "込",
        notes: setNotes
      },
      conditions: {
        days,
        hours,
        limit,
        soldOutEnd: limit.includes("限定") || limit.includes("完売")
      },
      paymentMethods,
      googleMapUrl,
      instagramUrl,
      photoUrl,
      mapPos
    };

    storeObj.isOpenToday = checkIsOpenToday(storeObj, parsedEventPeriod || (typeof EVENT_PERIOD !== 'undefined' ? EVENT_PERIOD : null));
    newStores.push(storeObj);
  }

  return newStores;
}

function updateDataFromXLSX(arrayBuffer) {
  const newStores = parseXLSXToStoresData(arrayBuffer);
  if (newStores && newStores.length > 0) {
    STORES_DATA.length = 0;
    Array.prototype.push.apply(STORES_DATA, newStores);

    const areas = Array.from(new Set(STORES_DATA.map(s => s.area))).filter(Boolean);
    if (areas.length > 0) {
      AREAS_LIST.length = 0;
      Array.prototype.push.apply(AREAS_LIST, areas);
    }

    const categories = Array.from(new Set(STORES_DATA.map(s => s.category))).filter(Boolean);
    if (categories.length > 0) {
      CATEGORIES_LIST.length = 0;
      Array.prototype.push.apply(CATEGORIES_LIST, categories);
    }

    const types = Array.from(new Set(STORES_DATA.map(s => s.type))).filter(Boolean);
    if (types.length > 0) {
      TYPES_LIST.length = 0;
      Array.prototype.push.apply(TYPES_LIST, types);
    }

    return true;
  }
  return false;
}
