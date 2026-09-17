-- ============================================================================
-- 大正酔いどれクエストⅡ - Supabase データベース初期化スキーマ
-- ============================================================================

-- 1. ユーザーテーブル (LINE 認証ユーザー)
CREATE TABLE IF NOT EXISTS public.users (
    line_user_id TEXT PRIMARY KEY,
    display_name TEXT,
    picture_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 店舗マスタテーブル
CREATE TABLE IF NOT EXISTS public.stores (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    area TEXT,
    is_coupon_target BOOLEAN DEFAULT true,
    coupon_description TEXT,
    display_order INT DEFAULT 0,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 特典ランク・マイルストーンテーブル
CREATE TABLE IF NOT EXISTS public.reward_tiers (
    id SERIAL PRIMARY KEY,
    required_visits INT NOT NULL,
    title TEXT NOT NULL,
    selectable_count INT DEFAULT 1,
    description TEXT,
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期マイルストーン投入（5店舗で5枚、10店舗で5枚）
INSERT INTO public.reward_tiers (id, required_visits, title, selectable_count, description)
VALUES 
    (1, 5, '5軒はしご達成特典', 5, 'クーポン取扱店の中からお好きな5店舗を選んで特典チケットを獲得！'),
    (2, 10, '10軒はしご達成特典', 5, 'クーポン取扱店の中からさらにお好きな5店舗を選んで特典チケットを獲得！')
ON CONFLICT (id) DO UPDATE 
SET required_visits = EXCLUDED.required_visits,
    title = EXCLUDED.title,
    selectable_count = EXCLUDED.selectable_count,
    description = EXCLUDED.description;

-- 4. 来店ログテーブル (visits)
CREATE TABLE IF NOT EXISTS public.visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(line_user_id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, store_id)
);

-- 5. 所持クーポンテーブル (user_coupons)
CREATE TABLE IF NOT EXISTS public.user_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(line_user_id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
    reward_tier_id INT REFERENCES public.reward_tiers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, used, expired
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    UNIQUE(user_id, store_id)
);

-- 6. RLS (Row Level Security) の設定（匿名キーでの読取・書込を許可）
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow public insert users" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update users" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Allow public read stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Allow public read reward_tiers" ON public.reward_tiers FOR SELECT USING (true);

CREATE POLICY "Allow public read visits" ON public.visits FOR SELECT USING (true);
CREATE POLICY "Allow public insert visits" ON public.visits FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read user_coupons" ON public.user_coupons FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_coupons" ON public.user_coupons FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_coupons" ON public.user_coupons FOR UPDATE USING (true);
