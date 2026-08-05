/**
 * 大正酔いどれクエストⅡ - 店舗ダミーデータ
 */

const STORES_DATA = [
  {
    id: "store-01",
    name: "酒場 ドット酒場",
    ruby: "さかば どっとさかば",
    area: "駅前エリア",
    category: "居酒屋",
    type: "はしご向け",
    isOpenToday: true,
    isEventActive: true,
    eventTitle: "パーティークエスト：サイコロで「1」が出たらウーロンハイ1杯サービス！",
    catchphrase: "大正駅から徒歩1分！冒険者が最初に集うレトロ居酒屋",
    yoidoreSet: {
      title: "酔いどれ伝説の生ビール＆極上どて焼きセット",
      content: "キンキンに冷えた生ビール（中）1杯 ＋ じっくり煮込んだ特製味噌どて焼き2本",
      price: 1000,
      includeCharge: true
    },
    conditions: {
      days: "イベント期間中全日",
      hours: "17:00 - 23:00 (L.O. 22:30)",
      limit: "限定30セット / 日",
      soldOutEnd: true,
      notes: "冒険の書（紙）をご提示された方限定。他クーポン併用不可。"
    },
    paymentMethods: ["現金", "PayPay", "クレジットカード"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区三軒家東1",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "25%", left: "30%" },
    badge: "初心者歓迎"
  },
  {
    id: "store-02",
    name: "BAR 8-BIT QUEST",
    ruby: "ばー はちびっとくえすと",
    area: "三軒家西",
    category: "BAR",
    type: "休憩向け",
    isOpenToday: true,
    isEventActive: true,
    eventTitle: "レトロゲームチャレンジ：店主とワンゲーム対戦でチャージ割引！",
    catchphrase: "どこか懐かしいピコピコ音が流れる、大人の隠れ家バー",
    yoidoreSet: {
      title: "魔法のカクテル＆スモーキーナッツセット",
      content: "特製青いポーションカクテル（またはハイボール） ＋ 自家製燻製ナッツ",
      price: 1200,
      includeCharge: true
    },
    conditions: {
      days: "金・土・日・祝",
      hours: "19:00 - 02:00",
      limit: "1日15セット限定",
      soldOutEnd: true,
      notes: "チャージ料金（通常500円）はセット価格に含まれます。"
    },
    paymentMethods: ["現金", "クレジットカード", "電子マネー"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区三軒家西1",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "35%", left: "20%" },
    badge: "隠れ家"
  },
  {
    id: "store-03",
    name: "スナック 大正ロマン",
    ruby: "すなっく たいしょうろまん",
    area: "泉尾",
    category: "スナック",
    type: "はしご向け",
    isOpenToday: true,
    isEventActive: false,
    eventTitle: "",
    catchphrase: "昭和・大正の情緒漂う商店街の名物ママがいるアットホームスナック",
    yoidoreSet: {
      title: "昭和レトロカラオケ＆酔いどれ焼酎セット",
      content: "こだわり芋・麦焼酎（ロックまたは水割り）2杯 ＋ おまかせ手作りお通し3種盛り ＋ カラオケ1曲無料",
      price: 1500,
      includeCharge: true
    },
    conditions: {
      days: "火〜日曜日",
      hours: "18:00 - 23:30",
      limit: "数量制限なし",
      soldOutEnd: false,
      notes: "混雑時はお席90分制とさせていただきます。"
    },
    paymentMethods: ["現金", "PayPay"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区泉尾2",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "50%", left: "45%" },
    badge: "カラオケ有"
  },
  {
    id: "store-04",
    name: "純喫茶＆バル たいしょう",
    ruby: "じゅんきっさあんどばる たいしょう",
    area: "千島",
    category: "カフェ",
    type: "休憩向け",
    isOpenToday: true,
    isEventActive: true,
    eventTitle: "喫茶クエスチョン：店内のレトロ謎解き成功でミニデザートプレゼント！",
    catchphrase: "昼は濃厚ナポリタン、夜はクラフトビールが楽しめる和洋折衷カフェ",
    yoidoreSet: {
      title: "大正浪漫クラフトビール＆厚切りガーリックトーストセット",
      content: "選べる地ビール1本 ＋ サクサク濃厚ガーリックトースト2切れ",
      price: 1000,
      includeCharge: true
    },
    conditions: {
      days: "水曜日除く毎日",
      hours: "15:00 - 21:00",
      limit: "限定20セット",
      soldOutEnd: true,
      notes: "カフェタイム（15:00〜）から注文可能です。"
    },
    paymentMethods: ["現金", "PayPay", "クレジットカード", "電子マネー"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区千島1",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "65%", left: "55%" },
    badge: "カフェ＆バー"
  },
  {
    id: "store-05",
    name: "ホルモン焼肉 酔魔神",
    ruby: "ほるもんやきにく よいまじん",
    area: "平尾",
    category: "焼肉",
    type: "食事向け",
    isOpenToday: false,
    isEventActive: true,
    eventTitle: "肉くじクエスト：特賞は「極上A5カルビ1皿無料券」！",
    catchphrase: "秘伝のタレと新鮮ホルモン！スタミナ回復ならここにおまかせ！",
    yoidoreSet: {
      title: "スタミナ回復！メガハイボール＆ホルモン3種盛りセット",
      content: "メガ角ハイボール ＋ 本日の新鮮ホルモン3種（塩タン・ハツ・ミノ）",
      price: 1300,
      includeCharge: false
    },
    conditions: {
      days: "木〜火曜日 (水曜定休)",
      hours: "17:00 - 22:30",
      limit: "限定25セット",
      soldOutEnd: true,
      notes: "別途ワンドリンク制ではありませんが、テーブルチャージ200円が加算されます。"
    },
    paymentMethods: ["現金", "PayPay"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区平尾3",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "80%", left: "70%" },
    badge: "ガッツリ系"
  },
  {
    id: "store-06",
    name: "お好み焼き 鉄板クエスト",
    ruby: "おこのみやき てっぱんくえすと",
    area: "三軒家西",
    category: "お好み焼き",
    type: "食事向け",
    isOpenToday: true,
    isEventActive: false,
    eventTitle: "",
    catchphrase: "外はカリッ、中はふわふわ！大正名物のすじkon焼きが自慢",
    yoidoreSet: {
      title: "大正名物すじコン焼き＆こだわりチューハイセット",
      content: "名物すじコン玉（ミニサイズ） ＋ プレーンチューハイ（またはソフトドリンク）",
      price: 1000,
      includeCharge: true
    },
    conditions: {
      days: "毎日営業",
      hours: "16:30 - 22:00",
      limit: "限定30セット",
      soldOutEnd: true,
      notes: "テイクアウトも可能です（箱代別途50円）。"
    },
    paymentMethods: ["現金", "PayPay", "QR決済"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区三軒家西2",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "30%", left: "35%" },
    badge: "粉もん"
  },
  {
    id: "store-07",
    name: "ダイニング ギルドバル",
    ruby: "だいにんぐ ぎるどばる",
    area: "駅前エリア",
    category: "ダイニング",
    type: "食事向け",
    isOpenToday: true,
    isEventActive: true,
    eventTitle: "パーティークエスト：4人以上のパーティ来店でボトルワイン1本半額！",
    catchphrase: "洋風バルメニューと厳選ワインが揃う、冒険者たちの宴会場",
    yoidoreSet: {
      title: "ギルド特製生ハム盛り合わせ＆グラスワインセット",
      content: "スパークリングまたは赤・白ワイン1グラス ＋ スペイン産生ハムとチーズ盛り合わせ",
      price: 1200,
      includeCharge: true
    },
    conditions: {
      days: "火〜日曜日",
      hours: "17:30 - 23:00",
      limit: "1日20セット",
      soldOutEnd: true,
      notes: "テーブル席・カウンター席どちらでも利用いただけます。"
    },
    paymentMethods: ["現金", "クレジットカード", "PayPay", "電子マネー"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区三軒家東2",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "20%", left: "45%" },
    badge: "おしゃれバル"
  },
  {
    id: "store-08",
    name: "海鮮居酒屋 昭和横丁",
    ruby: "かいせんいざかや しょうわよこちょう",
    area: "泉尾",
    category: "居酒屋",
    type: "はしご向け",
    isOpenToday: true,
    isEventActive: false,
    eventTitle: "",
    catchphrase: "毎朝市場から仕入れる新鮮な魚介と日本酒が勢ぞろい！",
    yoidoreSet: {
      title: "本日の厳選お刺身3種盛り＆冷酒ぐい呑みセット",
      content: "おすすめ地酒1杯 ＋ 旬の鮮魚お刺身3種盛り",
      price: 1000,
      includeCharge: true
    },
    conditions: {
      days: "月〜土曜日",
      hours: "17:00 - 22:30",
      limit: "限定20セット",
      soldOutEnd: true,
      notes: "仕入れ状況により刺身の内容が変わります。"
    },
    paymentMethods: ["現金", "PayPay"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区泉尾1",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "45%", left: "30%" },
    badge: "鮮魚直送"
  },
  {
    id: "store-09",
    name: "クラフトBAR クラーケン",
    ruby: "くらふとばー くらーけん",
    area: "千島",
    category: "BAR",
    type: "はしご向け",
    isOpenToday: false,
    isEventActive: true,
    eventTitle: "ダーククエスト：黒ビールご注文でオリジナルステッカープレゼント！",
    catchphrase: "世界のクラフトビールが常時8種タップで味わえる本格タップルーム",
    yoidoreSet: {
      title: "選べるクラフトビールハーフパイント＆フィッシュ＆チップス",
      content: "本日のタップからお好きなビール（ハーフパイント） ＋ サクサク自家製フィッシュ＆チップス（小）",
      price: 1100,
      includeCharge: true
    },
    conditions: {
      days: "水〜日曜日",
      hours: "18:00 - 00:00",
      limit: "限定15セット",
      soldOutEnd: true,
      notes: "チャージなし。"
    },
    paymentMethods: ["現金", "クレジットカード", "電子マネー"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区千島2",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "60%", left: "40%" },
    badge: "クラフトビール"
  },
  {
    id: "store-10",
    name: "沖縄ダイニング 琉球クエスト",
    ruby: "おきなわだいにんぐ りゅうきゅうくえすと",
    area: "平尾",
    category: "ダイニング",
    type: "食事向け",
    isOpenToday: true,
    isEventActive: true,
    eventTitle: "三線ライブクエスト：毎週土曜夜は三線ライブ開催！盛り上がろう！",
    catchphrase: "「リトル沖縄」大正区ならではの本格沖縄料理と泡盛の店",
    yoidoreSet: {
      title: "オリオン生ビール＆じっくり煮込んだラフテーセット",
      content: "オリオン生ビール1杯 ＋ とろとろ自家製ラフテー（豚角煮）",
      price: 1000,
      includeCharge: true
    },
    conditions: {
      days: "全日",
      hours: "17:00 - 23:00",
      limit: "限定30セット",
      soldOutEnd: true,
      notes: "泡盛への変更も可能です。"
    },
    paymentMethods: ["現金", "PayPay", "クレジットカード"],
    googleMapUrl: "https://maps.google.com/?q=大阪府大阪市大正区平尾2",
    instagramUrl: "https://instagram.com/",
    mapPos: { top: "75%", left: "60%" },
    badge: "沖縄料理"
  }
];

const AREAS_LIST = ["駅前エリア", "三軒家西", "泉尾", "千島", "平尾"];
const CATEGORIES_LIST = ["居酒屋", "BAR", "スナック", "カフェ", "焼肉", "お好み焼き", "ダイニング"];
const TYPES_LIST = ["はしご向け", "休憩向け", "食事向け"];
