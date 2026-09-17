-- ============================================================================
-- 大正酔いどれクエスト - シーズン制・特典マイルストーン・称号管理マイグレーション
-- ============================================================================

-- 1. シーズンマスターテーブル作成
CREATE TABLE IF NOT EXISTS public.seasons (
    id INT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    coupon_valid_until DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期シーズン（第2回）をアクティブとして登録
INSERT INTO public.seasons (id, name, start_date, end_date, coupon_valid_until, is_active, description)
VALUES (2, '大正酔いどれクエストⅡ', '2026-08-01', '2026-08-31', '2026-09-30', true, '大正の酒場を巡る街ぶらはしご酒クエスト第2弾！')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    coupon_valid_until = EXCLUDED.coupon_valid_until,
    is_active = EXCLUDED.is_active,
    description = EXCLUDED.description;

-- 2. 特典マイルストーンテーブル作成（未作成の場合）
CREATE TABLE IF NOT EXISTS public.reward_tiers (
    id SERIAL PRIMARY KEY,
    season_id INT DEFAULT 2,
    required_visits INT NOT NULL,
    title TEXT NOT NULL,
    selectable_count INT DEFAULT 5,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期特典データの登録（5軒・10軒）
INSERT INTO public.reward_tiers (id, season_id, required_visits, title, selectable_count, description)
VALUES 
    (1, 2, 5, '5軒はしご達成特典', 5, 'クーポン取扱店の中からお好きな5店舗を選んで特典チケットを獲得！'),
    (2, 2, 10, '10軒はしご達成特典', 5, 'クーポン取扱店の中からさらにお好きな5店舗を選んで特典チケットを獲得！')
ON CONFLICT (id) DO UPDATE
SET season_id = EXCLUDED.season_id,
    required_visits = EXCLUDED.required_visits,
    title = EXCLUDED.title,
    selectable_count = EXCLUDED.selectable_count,
    description = EXCLUDED.description;

-- 3. 勇者レベル・称号設定テーブル作成
CREATE TABLE IF NOT EXISTS public.hero_titles (
    id SERIAL PRIMARY KEY,
    level INT NOT NULL,
    min_visits INT NOT NULL,
    title TEXT NOT NULL,
    badge_color TEXT DEFAULT '#facc15',
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期称号マスタデータの登録
INSERT INTO public.hero_titles (id, level, min_visits, title, badge_color, description, display_order)
VALUES
    (1, 1, 0, '駆け出しの呑兵衛', '#94a3b8', 'まだ1店舗も巡っていない初期状態', 1),
    (2, 2, 1, '見習い巡回兵', '#38bdf8', '最初のはしご酒を記録した勇者', 2),
    (3, 3, 3, 'ほろ酔い冒険者', '#4ade80', '順調にはしご酒を楽しむ冒険者', 3),
    (4, 4, 5, '酒場制覇の豪傑', '#facc15', '5店舗を制覇した頼もしい豪傑', 4),
    (5, 5, 10, '大正の伝説マスター', '#f43f5e', '10店舗以上を制覇した伝説の呑兵衛', 5),
    (6, 6, 20, '酔いどれ覇王', '#c084fc', '大正区全域を掌握する至高の覇王', 6),
    (7, 7, 33, '完全制覇グランドマスター', '#eab308', '全33店舗を完全制覇した神話の勇者', 7)
ON CONFLICT (id) DO UPDATE
SET level = EXCLUDED.level,
    min_visits = EXCLUDED.min_visits,
    title = EXCLUDED.title,
    badge_color = EXCLUDED.badge_color,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

-- 4. 既存テーブルへの season_id 追加
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS season_id INT DEFAULT 2;
ALTER TABLE public.user_coupons ADD COLUMN IF NOT EXISTS season_id INT DEFAULT 2;
ALTER TABLE public.reward_tiers ADD COLUMN IF NOT EXISTS season_id INT DEFAULT 2;

-- 5. RLS (Row Level Security) の設定
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hero_titles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all seasons" ON public.seasons;
DROP POLICY IF EXISTS "Allow public all reward_tiers" ON public.reward_tiers;
DROP POLICY IF EXISTS "Allow public all hero_titles" ON public.hero_titles;

CREATE POLICY "Allow public all seasons" ON public.seasons FOR ALL USING (true);
CREATE POLICY "Allow public all reward_tiers" ON public.reward_tiers FOR ALL USING (true);
CREATE POLICY "Allow public all hero_titles" ON public.hero_titles FOR ALL USING (true);

-- 削除（DELETE）ポリシーの追加（バックオフィスでのユーザー・ログ・クーポン削除を許可）
DROP POLICY IF EXISTS "Allow public delete users" ON public.users;
DROP POLICY IF EXISTS "Allow public delete visits" ON public.visits;
DROP POLICY IF EXISTS "Allow public delete user_coupons" ON public.user_coupons;

CREATE POLICY "Allow public delete users" ON public.users FOR DELETE USING (true);
CREATE POLICY "Allow public delete visits" ON public.visits FOR DELETE USING (true);
CREATE POLICY "Allow public delete user_coupons" ON public.user_coupons FOR DELETE USING (true);
