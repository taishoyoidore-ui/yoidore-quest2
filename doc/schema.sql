-- ============================================================================
-- 大正酔いどれクエストⅡ - Supabase 現行本番データベーススキーマ定義 (Single Source of Truth)
-- ============================================================================
-- ※ 本定義は doc/SPECIFICATION.md（第4章・第6章）に完全準拠した現行稼働スキーマです。
-- ※ 稼働中の物理テーブルは以下の4テーブル（users, stores, visits, user_coupons）のみです。
-- ※ シーズン設定・特典ランク・称号設定は users テーブルの特別レコード
--    (line_user_id = '__system_config__') の display_name カラムに JSON 形式で格納されます。
-- ============================================================================

-- 1. ユーザー ＆ システム全体設定テーブル (users)
CREATE TABLE IF NOT EXISTS public.users (
    line_user_id TEXT PRIMARY KEY,
    display_name TEXT,
    picture_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 店舗マスタ ＆ シーズン別企画データテーブル (stores)
-- ※ 物理カラムは以下の6カラム（＋作成日時）に限定し、address やシーズン別企画データ等は
--    すべて raw_data (JSONB) 内に格納します。
CREATE TABLE IF NOT EXISTS public.stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    area TEXT,
    display_order INT DEFAULT 0,
    is_coupon_target BOOLEAN DEFAULT true,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 来店（ハシゴ）履歴テーブル (visits)
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(line_user_id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    season_id INT DEFAULT 2,
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, store_id, season_id)
);

-- 4. 獲得クーポン・記念品引換券テーブル (user_coupons)
-- ※ store_id は未利用枠（active）の段階では NULL となり、店頭での消込（used）時に店舗IDが記録されます。
-- ※ reward_tier_id は __system_config__ 内のティアID（数値）を参照するため外部キー制約は設けません。
CREATE TABLE IF NOT EXISTS public.user_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(line_user_id) ON DELETE CASCADE,
    store_id TEXT REFERENCES public.stores(id) ON DELETE CASCADE,
    reward_tier_id INT,
    season_id INT DEFAULT 2,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' (未使用), 'used' (使用済)
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    reward_type TEXT DEFAULT 'store_coupon', -- 'store_coupon' (お店クーポン), 'goods' (グッズ引換券)
    goods_name TEXT,
    exchange_location TEXT,
    exchange_notice TEXT
);

-- 5. RLS (Row Level Security) の設定（匿名キーでのCRUDを許可）
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow public delete users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update users" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Allow public delete users" ON public.users FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read stores" ON public.stores;
DROP POLICY IF EXISTS "Allow public insert stores" ON public.stores;
DROP POLICY IF EXISTS "Allow public update stores" ON public.stores;
DROP POLICY IF EXISTS "Allow public delete stores" ON public.stores;
CREATE POLICY "Allow public read stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Allow public insert stores" ON public.stores FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update stores" ON public.stores FOR UPDATE USING (true);
CREATE POLICY "Allow public delete stores" ON public.stores FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read visits" ON public.visits;
DROP POLICY IF EXISTS "Allow public insert visits" ON public.visits;
DROP POLICY IF EXISTS "Allow public update visits" ON public.visits;
DROP POLICY IF EXISTS "Allow public delete visits" ON public.visits;
CREATE POLICY "Allow public read visits" ON public.visits FOR SELECT USING (true);
CREATE POLICY "Allow public insert visits" ON public.visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update visits" ON public.visits FOR UPDATE USING (true);
CREATE POLICY "Allow public delete visits" ON public.visits FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow public read user_coupons" ON public.user_coupons;
DROP POLICY IF EXISTS "Allow public insert user_coupons" ON public.user_coupons;
DROP POLICY IF EXISTS "Allow public update user_coupons" ON public.user_coupons;
DROP POLICY IF EXISTS "Allow public delete user_coupons" ON public.user_coupons;
CREATE POLICY "Allow public read user_coupons" ON public.user_coupons FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_coupons" ON public.user_coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_coupons" ON public.user_coupons FOR UPDATE USING (true);
CREATE POLICY "Allow public delete user_coupons" ON public.user_coupons FOR DELETE USING (true);
