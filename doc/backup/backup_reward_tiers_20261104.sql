-- Backup of reward_tiers (2026-11-04T02:09:47.052Z)
CREATE TABLE IF NOT EXISTS public.reward_tiers (
    id SERIAL PRIMARY KEY,
    required_visits INT NOT NULL,
    title TEXT NOT NULL,
    selectable_count INT DEFAULT 1,
    description TEXT
);

INSERT INTO public.reward_tiers (id, required_visits, title, selectable_count, description) VALUES
  (1, 3, '3軒はしご達成クーポン', 1, '対象店舗の中からお好きな1店舗の特典を選べます！'),
  (2, 5, '5軒完全制覇クーポン', 5, '対象店舗の中からお好きな5店舗の特典を選べます！');
