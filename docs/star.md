-- 2. 补黄 20、红 26
insert into public.star_sessions (user_id, date, source, coins_earned) values
('5b92e02a-1c34-46f2-b441-6142678c894f', to_char(now(), 'YYYY-MM-DD'), 'calc',    20),
('5b92e02a-1c34-46f2-b441-6142678c894f', to_char(now(), 'YYYY-MM-DD'), 'english', 26);
