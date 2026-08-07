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
    "area": "三軒家西",
    "category": "おばんざい",
    "type": "しっかりご飯",
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
      "title": "おばんざい三種盛り晩酌セット",
      "content": "おばんざい軽盛り3種+ドリンク1杯",
      "price": 800,
      "charge": "込",
      "includeCharge": true,
      "notes": "他クーポン併用不可。"
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
    "logoUrl": "logo/001.png",
    "mapPos": {
      "top": "34%",
      "left": "42%"
    }
  },
  {
    "id": "store-02",
    "name": "バーガー酒場ハンバーガー・ママ",
    "area": "三軒家東",
    "category": "ハンバーガー酒場",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "一品と酒とグルメバーガー",
    "yoidoreSet": {
      "title": "どれクエ限定ミニバーガーセット",
      "content": "イベント限定ミニバーガー+ドリンク1杯",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/LvrTR4thHgoGpoRc7",
    "instagramUrl": "https://www.instagram.com/hamburger.mama",
    "photoUrl": "photo/002.jpg",
    "logoUrl": "logo/002.png",
    "mapPos": {
      "top": "41%",
      "left": "53%"
    }
  },
  {
    "id": "store-03",
    "name": "大正焼肉SUNナスビ!!",
    "area": "駅前",
    "category": "焼肉・ホルモン",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "通える高級焼肉",
    "yoidoreSet": {
      "title": "牛すじ煮込み焼肉屋の晩酌セット",
      "content": "和牛のすじ煮込み+ドリンク1杯",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/9DHWbdXcG6VwQRg17",
    "instagramUrl": "https://www.instagram.com/sunnasubi0675085821",
    "photoUrl": "photo/003.jpg",
    "logoUrl": "logo/003.png",
    "mapPos": {
      "top": "48%",
      "left": "64%"
    }
  },
  {
    "id": "store-04",
    "name": "大正居酒屋タイガーパンチ",
    "area": "駅前",
    "category": "立ち飲み",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "創作ガチ中華",
    "yoidoreSet": {
      "title": "黒糖焼酎とニラ玉セット",
      "content": "黒糖焼酎とニラ玉",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/wSUzPpSDHh3tzyap6",
    "instagramUrl": "https://www.instagram.com/taipan_taisho",
    "photoUrl": "photo/004.jpg",
    "logoUrl": "logo/004.png",
    "mapPos": {
      "top": "55%",
      "left": "75%"
    }
  },
  {
    "id": "store-05",
    "name": "ハイエナハイツ",
    "area": "三軒家西",
    "category": "ジビエ肉",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "ジビエ・肉料理",
    "yoidoreSet": {
      "title": "ラム肉ショルダーステーキセット",
      "content": "ラム肉ショルダーステーキ(小)+飲み放題用メニューより1杯",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/JVXGfL5NwG4vKz2t6",
    "instagramUrl": "https://www.instagram.com/haiena_haitu",
    "photoUrl": "photo/005.jpg",
    "logoUrl": "logo/005.png",
    "mapPos": {
      "top": "62%",
      "left": "26%"
    }
  },
  {
    "id": "store-06",
    "name": "CHWEETS",
    "area": "三軒家西",
    "category": "カフェ",
    "type": "ひと休み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "クレープ酒場・夜カフェ",
    "yoidoreSet": {
      "title": "夜カフェクレープセット",
      "content": "ハンドドリップコーヒー+クレープ(チョコバナナ or ビスケットキャラメル)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/rBmQt912byGEZgbU7",
    "instagramUrl": "https://www.instagram.com/chweets_1138",
    "photoUrl": "photo/006.jpg",
    "logoUrl": "logo/006.png",
    "mapPos": {
      "top": "69%",
      "left": "37%"
    }
  },
  {
    "id": "store-07",
    "name": "BAR K'S〜ケーズ〜",
    "area": "三軒家西",
    "category": "BAR",
    "type": "遊べる・エンタメ",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "ダーツ・カラオケ",
    "yoidoreSet": {
      "title": "限定カクテルセット",
      "content": "限定カクテル",
      "price": 0,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/h1iC1PzMoU3TmyDg9",
    "instagramUrl": "https://www.instagram.com/bar_ks_taisho",
    "photoUrl": "photo/007.jpg",
    "logoUrl": "logo/007.png",
    "mapPos": {
      "top": "76%",
      "left": "48%"
    }
  },
  {
    "id": "store-08",
    "name": "Bar Six Nine",
    "area": "三軒家東",
    "category": "BAR",
    "type": "遊べる・エンタメ",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "ショットバー",
    "yoidoreSet": {
      "title": "ミックスナッツ晩酌セット",
      "content": "ちょっとミックスナッツ or ちょっとピスタチオ + ドリンク1杯(ウイスキー or 焼酎)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/j4hhdwnWPQZ365rk7",
    "instagramUrl": "https://www.instagram.com/bar_six_nine_0692",
    "photoUrl": "photo/008.jpg",
    "logoUrl": "logo/008.png",
    "mapPos": {
      "top": "23%",
      "left": "59%"
    }
  },
  {
    "id": "store-09",
    "name": "だしと鶏ちゃぼ大正店",
    "area": "三軒家東",
    "category": "鶏料理",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "焼き鳥・お出汁料理",
    "yoidoreSet": {
      "title": "ちゃぼの鶏だし満喫セット",
      "content": "大根を美味しく炊いたやつの天ぷら or ちゃぼの肉豆腐＋国産鶏の出汁煮 + ドリンク1杯",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/a9AcRcjV9q895Jeo6",
    "instagramUrl": "https://www.instagram.com/chabo_taisho",
    "photoUrl": "photo/009.jpg",
    "logoUrl": "logo/009.png",
    "mapPos": {
      "top": "30%",
      "left": "70%"
    }
  },
  {
    "id": "store-10",
    "name": "ふじわら君",
    "area": "三軒家西",
    "category": "居酒屋",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "創作料理居酒屋",
    "yoidoreSet": {
      "title": "日本酒と創作おつまみセット",
      "content": "日本酒1杯とおつまみ",
      "price": 800,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/svhsvpjHHy4Wfxv49",
    "instagramUrl": "https://www.instagram.com/fujiwarakun_taisho",
    "photoUrl": "photo/010.jpg",
    "logoUrl": "logo/010.png",
    "mapPos": {
      "top": "37%",
      "left": "21%"
    }
  },
  {
    "id": "store-11",
    "name": "大正サロン髭とボヰン",
    "area": "駅前",
    "category": "立ち飲み",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "立ち飲み・創作料理",
    "yoidoreSet": {
      "title": "おばんざい立ち飲みセット",
      "content": "おばんざい2種盛り+ドリンク1杯(460円以内)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/SGWcKvKGnM5jmSea6",
    "instagramUrl": "https://www.instagram.com/hige_to.boin",
    "photoUrl": "photo/011.jpg",
    "logoUrl": "logo/011.png",
    "mapPos": {
      "top": "44%",
      "left": "32%"
    }
  },
  {
    "id": "store-12",
    "name": "大正バル誠~ｓｅｉ~",
    "area": "三軒家東",
    "category": "居酒屋",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "串カツ・牡蠣・沖縄料理",
    "yoidoreSet": {
      "title": "串カツと一杯セット",
      "content": "串カツ5本盛り+ドリンク1杯(550円以内)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/2TSaY99KjvafbH728",
    "instagramUrl": "https://www.instagram.com/izakaya_sei",
    "photoUrl": "photo/012.jpg",
    "logoUrl": "logo/012.png",
    "mapPos": {
      "top": "51%",
      "left": "43%"
    }
  },
  {
    "id": "store-13",
    "name": "居酒屋たすいち",
    "area": "駅前",
    "category": "居酒屋",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "もつ鍋酒屋",
    "yoidoreSet": {
      "title": "唐揚げちょい飲みセット",
      "content": "唐揚げハーフ(2個)+ドリンク1杯",
      "price": 800,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/GSNQFGQG6kZgSscz7",
    "instagramUrl": "https://www.instagram.com/izakaya_tasuichi",
    "photoUrl": "photo/013.jpg",
    "logoUrl": "logo/013.png",
    "mapPos": {
      "top": "58%",
      "left": "54%"
    }
  },
  {
    "id": "store-14",
    "name": "地鶏る",
    "area": "泉尾",
    "category": "鶏料理",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "宮崎鶏の炭火焼き",
    "yoidoreSet": {
      "title": "宮崎地鶏炭火焼きセット",
      "content": "炭火焼き(小)+ドリンク1杯(495円以内)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/xrZVAtv7kBYFbYxU8",
    "instagramUrl": "https://www.instagram.com/jidoru_1013",
    "photoUrl": "photo/014.jpg",
    "logoUrl": "logo/014.png",
    "mapPos": {
      "top": "65%",
      "left": "65%"
    }
  },
  {
    "id": "store-15",
    "name": "沖縄酒場きじむなーの森",
    "area": "三軒家西",
    "category": "居酒屋",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "沖縄料理",
    "yoidoreSet": {
      "title": "沖縄前菜盛り泡盛セット",
      "content": "沖縄前菜肴盛セット+ドリンク2杯（生ビール、ハイボール、泡盛（3種類から選べます）、二階堂、黒霧、酎ハイ）",
      "price": 1600,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/BYfv2YxJfrB6RUYV8",
    "instagramUrl": "https://www.instagram.com/kijimuna_no_mori.03.03",
    "photoUrl": "photo/015.jpg",
    "logoUrl": "logo/015.png",
    "mapPos": {
      "top": "72%",
      "left": "76%"
    }
  },
  {
    "id": "store-16",
    "name": "ナンチャツ亭のエリー",
    "area": "駅前",
    "category": "おばんざい",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "昭和レトロなおばんざい",
    "yoidoreSet": {
      "title": "昭和おばんざい晩酌セット",
      "content": "おばんざい2種+ドリンク1杯(日本酒、一部銘柄を除く)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/kGdEWrLq5bwaRyeX7",
    "instagramUrl": "https://www.instagram.com/nanchatteino_erie",
    "photoUrl": "photo/016.jpg",
    "logoUrl": "logo/016.png",
    "mapPos": {
      "top": "79%",
      "left": "27%"
    }
  },
  {
    "id": "store-17",
    "name": "Neboke-ネボケ",
    "area": "三軒家西",
    "category": "BAR",
    "type": "ひと休み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "隠れ家バー",
    "yoidoreSet": {
      "title": "隠れ家おつまみセット",
      "content": "おつまみ2品+ドリンク1杯(1000円以内 )",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/WiS8rFbF993DeBHp9",
    "instagramUrl": "https://www.instagram.com/Neboke_bar",
    "photoUrl": "photo/017.jpg",
    "logoUrl": "logo/017.png",
    "mapPos": {
      "top": "26%",
      "left": "38%"
    }
  },
  {
    "id": "store-18",
    "name": "串焼き酒場ニコヤ",
    "area": "三軒家西",
    "category": "串焼き・鉄板焼き",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "創作鉄板串焼き",
    "yoidoreSet": {
      "title": "創作串焼き三本セット",
      "content": "串3本+ドリンク1杯",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/xUqC8zQH77DDPQ7c9",
    "instagramUrl": "https://www.instagram.com/nicoya1203",
    "photoUrl": "photo/018.jpg",
    "logoUrl": "logo/018.png",
    "mapPos": {
      "top": "33%",
      "left": "49%"
    }
  },
  {
    "id": "store-19",
    "name": "Barカセット",
    "area": "三軒家東",
    "category": "BAR",
    "type": "遊べる・エンタメ",
    "isOpenToday": true,
    "isQuestActive": true,
    "quest": {
      "title": "",
      "price": 300,
      "charge": "不要",
      "content": "スタッフと楽しい酔いどれチンチロチャンス！",
      "notes": "成功：会心の1杯サービス、失敗：大魔王のショット(ちょっと)"
    },
    "catchphrase": "80's・ロック・駄菓子",
    "yoidoreSet": {
      "title": "80's駄菓子バーセット",
      "content": "",
      "price": 300,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/uUPFxJA4w57PqYzf7",
    "instagramUrl": "https://www.instagram.com/showz0069",
    "photoUrl": "photo/019.jpg",
    "logoUrl": "logo/019.png",
    "mapPos": {
      "top": "40%",
      "left": "60%"
    }
  },
  {
    "id": "store-20",
    "name": "焼肉ホルモンたろちゃん大正橋店",
    "area": "三軒家東",
    "category": "焼肉・ホルモン",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "駅前で昼から飲める店",
    "yoidoreSet": {
      "title": "昼飲みホルモンおつまみセット",
      "content": "おつまみ2品盛り+ドリンク1杯(350円以内)",
      "price": 500,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/P1ytbeyLANs4TgD19",
    "instagramUrl": "https://www.instagram.com/tarochan_taisho",
    "photoUrl": "photo/020.jpg",
    "logoUrl": "logo/020.png",
    "mapPos": {
      "top": "47%",
      "left": "71%"
    }
  },
  {
    "id": "store-21",
    "name": "鉄板焼き栄八大阪大正店",
    "area": "三軒家西",
    "category": "串焼き・鉄板焼き",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "お好み・焼きそば・鉄板居酒屋",
    "yoidoreSet": {
      "title": "鉄板焼き盛り合わせセット",
      "content": "鉄板2種盛り+ドリンク1杯(ビール・ハイボール・酎ハイ)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/SgdnoFYhwHF52vjd8",
    "instagramUrl": "https://www.instagram.com/teppanyaki_eihachi",
    "photoUrl": "photo/021.jpg",
    "logoUrl": "logo/021.png",
    "mapPos": {
      "top": "54%",
      "left": "22%"
    }
  },
  {
    "id": "store-22",
    "name": "うて食堂 大正BASE",
    "area": "三軒家東",
    "category": "おばんざい",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "蒸し料理で飲める食堂",
    "yoidoreSet": {
      "title": "蒸し料理おばんざいセット",
      "content": "おばんざい3種+ハイボールor酎ハイ",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/rc5NfzqfDAM7pevWA",
    "instagramUrl": "https://www.instagram.com/ura_omote.shokudou",
    "photoUrl": "photo/022.jpg",
    "logoUrl": "logo/022.png",
    "mapPos": {
      "top": "61%",
      "left": "33%"
    }
  },
  {
    "id": "store-23",
    "name": "大正焼肉ホルモンK2+",
    "area": "三軒家西",
    "category": "焼肉・ホルモン",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "焼肉ホルモン・韓国料理",
    "yoidoreSet": {
      "title": "韓国おつまみセット",
      "content": "チヂミ・キムチ・ナムルセット+ドリンク1杯(550円以内)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/9Wt44gRpXPDoTt1q9",
    "instagramUrl": "https://www.instagram.com/yakiniku.k2plus",
    "photoUrl": "photo/023.jpg",
    "logoUrl": "logo/023.png",
    "mapPos": {
      "top": "68%",
      "left": "44%"
    }
  },
  {
    "id": "store-24",
    "name": "呑み処　三日月",
    "area": "駅前",
    "category": "居酒屋",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "カラオケ居酒屋",
    "yoidoreSet": {
      "title": "歌って飲めるカラオケセット",
      "content": "カラオケ1時間+1品+ドリンク1杯　(20時以降限定)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "",
    "instagramUrl": "https://www.instagram.com/moon.3.3.3",
    "photoUrl": "photo/024.jpg",
    "logoUrl": "logo/024.png",
    "mapPos": {
      "top": "75%",
      "left": "55%"
    }
  },
  {
    "id": "store-25",
    "name": "呑笑戎屋",
    "area": "駅前",
    "category": "居酒屋",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "地元親子の大衆居酒屋",
    "yoidoreSet": {
      "title": "日替わりおばんざいセット",
      "content": "日替わりでおばんざい2皿+ドリンク1杯",
      "price": 800,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "",
    "instagramUrl": "https://www.instagram.com/ebisuya.taisyo",
    "photoUrl": "photo/025.jpg",
    "logoUrl": "logo/025.png",
    "mapPos": {
      "top": "22%",
      "left": "66%"
    }
  },
  {
    "id": "store-26",
    "name": "三ちゃん",
    "area": "三軒家西",
    "category": "居酒屋",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "海鮮居酒屋",
    "yoidoreSet": {
      "title": "海鮮一品晩酌セット",
      "content": "1品(お刺身や焼き物)+ドリンク1杯",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/DXhUb1vmR7aNUMMT8",
    "instagramUrl": "https://www.instagram.com/sanchan.o2",
    "photoUrl": "photo/026.jpg",
    "logoUrl": "logo/026.png",
    "mapPos": {
      "top": "29%",
      "left": "77%"
    }
  },
  {
    "id": "store-27",
    "name": "SoundBar花いち",
    "area": "駅前",
    "category": "スナック",
    "type": "遊べる・エンタメ",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "カラオケバー",
    "yoidoreSet": {
      "title": "カラオケバー乾杯セット",
      "content": "チャーム+ドリンク1杯(700円まで)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/typkWCnoPJKCUWyH8",
    "instagramUrl": "https://www.instagram.com/soundbar__hanaichi",
    "photoUrl": "photo/027.jpg",
    "logoUrl": "logo/027.png",
    "mapPos": {
      "top": "36%",
      "left": "28%"
    }
  },
  {
    "id": "store-28",
    "name": "ザ·沖縄",
    "area": "駅前",
    "category": "居酒屋",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "沖縄料理・カラオケ居酒屋",
    "yoidoreSet": {
      "title": "沖縄ちょい飲みセット",
      "content": "チャーム+お菓子1袋+ドリンク1杯",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/Prnu5oBX6hyQzpft6",
    "instagramUrl": "https://www.instagram.com/za.okinawa",
    "photoUrl": "photo/028.jpg",
    "logoUrl": "logo/028.png",
    "mapPos": {
      "top": "43%",
      "left": "39%"
    }
  },
  {
    "id": "store-29",
    "name": "魚と沖縄料理 えっせんす",
    "area": "泉尾",
    "category": "居酒屋",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "お酒は地球を救う",
    "yoidoreSet": {
      "title": "沖縄小鉢三種盛りセット",
      "content": "選べるお好きな小鉢3品+ドリンク1杯(アサヒスーパードライ、オリオンビール、ブラックニッカハイボールのいずれか)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/NL1uEH8kq3MhMEzdA",
    "instagramUrl": "https://www.instagram.com/essence_taishou",
    "photoUrl": "photo/029.jpg",
    "logoUrl": "logo/029.png",
    "mapPos": {
      "top": "50%",
      "left": "50%"
    }
  },
  {
    "id": "store-30",
    "name": "Bar Coco-Color",
    "area": "三軒家西",
    "category": "BAR",
    "type": "遊べる・エンタメ",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "カジュアルバー",
    "yoidoreSet": {
      "title": "歌い放題飲み放題セット",
      "content": "1時間飲み放題+歌い放題(ドリンク制限あり)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/95uXqnFcfkMM8Jwo8",
    "instagramUrl": "https://www.instagram.com/bar_cococolor_taisho",
    "photoUrl": "photo/030.jpg",
    "logoUrl": "logo/030.png",
    "mapPos": {
      "top": "57%",
      "left": "61%"
    }
  },
  {
    "id": "store-31",
    "name": "福人(ふくんちゅ)",
    "area": "三軒家東",
    "category": "居酒屋",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "作りたいもん作りまっせ居酒屋",
    "yoidoreSet": {
      "title": "沖縄家庭料理セット",
      "content": "ゴーヤのお浸し+豚バラ軟骨塩煮込み+ドリンク1杯(瓶ビール以外)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/PB2QxJm3seTe8PFH6",
    "instagramUrl": "https://www.instagram.com/fuku__nchu",
    "photoUrl": "photo/031.jpg",
    "logoUrl": "logo/031.png",
    "mapPos": {
      "top": "64%",
      "left": "72%"
    }
  },
  {
    "id": "store-32",
    "name": "TM's DINER",
    "area": "三軒家東",
    "category": "ダイニング",
    "type": "サク飲み",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "イタリアン・メキシカン・アメリカン",
    "yoidoreSet": {
      "title": "洋食前菜バルセット",
      "content": "洋食前菜の3種盛+ドリンク1杯(限定メニューより)",
      "price": 1000,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/qM8P7SU6UqcARZm29",
    "instagramUrl": "https://www.instagram.com/tms_diner_osaka",
    "photoUrl": "photo/032.jpg",
    "logoUrl": "logo/032.png",
    "mapPos": {
      "top": "71%",
      "left": "23%"
    }
  },
  {
    "id": "store-33",
    "name": "Pizzeria Legare",
    "area": "平尾",
    "category": "ダイニング",
    "type": "しっかりご飯",
    "isOpenToday": true,
    "isQuestActive": false,
    "quest": {
      "title": "",
      "price": 0,
      "charge": "不要",
      "content": "",
      "notes": ""
    },
    "catchphrase": "本格ピッツァ・ドイツワイン",
    "yoidoreSet": {
      "title": "ピッツァ前菜ワインセット",
      "content": "ミニ前菜盛り合わせ+ドリンク1杯(ビール、ワイン、酎ハイ)",
      "price": 800,
      "charge": "込",
      "includeCharge": true,
      "notes": ""
    },
    "conditions": {
      "days": "月,火,水,金,土,日",
      "hours": "17:00-23:00",
      "limit": "",
      "soldOutEnd": false
    },
    "paymentMethods": [],
    "googleMapUrl": "https://maps.app.goo.gl/e85zQpDRWme5xsyr6",
    "instagramUrl": "https://www.instagram.com/pizzerialegare",
    "photoUrl": "photo/033.jpg",
    "logoUrl": "logo/033.png",
    "mapPos": {
      "top": "78%",
      "left": "34%"
    }
  }
];

const AREAS_LIST = [
  "三軒家西",
  "三軒家東",
  "駅前",
  "泉尾",
  "平尾"
];
const CATEGORIES_LIST = [
  "おばんざい",
  "ハンバーガー酒場",
  "焼肉・ホルモン",
  "立ち飲み",
  "ジビエ肉",
  "カフェ",
  "BAR",
  "鶏料理",
  "居酒屋",
  "串焼き・鉄板焼き",
  "スナック",
  "ダイニング"
];
const TYPES_LIST = [
  "しっかりご飯",
  "サク飲み",
  "ひと休み",
  "遊べる・エンタメ"
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

    const area = getVal("エリア", "地域");
    const category = getVal("カテゴリ", "カテゴリー", "ジャンル", "店の種類");
    const type = getVal("タイプ", "店舗タイプ", "スタイル");
    const catchphrase = getVal("キャッチコピー", "コピー");

    const set_title = getVal("酔いどれセット名", "セット名");
    const set_content = getVal("セット内容", "内容", "セット詳細");
    const priceStr = getVal("価格(円)", "価格", "金額", "セット価格(円)", "セット価格", "セット金額", "セット金額(円)").replace(/[^\d]/g, '');
    const price = priceStr ? parseInt(priceStr, 10) : 0;
    const includeChargeStr = getVal("チャージ", "セットチャージ");
    const setCharge = (includeChargeStr.includes("不要") || includeChargeStr.includes("無")) ? "不要" : "込";

    const days = getVal("提供日");
    const hours = getVal("提供時間");
    const limit = getVal("限定数");
    const setNotes = getVal("セット備考", "備考・注意事項", "備考", "注意事項");

    const questTitle = getVal("クエスト名");
    const questPriceStr = getVal("クエスト価格(円)", "クエスト価格", "クエスト金額(円)", "クエスト金額", "クエスト金額(円)", "金額").replace(/[^\d]/g, '');
    const questPrice = questPriceStr ? parseInt(questPriceStr, 10) : 0;
    const questChargeStr = getVal("クエストチャージ");
    const questCharge = questChargeStr.includes("込") ? "込" : "不要";

    const questContent = getVal("クエスト内容", "イベント情報", "イベント");
    const questNotes = getVal("クエスト備考", "備考");
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

    let logoFileName = getVal("logo", "Logo", "LOGO", "ロゴ", "ロゴ画像", "ロゴファイル");
    if (logoFileName) {
      logoFileName = logoFileName.replace(/^(logo|photo)[/\\]/i, '');
    }
    if (!logoFileName) {
      const cleanId = id.replace(/\D/g, '');
      if (cleanId) {
        logoFileName = `${cleanId.padStart(3, '0')}.png`;
      }
    }
    const logoUrl = logoFileName ? `logo/${logoFileName}` : null;

    const existing = (typeof STORES_DATA !== 'undefined') ? STORES_DATA.find(s => s.id === id || s.name === name) : null;
    const mapPos = existing ? existing.mapPos : { top: `${20 + (i * 7) % 60}%`, left: `${20 + (i * 11) % 60}%` };

    const storeObj = {
      id,
      name,
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
      logoUrl,
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
