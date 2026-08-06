import os
import json
import pandas as pd

def convert_excel_to_js():
    excel_path = os.path.join(os.path.dirname(__file__), 'STORES.xlsx')
    output_js_path = os.path.join(os.path.dirname(__file__), 'js', 'data.js')

    if not os.path.exists(excel_path):
        print(f"エラー: {excel_path} が見つかりません。")
        return False

    try:
        df = pd.read_excel(excel_path, sheet_name=0)
    except Exception as e:
        print(f"Excel読み込みエラー: {e}")
        return False

    stores = []
    
    # 列名の正規化マッピング
    col_map = {}
    for col in df.columns:
        c_str = str(col).strip().lower()
        col_map[c_str] = col

    def get_row_val(row, *possible_keys, default=''):
        for key in possible_keys:
            k = key.strip().lower()
            if k in col_map:
                val = row[col_map[k]]
                if pd.notna(val) and str(val).strip() != '':
                    return str(val).strip()
        return default

    for i, row in df.iterrows():
        id_val = get_row_val(row, "id", default=f"store-{str(i+1).zfill(2)}")
        name = get_row_val(row, "店舗名", "名", "店名")
        if not name:
            continue

        ruby = get_row_val(row, "よみがな", "フリガナ", "かな")
        area = get_row_val(row, "エリア", "地域", default="その他")
        category = get_row_val(row, "カテゴリ", "カテゴリー", "ジャンル", "店の種類", default="居酒屋")
        store_type = get_row_val(row, "タイプ", "店舗タイプ", "スタイル", default="はしご向け")
        badge = get_row_val(row, "特徴バッジ", "バッジ", default="")
        catchphrase = get_row_val(row, "キャッチコピー", "コピー", default="")

        set_title = get_row_val(row, "酔いどれセット名", "セット名", default="")
        set_content = get_row_val(row, "セット内容", "内容", default="")
        
        price_str = get_row_val(row, "価格(円)", "価格", "金額", default="1000")
        price_clean = ''.join(filter(str.isdigit, price_str))
        price = int(price_clean) if price_clean else 1000

        include_charge_str = get_row_val(row, "チャージ", default="")
        include_charge = ("込" in include_charge_str) or (include_charge_str.lower() == 'true')

        days = get_row_val(row, "提供日", default="")
        hours = get_row_val(row, "提供時間", default="")
        limit = get_row_val(row, "限定数", default="")
        notes = get_row_val(row, "備考・注意事項", "備考", "注意事項", default="")

        event_title = get_row_val(row, "イベント情報", "イベント", default="")
        payment_raw = get_row_val(row, "決済方法", "支払い方法", default="現金")
        import re
        payment_methods = [p.strip() for p in re.split(r'[,/、\s]+', payment_raw) if p.strip()]
        if not payment_methods:
            payment_methods = ["現金"]

        google_map_url = get_row_val(row, "google map url", "googlemapurl", "マップurl", default=f"https://maps.google.com/?q={name}")
        instagram_url = get_row_val(row, "instagram url", "instagramurl", "インスタurl", default="https://instagram.com/")

        photo_filename = get_row_val(row, "photo", "写真", "画像", default="")
        if photo_filename:
            photo_filename = re.sub(r'^photo[/\\]', '', photo_filename, flags=re.IGNORECASE)
            photo_url = f"photo/{photo_filename}"
        else:
            photo_url = None

        map_pos = {
            "top": f"{20 + ((i + 1) * 7) % 60}%",
            "left": f"{20 + ((i + 1) * 11) % 60}%"
        }

        store_obj = {
            "id": id_val,
            "name": name,
            "ruby": ruby,
            "area": area,
            "category": category,
            "type": store_type,
            "isOpenToday": True,
            "isEventActive": bool(event_title),
            "eventTitle": event_title,
            "catchphrase": catchphrase,
            "yoidoreSet": {
                "title": set_title,
                "content": set_content,
                "price": price,
                "includeCharge": include_charge
            },
            "conditions": {
                "days": days,
                "hours": hours,
                "limit": limit,
                "soldOutEnd": ("限定" in limit) or ("完売" in limit),
                "notes": notes
            },
            "paymentMethods": payment_methods,
            "googleMapUrl": google_map_url,
            "instagramUrl": instagram_url,
            "photoUrl": photo_url,
            "mapPos": map_pos,
            "badge": badge
        }
        stores.append(store_obj)

    areas_list = list(dict.fromkeys([s["area"] for s in stores if s["area"]]))
    categories_list = list(dict.fromkeys([s["category"] for s in stores if s["category"]]))
    types_list = list(dict.fromkeys([s["type"] for s in stores if s["type"]]))

    js_content = f"""/**
 * 大正酔いどれクエストⅡ - 店舗マスターデータ
 * ※このファイルは convert_xlsx_to_js.py によって STORES.xlsx から自動生成されたものです。
 * ※直接編集せず、STORES.xlsx を編集した後に update_data.bat を実行してください。
 */

const STORES_DATA = {json.dumps(stores, ensure_ascii=False, indent=2)};

const AREAS_LIST = {json.dumps(areas_list, ensure_ascii=False, indent=2)};
const CATEGORIES_LIST = {json.dumps(categories_list, ensure_ascii=False, indent=2)};
const TYPES_LIST = {json.dumps(types_list, ensure_ascii=False, indent=2)};

/**
 * Excel(XLSX) ArrayBufferをSTORES_DATAオブジェクト配列にパースする関数（Webサーバー閲覧時の動的更新用）
 */
function parseXLSXToStoresData(arrayBuffer) {{
  if (!arrayBuffer) return null;
  if (typeof XLSX === 'undefined') {{
    console.error('SheetJS (XLSX) ライブラリがロードされていません。');
    return null;
  }}

  const workbook = XLSX.read(arrayBuffer, {{ type: 'array' }});
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {{ header: 1, defval: '' }});

  if (!jsonData || jsonData.length <= 1) return null;

  const headers = jsonData[0].map(h => String(h || '').trim());
  const newStores = [];

  for (let i = 1; i < jsonData.length; i++) {{
    const cols = jsonData[i].map(c => String(c === undefined || c === null ? '' : c).trim());
    if (cols.length === 0 || cols.every(c => c === '')) continue;

    const getVal = (...headerNames) => {{
      for (const name of headerNames) {{
        const target = String(name).toLowerCase().trim();
        const idx = headers.findIndex(h => String(h || '').toLowerCase().trim() === target);
        if (idx !== -1 && cols[idx] !== undefined && cols[idx] !== null && String(cols[idx]).trim() !== '') {{
          return String(cols[idx]).trim();
        }}
      }}
      return '';
    }};

    const id = getVal("ID", "id") || `store-${{String(i).padStart(2, '0')}}`;
    const name = getVal("店舗名", "名", "店名");
    if (!name) continue;

    const ruby = getVal("よみがな", "フリガナ", "かな");
    const area = getVal("エリア", "地域") || "その他";
    const category = getVal("カテゴリ", "カテゴリー", "ジャンル", "店の種類") || "居酒屋";
    const type = getVal("タイプ", "店舗タイプ", "スタイル") || "はしご向け";
    const badge = getVal("特徴バッジ", "バッジ") || "";
    const catchphrase = getVal("キャッチコピー", "コピー");

    const set_title = getVal("酔いどれセット名", "セット名");
    const set_content = getVal("セット内容", "内容");
    const priceStr = getVal("価格(円)", "価格", "金額").replace(/[^\\d]/g, '');
    const price = priceStr ? parseInt(priceStr, 10) : 1000;
    const includeChargeStr = getVal("チャージ");
    const includeCharge = includeChargeStr.includes("込") || includeChargeStr.toLowerCase() === 'true';

    const days = getVal("提供日");
    const hours = getVal("提供時間");
    const limit = getVal("限定数");
    const notes = getVal("備考・注意事項", "備考", "注意事項");

    const eventTitle = getVal("イベント情報", "イベント");
    const paymentMethodsRaw = getVal("決済方法", "支払い方法");
    const paymentMethods = paymentMethodsRaw
      ? paymentMethodsRaw.split(/[,/、\\s]+/).filter(Boolean)
      : ["現金"];

    const googleMapUrl = getVal("Google Map URL", "GoogleMapURL", "マップURL") || `https://maps.google.com/?q=${{encodeURIComponent(name)}}`;
    const instagramUrl = getVal("Instagram URL", "InstagramURL", "インスタURL") || "https://instagram.com/";
    let photoFileName = getVal("photo", "Photo", "PHOTO", "写真", "画像");
    if (photoFileName) {{
      photoFileName = photoFileName.replace(/^photo[/\\\\]/i, '');
    }}
    const photoUrl = photoFileName ? `photo/${{photoFileName}}` : null;

    const existing = (typeof STORES_DATA !== 'undefined') ? STORES_DATA.find(s => s.id === id || s.name === name) : null;
    const mapPos = existing ? existing.mapPos : {{ top: `${{20 + (i * 7) % 60}}%`, left: `${{20 + (i * 11) % 60}}%` }};

    newStores.push({{
      id,
      name,
      ruby,
      area,
      category,
      type,
      isOpenToday: true,
      isEventActive: !!eventTitle,
      eventTitle,
      catchphrase,
      yoidoreSet: {{
        title: set_title,
        content: set_content,
        price,
        includeCharge
      }},
      conditions: {{
        days,
        hours,
        limit,
        soldOutEnd: limit.includes("限定") || limit.includes("完売"),
        notes
      }},
      paymentMethods,
      googleMapUrl,
      instagramUrl,
      photoUrl,
      mapPos,
      badge
    }});
  }}

  return newStores;
}}

function updateDataFromXLSX(arrayBuffer) {{
  const newStores = parseXLSXToStoresData(arrayBuffer);
  if (newStores && newStores.length > 0) {{
    STORES_DATA.length = 0;
    Array.prototype.push.apply(STORES_DATA, newStores);

    const areas = Array.from(new Set(STORES_DATA.map(s => s.area))).filter(Boolean);
    if (areas.length > 0) {{
      AREAS_LIST.length = 0;
      Array.prototype.push.apply(AREAS_LIST, areas);
    }}

    const categories = Array.from(new Set(STORES_DATA.map(s => s.category))).filter(Boolean);
    if (categories.length > 0) {{
      CATEGORIES_LIST.length = 0;
      Array.prototype.push.apply(CATEGORIES_LIST, categories);
    }}

    const types = Array.from(new Set(STORES_DATA.map(s => s.type))).filter(Boolean);
    if (types.length > 0) {{
      TYPES_LIST.length = 0;
      Array.prototype.push.apply(TYPES_LIST, types);
    }}

    return true;
  }}
  return false;
}}
"""

    with open(output_js_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

    print(f"成功: {len(stores)} 店舗のデータを {output_js_path} に出力しました。")
    return True

if __name__ == '__main__':
    convert_excel_to_js()
