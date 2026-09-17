import os
import urllib.request
import urllib.parse

def generate_qrcodes():
    liff_id = "2011634811-l3iZWcv7"
    output_dir = os.path.join(os.path.dirname(__file__), "qrcodes")
    os.makedirs(output_dir, exist_ok=True)

    # 1〜60店舗分のQRコードURLを生成
    # QR生成にはGoogle Chart APIまたはオープンソースQR APIを使用
    print(f"Generating QR codes for LIFF: {liff_id}...")
    
    html_links = []
    for i in range(1, 61):
        store_id = f"store-{str(i).zfill(2)}"
        checkin_url = f"https://liff.line.me/{liff_id}?checkin={store_id}"
        
        # QRコード画像URL (QuickChart API - 高解像度・無料)
        qr_api_url = f"https://quickchart.io/qr?text={urllib.parse.quote(checkin_url)}&size=300&margin=2"
        
        html_links.append(f"""
        <div class="qr-card">
            <h3>{store_id}</h3>
            <img src="{qr_api_url}" alt="{store_id} QR Code" width="200" height="200" loading="lazy" />
            <p class="url-text">{checkin_url}</p>
        </div>
        """)

    # 印刷用HTMLの出力
    html_content = f"""<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>大正酔いどれクエストⅡ - 店舗用チェックインQRコード一覧</title>
    <style>
        body {{ font-family: sans-serif; background: #f0f2f5; padding: 20px; }}
        h1 {{ text-align: center; color: #1a1a1a; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }}
        .qr-card {{ background: white; border: 2px solid #333; border-radius: 8px; padding: 15px; text-align: center; page-break-inside: avoid; }}
        .qr-card h3 {{ margin: 0 0 10px 0; font-size: 1.2rem; color: #0a2380; }}
        .qr-card img {{ border: 1px solid #ddd; }}
        .url-text {{ font-size: 0.75rem; color: #666; word-break: break-all; margin-top: 8px; }}
        @media print {{
            body {{ background: white; padding: 0; }}
            .no-print {{ display: none; }}
        }}
    </style>
</head>
<body>
    <div class="no-print" style="text-align: center; margin-bottom: 20px;">
        <h1>大正酔いどれクエストⅡ - 店舗用チェックインQRコード (全60店舗)</h1>
        <p>※印刷して各店舗の卓上POPやレジ前に設置してください。ブラウザの「印刷」からA4印刷可能です。</p>
        <button onclick="window.print()" style="padding: 10px 20px; font-size: 1rem; cursor: pointer; background: #0a2380; color: white; border: none; border-radius: 4px;">🖨️ このページを印刷する</button>
    </div>
    <div class="grid">
        {"".join(html_links)}
    </div>
</body>
</html>
"""

    html_file = os.path.join(output_dir, "print_qrcodes.html")
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"Created printable QR sheet: {html_file}")

if __name__ == "__main__":
    generate_qrcodes()
