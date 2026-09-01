-- 0030: 语文组词来源打标（课课贴校对）
-- 1) chinese_char_entries 新增 phrase_sources：词 → 来源（'teacher' = 教师材料，如二上课课贴）
-- 2) 按 2026 秋二上课课贴校对结果同步 248 个会写字：拼音/部首/结构/笔画/组词 + 打标
-- 3) 修正 9 处多音字课内拼音（尽/钉/似 双轨 + 种/得/仔 写字轨）

alter table public.chinese_char_entries
  add column if not exists phrase_sources jsonb not null default '{}'::jsonb;

comment on column public.chinese_char_entries.phrase_sources is
  '组词来源标注：{词: "teacher"}；未标注的词为默认来源';

-- 248 字同步（全部已存在，仅更新；不碰 stroke_order）
update public.chinese_char_entries set
  pinyin = 'chǒu', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '独体', stroke_count = 4,
  phrases = array['丑化', '家丑', '小丑']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"丑化": "teacher", "家丑": "teacher", "小丑": "teacher"}'::jsonb
  where char_key = 'g2a::丑';

update public.chinese_char_entries set
  pinyin = 'shì', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '独体', stroke_count = 5,
  phrases = array['世人', '生生世世']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"世人": "teacher", "生生世世": "teacher"}'::jsonb
  where char_key = 'g2a::世';

update public.chinese_char_entries set
  pinyin = 'cóng', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '上下', stroke_count = 5,
  phrases = array['花丛', '荆棘丛生']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"花丛": "teacher", "荆棘丛生": "teacher"}'::jsonb
  where char_key = 'g2a::丛';

update public.chinese_char_entries set
  pinyin = 'liǎng', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '独体', stroke_count = 7,
  phrases = array['三言两语', '两天']::text[], tiers = array['write']::text[], phrase_sources = '{"三言两语": "teacher", "两天": "teacher"}'::jsonb
  where char_key = 'g2a::两';

update public.chinese_char_entries set
  pinyin = 'fēng', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '独体', stroke_count = 4,
  phrases = array['丰收', '丰衣足食']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"丰收": "teacher", "丰衣足食": "teacher"}'::jsonb
  where char_key = 'g2a::丰';

update public.chinese_char_entries set
  pinyin = 'chuàn', pinyin_alt = array[]::text[], radical = '丨',
  radical_name = '竖', structure = '独体', stroke_count = 7,
  phrases = array['串通', '走街串巷']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"串通": "teacher", "走街串巷": "teacher"}'::jsonb
  where char_key = 'g2a::串';

update public.chinese_char_entries set
  pinyin = 'lì', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '上下', stroke_count = 7,
  phrases = array['美丽', '风和日丽']::text[], tiers = array['write']::text[], phrase_sources = '{"美丽": "teacher", "风和日丽": "teacher"}'::jsonb
  where char_key = 'g2a::丽';

update public.chinese_char_entries set
  pinyin = 'zhī', pinyin_alt = array[]::text[], radical = '丶',
  radical_name = '点', structure = '独体', stroke_count = 3,
  phrases = array['光荣之家', '总之']::text[], tiers = array['write']::text[], phrase_sources = '{"光荣之家": "teacher", "总之": "teacher"}'::jsonb
  where char_key = 'g2a::之';

update public.chinese_char_entries set
  pinyin = 'shì', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '独体', stroke_count = 8,
  phrases = array['事业', '事半功倍']::text[], tiers = array['write']::text[], phrase_sources = '{"事业": "teacher", "事半功倍": "teacher"}'::jsonb
  where char_key = 'g2a::事';

update public.chinese_char_entries set
  pinyin = 'yú', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '独体', stroke_count = 3,
  phrases = array['于是', '言归于好']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"于是": "teacher", "言归于好": "teacher"}'::jsonb
  where char_key = 'g2a::于';

update public.chinese_char_entries set
  pinyin = 'xiē', pinyin_alt = array[]::text[], radical = '止',
  radical_name = '止字旁', structure = '上下', stroke_count = 8,
  phrases = array['一些', '好些', '这些']::text[], tiers = array['write']::text[], phrase_sources = '{"一些": "teacher", "好些": "teacher", "这些": "teacher"}'::jsonb
  where char_key = 'g2a::些';

update public.chinese_char_entries set
  pinyin = 'liàng', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '上下', stroke_count = 9,
  phrases = array['心明眼亮', '明亮']::text[], tiers = array['write']::text[], phrase_sources = '{"心明眼亮": "teacher", "明亮": "teacher"}'::jsonb
  where char_key = 'g2a::亮';

update public.chinese_char_entries set
  pinyin = 'zǐ', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 5,
  phrases = array['仔仔细细', '仔鸡']::text[], tiers = array['write']::text[], phrase_sources = '{"仔仔细细": "teacher", "仔鸡": "teacher"}'::jsonb
  where char_key = 'g2a::仔';

update public.chinese_char_entries set
  pinyin = 'xiān', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 5,
  phrases = array['仙女', '八仙过海']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"仙女": "teacher", "八仙过海": "teacher"}'::jsonb
  where char_key = 'g2a::仙';

update public.chinese_char_entries set
  pinyin = 'dài', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 5,
  phrases = array['世世代代', '古代']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"世世代代": "teacher", "古代": "teacher"}'::jsonb
  where char_key = 'g2a::代';

update public.chinese_char_entries set
  pinyin = 'lìng', pinyin_alt = array[]::text[], radical = '人',
  radical_name = '单人旁', structure = '上下', stroke_count = 5,
  phrases = array['三令五申', '命令']::text[], tiers = array['write']::text[], phrase_sources = '{"三令五申": "teacher", "命令": "teacher"}'::jsonb
  where char_key = 'g2a::令';

update public.chinese_char_entries set
  pinyin = 'yǐ', pinyin_alt = array[]::text[], radical = '人',
  radical_name = '单人旁', structure = '左右', stroke_count = 4,
  phrases = array['以假乱真', '以前']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"以假乱真": "teacher", "以前": "teacher"}'::jsonb
  where char_key = 'g2a::以';

update public.chinese_char_entries set
  pinyin = 'fèn', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 6,
  phrases = array['一份', '年份', '月份']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"一份": "teacher", "年份": "teacher", "月份": "teacher"}'::jsonb
  where char_key = 'g2a::份';

update public.chinese_char_entries set
  pinyin = 'xiū', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 6,
  phrases = array['休养生息', '午休']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"休养生息": "teacher", "午休": "teacher"}'::jsonb
  where char_key = 'g2a::休';

update public.chinese_char_entries set
  pinyin = 'huǒ', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 6,
  phrases = array['伙计', '成群结伙']::text[], tiers = array['write']::text[], phrase_sources = '{"伙计": "teacher", "成群结伙": "teacher"}'::jsonb
  where char_key = 'g2a::伙';

update public.chinese_char_entries set
  pinyin = 'bàn', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 7,
  phrases = array['伙伴', '呼朋引伴']::text[], tiers = array['write']::text[], phrase_sources = '{"伙伴": "teacher", "呼朋引伴": "teacher"}'::jsonb
  where char_key = 'g2a::伴';

update public.chinese_char_entries set
  pinyin = 'shì', pinyin_alt = array['sì']::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 6,
  phrases = array['似是而非', '相似']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"似是而非": "teacher", "相似": "teacher"}'::jsonb
  where char_key = 'g2a::似';

update public.chinese_char_entries set
  pinyin = 'dàn', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 7,
  phrases = array['但愿如此', '但是']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"但愿如此": "teacher", "但是": "teacher"}'::jsonb
  where char_key = 'g2a::但';

update public.chinese_char_entries set
  pinyin = 'wèi', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 7,
  phrases = array['座位', '虚位以待']::text[], tiers = array['write']::text[], phrase_sources = '{"座位": "teacher", "虚位以待": "teacher"}'::jsonb
  where char_key = 'g2a::位';

update public.chinese_char_entries set
  pinyin = 'dī', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 7,
  phrases = array['低三下四', '高低']::text[], tiers = array['write']::text[], phrase_sources = '{"低三下四": "teacher", "高低": "teacher"}'::jsonb
  where char_key = 'g2a::低';

update public.chinese_char_entries set
  pinyin = 'tǐ', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 7,
  phrases = array['体育', '身体力行']::text[], tiers = array['write']::text[], phrase_sources = '{"体育": "teacher", "身体力行": "teacher"}'::jsonb
  where char_key = 'g2a::体';

update public.chinese_char_entries set
  pinyin = 'zuò', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 7,
  phrases = array['一鼓作气', '作业']::text[], tiers = array['write']::text[], phrase_sources = '{"一鼓作气": "teacher", "作业": "teacher"}'::jsonb
  where char_key = 'g2a::作';

update public.chinese_char_entries set
  pinyin = 'yī', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 8,
  phrases = array['依依不舍', '依次']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"依依不舍": "teacher", "依次": "teacher"}'::jsonb
  where char_key = 'g2a::依';

update public.chinese_char_entries set
  pinyin = 'bǎo', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 9,
  phrases = array['保家卫国', '保护']::text[], tiers = array['write']::text[], phrase_sources = '{"保家卫国": "teacher", "保护": "teacher"}'::jsonb
  where char_key = 'g2a::保';

update public.chinese_char_entries set
  pinyin = 'xìn', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 9,
  phrases = array['信以为真', '相信']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"信以为真": "teacher", "相信": "teacher"}'::jsonb
  where char_key = 'g2a::信';

update public.chinese_char_entries set
  pinyin = 'zuò', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 11,
  phrases = array['做人', '小题大做']::text[], tiers = array['write']::text[], phrase_sources = '{"做人": "teacher", "小题大做": "teacher"}'::jsonb
  where char_key = 'g2a::做';

update public.chinese_char_entries set
  pinyin = 'xiàng', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 13,
  phrases = array['像模像样', '好像']::text[], tiers = array['write']::text[], phrase_sources = '{"像模像样": "teacher", "好像": "teacher"}'::jsonb
  where char_key = 'g2a::像';

update public.chinese_char_entries set
  pinyin = 'jūn', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '上下', stroke_count = 6,
  phrases = array['军人', '千军万马']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"军人": "teacher", "千军万马": "teacher"}'::jsonb
  where char_key = 'g2a::军';

update public.chinese_char_entries set
  pinyin = 'nóng', pinyin_alt = array[]::text[], radical = '丶',
  radical_name = '点', structure = '独体', stroke_count = 6,
  phrases = array['农民', '士农工商']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"农民": "teacher", "士农工商": "teacher"}'::jsonb
  where char_key = 'g2a::农';

update public.chinese_char_entries set
  pinyin = 'bīng', pinyin_alt = array[]::text[], radical = '冫',
  radical_name = '两点水', structure = '左右', stroke_count = 6,
  phrases = array['冰天雪地', '冰山']::text[], tiers = array['write']::text[], phrase_sources = '{"冰天雪地": "teacher", "冰山": "teacher"}'::jsonb
  where char_key = 'g2a::冰';

update public.chinese_char_entries set
  pinyin = 'lěng', pinyin_alt = array[]::text[], radical = '冫',
  radical_name = '两点水', structure = '左右', stroke_count = 7,
  phrases = array['冷暖自知', '冷清']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"冷暖自知": "teacher", "冷清": "teacher"}'::jsonb
  where char_key = 'g2a::冷';

update public.chinese_char_entries set
  pinyin = 'dòng', pinyin_alt = array[]::text[], radical = '冫',
  radical_name = '两点水', structure = '左右', stroke_count = 7,
  phrases = array['冷冻', '天寒地冻']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"冷冻": "teacher", "天寒地冻": "teacher"}'::jsonb
  where char_key = 'g2a::冻';

update public.chinese_char_entries set
  pinyin = 'qiè', pinyin_alt = array[]::text[], radical = '刀',
  radical_name = '刀部', structure = '左右', stroke_count = 4,
  phrases = array['一切', '救人心切']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"一切": "teacher", "救人心切": "teacher"}'::jsonb
  where char_key = 'g2a::切';

update public.chinese_char_entries set
  pinyin = 'chū', pinyin_alt = array[]::text[], radical = '衣',
  radical_name = '衣字旁', structure = '左右', stroke_count = 7,
  phrases = array['初一', '初来乍到']::text[], tiers = array['write']::text[], phrase_sources = '{"初一": "teacher", "初来乍到": "teacher"}'::jsonb
  where char_key = 'g2a::初';

update public.chinese_char_entries set
  pinyin = 'lì', pinyin_alt = array[]::text[], radical = '刂',
  radical_name = '立刀旁', structure = '左右', stroke_count = 7,
  phrases = array['急功近利', '胜利']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"急功近利": "teacher", "胜利": "teacher"}'::jsonb
  where char_key = 'g2a::利';

update public.chinese_char_entries set
  pinyin = 'bié', pinyin_alt = array[]::text[], radical = '刂',
  radical_name = '立刀旁', structure = '左右', stroke_count = 7,
  phrases = array['别人', '别具一格']::text[], tiers = array['write']::text[], phrase_sources = '{"别人": "teacher", "别具一格": "teacher"}'::jsonb
  where char_key = 'g2a::别';

update public.chinese_char_entries set
  pinyin = 'bàn', pinyin_alt = array[]::text[], radical = '力',
  radical_name = '力字旁', structure = '独体', stroke_count = 4,
  phrases = array['公事公办', '办法']::text[], tiers = array['write']::text[], phrase_sources = '{"公事公办": "teacher", "办法": "teacher"}'::jsonb
  where char_key = 'g2a::办';

update public.chinese_char_entries set
  pinyin = 'sháo', pinyin_alt = array[]::text[], radical = '勹',
  radical_name = '包字头', structure = '半包围', stroke_count = 3,
  phrases = array['勺子', '汤勺', '饭勺']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"勺子": "teacher", "汤勺": "teacher", "饭勺": "teacher"}'::jsonb
  where char_key = 'g2a::勺';

update public.chinese_char_entries set
  pinyin = 'huà', pinyin_alt = array[]::text[], radical = '亻',
  radical_name = '单人旁', structure = '左右', stroke_count = 4,
  phrases = array['化肥', '千变万化']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"化肥": "teacher", "千变万化": "teacher"}'::jsonb
  where char_key = 'g2a::化';

update public.chinese_char_entries set
  pinyin = 'qū', pinyin_alt = array[]::text[], radical = '匚',
  radical_name = '三框儿', structure = '半包围', stroke_count = 4,
  phrases = array['区别', '城区', '山区']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"区别": "teacher", "城区": "teacher", "山区": "teacher"}'::jsonb
  where char_key = 'g2a::区';

update public.chinese_char_entries set
  pinyin = 'shēng', pinyin_alt = array[]::text[], radical = '丿',
  radical_name = '撇', structure = '独体', stroke_count = 4,
  phrases = array['升高', '旭日东升']::text[], tiers = array['write']::text[], phrase_sources = '{"升高": "teacher", "旭日东升": "teacher"}'::jsonb
  where char_key = 'g2a::升';

update public.chinese_char_entries set
  pinyin = 'yǒu', pinyin_alt = array[]::text[], radical = '又',
  radical_name = '又字旁', structure = '半包围', stroke_count = 4,
  phrases = array['友好', '良师益友']::text[], tiers = array['write']::text[], phrase_sources = '{"友好": "teacher", "良师益友": "teacher"}'::jsonb
  where char_key = 'g2a::友';

update public.chinese_char_entries set
  pinyin = 'fǎn', pinyin_alt = array[]::text[], radical = '厂',
  radical_name = '厂部', structure = '半包围', stroke_count = 4,
  phrases = array['举一反三', '反正']::text[], tiers = array['write']::text[], phrase_sources = '{"举一反三": "teacher", "反正": "teacher"}'::jsonb
  where char_key = 'g2a::反';

update public.chinese_char_entries set
  pinyin = 'fā', pinyin_alt = array[]::text[], radical = '又',
  radical_name = '又字旁', structure = '半包围', stroke_count = 5,
  phrases = array['出发', '发扬光大']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"出发": "teacher", "发扬光大": "teacher"}'::jsonb
  where char_key = 'g2a::发';

update public.chinese_char_entries set
  pinyin = 'shòu', pinyin_alt = array[]::text[], radical = '又',
  radical_name = '又字旁', structure = '上中下', stroke_count = 8,
  phrases = array['忍受', '感同身受']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"忍受": "teacher", "感同身受": "teacher"}'::jsonb
  where char_key = 'g2a::受';

update public.chinese_char_entries set
  pinyin = 'biàn', pinyin_alt = array[]::text[], radical = '又',
  radical_name = '又字旁', structure = '上下', stroke_count = 8,
  phrases = array['变化', '谈虎色变']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"变化": "teacher", "谈虎色变": "teacher"}'::jsonb
  where char_key = 'g2a::变';

update public.chinese_char_entries set
  pinyin = 'jù', pinyin_alt = array[]::text[], radical = '勹',
  radical_name = '包字头', structure = '半包围', stroke_count = 5,
  phrases = array['句子', '名言警句']::text[], tiers = array['write']::text[], phrase_sources = '{"句子": "teacher", "名言警句": "teacher"}'::jsonb
  where char_key = 'g2a::句';

update public.chinese_char_entries set
  pinyin = 'hào', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '上下', stroke_count = 5,
  phrases = array['口号', '号令如山']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"口号": "teacher", "号令如山": "teacher"}'::jsonb
  where char_key = 'g2a::号';

update public.chinese_char_entries set
  pinyin = 'tóng', pinyin_alt = array[]::text[], radical = '门',
  radical_name = '门字旁', structure = '半包围', stroke_count = 6,
  phrases = array['同时', '情同手足']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"同时": "teacher", "情同手足": "teacher"}'::jsonb
  where char_key = 'g2a::同';

update public.chinese_char_entries set
  pinyin = 'míng', pinyin_alt = array[]::text[], radical = '夕',
  radical_name = '夕部', structure = '上下', stroke_count = 6,
  phrases = array['举世闻名', '姓名']::text[], tiers = array['write']::text[], phrase_sources = '{"举世闻名": "teacher", "姓名": "teacher"}'::jsonb
  where char_key = 'g2a::名';

update public.chinese_char_entries set
  pinyin = 'ma', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 6,
  phrases = array['好吗', '是吗', '行吗']::text[], tiers = array['write']::text[], phrase_sources = '{"好吗": "teacher", "是吗": "teacher", "行吗": "teacher"}'::jsonb
  where char_key = 'g2a::吗';

update public.chinese_char_entries set
  pinyin = 'ba', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 7,
  phrases = array['好吧', '行吧', '走吧']::text[], tiers = array['write']::text[], phrase_sources = '{"好吧": "teacher", "行吧": "teacher", "走吧": "teacher"}'::jsonb
  where char_key = 'g2a::吧';

update public.chinese_char_entries set
  pinyin = 'chǎo', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 7,
  phrases = array['吵吵闹闹', '吵架']::text[], tiers = array['write']::text[], phrase_sources = '{"吵吵闹闹": "teacher", "吵架": "teacher"}'::jsonb
  where char_key = 'g2a::吵';

update public.chinese_char_entries set
  pinyin = 'ya', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 7,
  phrases = array['哎呀', '好呀', '来呀']::text[], tiers = array['write']::text[], phrase_sources = '{"哎呀": "teacher", "好呀": "teacher", "来呀": "teacher"}'::jsonb
  where char_key = 'g2a::呀';

update public.chinese_char_entries set
  pinyin = 'yuán', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '上下', stroke_count = 7,
  phrases = array['党员', '学员', '演员']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"党员": "teacher", "学员": "teacher", "演员": "teacher"}'::jsonb
  where char_key = 'g2a::员';

update public.chinese_char_entries set
  pinyin = 'ne', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 8,
  phrases = array['你呢', '念念呢呢']::text[], tiers = array['write']::text[], phrase_sources = '{"你呢": "teacher", "念念呢呢": "teacher"}'::jsonb
  where char_key = 'g2a::呢';

update public.chinese_char_entries set
  pinyin = 'wèi', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 8,
  phrases = array['五味杂陈', '口味']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"五味杂陈": "teacher", "口味": "teacher"}'::jsonb
  where char_key = 'g2a::味';

update public.chinese_char_entries set
  pinyin = 'zán', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 9,
  phrases = array['咱们', '咱俩', '咱家']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"咱们": "teacher", "咱俩": "teacher", "咱家": "teacher"}'::jsonb
  where char_key = 'g2a::咱';

update public.chinese_char_entries set
  pinyin = 'gē', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '上下', stroke_count = 10,
  phrases = array['哥哥', '大哥', '帅哥']::text[], tiers = array['write']::text[], phrase_sources = '{"哥哥": "teacher", "大哥": "teacher", "帅哥": "teacher"}'::jsonb
  where char_key = 'g2a::哥';

update public.chinese_char_entries set
  pinyin = 'nǎ', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 9,
  phrases = array['哪年哪月', '哪里']::text[], tiers = array['write']::text[], phrase_sources = '{"哪年哪月": "teacher", "哪里": "teacher"}'::jsonb
  where char_key = 'g2a::哪';

update public.chinese_char_entries set
  pinyin = 'kū', pinyin_alt = array[]::text[], radical = '犬',
  radical_name = '反犬旁', structure = '上下', stroke_count = 10,
  phrases = array['哭泣', '哭笑不得']::text[], tiers = array['write']::text[], phrase_sources = '{"哭泣": "teacher", "哭笑不得": "teacher"}'::jsonb
  where char_key = 'g2a::哭';

update public.chinese_char_entries set
  pinyin = 'a', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '左右', stroke_count = 10,
  phrases = array['盼啊盼', '飘啊飘']::text[], tiers = array['write']::text[], phrase_sources = '{"盼啊盼": "teacher", "飘啊飘": "teacher"}'::jsonb
  where char_key = 'g2a::啊';

update public.chinese_char_entries set
  pinyin = 'yīn', pinyin_alt = array[]::text[], radical = '囗',
  radical_name = '国字框', structure = '全包围', stroke_count = 6,
  phrases = array['因为', '因小失大']::text[], tiers = array['write']::text[], phrase_sources = '{"因为": "teacher", "因小失大": "teacher"}'::jsonb
  where char_key = 'g2a::因';

update public.chinese_char_entries set
  pinyin = 'yuán', pinyin_alt = array[]::text[], radical = '囗',
  radical_name = '国字框', structure = '全包围', stroke_count = 7,
  phrases = array['满园春色', '花园']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"满园春色": "teacher", "花园": "teacher"}'::jsonb
  where char_key = 'g2a::园';

update public.chinese_char_entries set
  pinyin = 'tú', pinyin_alt = array[]::text[], radical = '囗',
  radical_name = '国字框', structure = '全包围', stroke_count = 8,
  phrases = array['发奋图强', '图片']::text[], tiers = array['write']::text[], phrase_sources = '{"发奋图强": "teacher", "图片": "teacher"}'::jsonb
  where char_key = 'g2a::图';

update public.chinese_char_entries set
  pinyin = 'yuán', pinyin_alt = array[]::text[], radical = '囗',
  radical_name = '国字框', structure = '全包围', stroke_count = 10,
  phrases = array['圆形', '花好月圆']::text[], tiers = array['write']::text[], phrase_sources = '{"圆形": "teacher", "花好月圆": "teacher"}'::jsonb
  where char_key = 'g2a::圆';

update public.chinese_char_entries set
  pinyin = 'kuài', pinyin_alt = array[]::text[], radical = '土',
  radical_name = '土字旁', structure = '左右', stroke_count = 7,
  phrases = array['方块', '铁板一块']::text[], tiers = array['write']::text[], phrase_sources = '{"方块": "teacher", "铁板一块": "teacher"}'::jsonb
  where char_key = 'g2a::块';

update public.chinese_char_entries set
  pinyin = 'chéng', pinyin_alt = array[]::text[], radical = '土',
  radical_name = '土字旁', structure = '左右', stroke_count = 9,
  phrases = array['价值连城', '城市']::text[], tiers = array['write']::text[], phrase_sources = '{"价值连城": "teacher", "城市": "teacher"}'::jsonb
  where char_key = 'g2a::城';

update public.chinese_char_entries set
  pinyin = 'shì', pinyin_alt = array[]::text[], radical = '士',
  radical_name = '士部', structure = '独体', stroke_count = 3,
  phrases = array['将士', '有识之士']::text[], tiers = array['write']::text[], phrase_sources = '{"将士": "teacher", "有识之士": "teacher"}'::jsonb
  where char_key = 'g2a::士';

update public.chinese_char_entries set
  pinyin = 'shēng', pinyin_alt = array[]::text[], radical = '士',
  radical_name = '士部', structure = '上下', stroke_count = 7,
  phrases = array['不动声色', '声音']::text[], tiers = array['write']::text[], phrase_sources = '{"不动声色": "teacher", "声音": "teacher"}'::jsonb
  where char_key = 'g2a::声';

update public.chinese_char_entries set
  pinyin = 'chù', pinyin_alt = array[]::text[], radical = '夂',
  radical_name = '折文', structure = '半包围', stroke_count = 5,
  phrases = array['一无是处', '好处']::text[], tiers = array['write']::text[], phrase_sources = '{"一无是处": "teacher", "好处": "teacher"}'::jsonb
  where char_key = 'g2a::处';

update public.chinese_char_entries set
  pinyin = 'wài', pinyin_alt = array[]::text[], radical = '夕',
  radical_name = '夕部', structure = '左右', stroke_count = 5,
  phrases = array['喜出望外', '外地']::text[], tiers = array['write']::text[], phrase_sources = '{"喜出望外": "teacher", "外地": "teacher"}'::jsonb
  where char_key = 'g2a::外';

update public.chinese_char_entries set
  pinyin = 'shī', pinyin_alt = array[]::text[], radical = '丿',
  radical_name = '撇', structure = '独体', stroke_count = 5,
  phrases = array['大惊失色', '消失']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"大惊失色": "teacher", "消失": "teacher"}'::jsonb
  where char_key = 'g2a::失';

update public.chinese_char_entries set
  pinyin = 'qí', pinyin_alt = array[]::text[], radical = '大',
  radical_name = '大字头', structure = '上下', stroke_count = 8,
  phrases = array['千奇百怪', '好奇']::text[], tiers = array['write']::text[], phrase_sources = '{"千奇百怪": "teacher", "好奇": "teacher"}'::jsonb
  where char_key = 'g2a::奇';

update public.chinese_char_entries set
  pinyin = 'nǎi', pinyin_alt = array[]::text[], radical = '女',
  radical_name = '女字旁', structure = '左右', stroke_count = 5,
  phrases = array['奶声奶气', '奶奶']::text[], tiers = array['write']::text[], phrase_sources = '{"奶声奶气": "teacher", "奶奶": "teacher"}'::jsonb
  where char_key = 'g2a::奶';

update public.chinese_char_entries set
  pinyin = 'rú', pinyin_alt = array[]::text[], radical = '女',
  radical_name = '女字旁', structure = '左右', stroke_count = 6,
  phrases = array['如果', '泪如雨下']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"如果": "teacher", "泪如雨下": "teacher"}'::jsonb
  where char_key = 'g2a::如';

update public.chinese_char_entries set
  pinyin = 'kǒng', pinyin_alt = array[]::text[], radical = '子',
  radical_name = '子字旁', structure = '左右', stroke_count = 4,
  phrases = array['无孔不入', '毛孔']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"无孔不入": "teacher", "毛孔": "teacher"}'::jsonb
  where char_key = 'g2a::孔';

update public.chinese_char_entries set
  pinyin = 'jì', pinyin_alt = array[]::text[], radical = '禾',
  radical_name = '禾木旁', structure = '上下', stroke_count = 8,
  phrases = array['四季如春', '季节']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"四季如春": "teacher", "季节": "teacher"}'::jsonb
  where char_key = 'g2a::季';

update public.chinese_char_entries set
  pinyin = 'hái', pinyin_alt = array[]::text[], radical = '子',
  radical_name = '子字旁', structure = '左右', stroke_count = 9,
  phrases = array['女孩', '小孩', '男孩']::text[], tiers = array['write']::text[], phrase_sources = '{"女孩": "teacher", "小孩": "teacher", "男孩": "teacher"}'::jsonb
  where char_key = 'g2a::孩';

update public.chinese_char_entries set
  pinyin = 'níng', pinyin_alt = array[]::text[], radical = '宀',
  radical_name = '宝盖头', structure = '上下', stroke_count = 5,
  phrases = array['安宁', '鸡犬不宁']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"安宁": "teacher", "鸡犬不宁": "teacher"}'::jsonb
  where char_key = 'g2a::宁';

update public.chinese_char_entries set
  pinyin = 'bǎo', pinyin_alt = array[]::text[], radical = '宀',
  radical_name = '宝盖头', structure = '上下', stroke_count = 8,
  phrases = array['如获至宝', '宝贝']::text[], tiers = array['write']::text[], phrase_sources = '{"如获至宝": "teacher", "宝贝": "teacher"}'::jsonb
  where char_key = 'g2a::宝';

update public.chinese_char_entries set
  pinyin = 'kè', pinyin_alt = array[]::text[], radical = '宀',
  radical_name = '宝盖头', structure = '上下', stroke_count = 9,
  phrases = array['不速之客', '客人']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"不速之客": "teacher", "客人": "teacher"}'::jsonb
  where char_key = 'g2a::客';

update public.chinese_char_entries set
  pinyin = 'kuān', pinyin_alt = array[]::text[], radical = '宀',
  radical_name = '宝盖头', structure = '上下', stroke_count = 10,
  phrases = array['宽容大度', '宽广']::text[], tiers = array['write']::text[], phrase_sources = '{"宽容大度": "teacher", "宽广": "teacher"}'::jsonb
  where char_key = 'g2a::宽';

update public.chinese_char_entries set
  pinyin = 'jiù', pinyin_alt = array[]::text[], radical = '亠',
  radical_name = '京字头', structure = '左右', stroke_count = 12,
  phrases = array['功成名就', '就是']::text[], tiers = array['write']::text[], phrase_sources = '{"功成名就": "teacher", "就是": "teacher"}'::jsonb
  where char_key = 'g2a::就';

update public.chinese_char_entries set
  pinyin = 'jìn', pinyin_alt = array[]::text[], radical = '尸',
  radical_name = '尸字头', structure = '上下', stroke_count = 6,
  phrases = array['尽头', '山穷水尽', '穷尽']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"尽头": "teacher", "山穷水尽": "teacher"}'::jsonb
  where char_key = 'g2a::尽';

update public.chinese_char_entries set
  pinyin = 'céng', pinyin_alt = array[]::text[], radical = '尸',
  radical_name = '尸字头', structure = '半包围', stroke_count = 7,
  phrases = array['层出不穷', '层叠', '层次']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"层出不穷": "teacher", "层次": "teacher"}'::jsonb
  where char_key = 'g2a::层';

update public.chinese_char_entries set
  pinyin = 'jū', pinyin_alt = array[]::text[], radical = '尸',
  radical_name = '尸字头', structure = '半包围', stroke_count = 8,
  phrases = array['居住', '居安思危']::text[], tiers = array['write']::text[], phrase_sources = '{"居住": "teacher", "居安思危": "teacher"}'::jsonb
  where char_key = 'g2a::居';

update public.chinese_char_entries set
  pinyin = 'suì', pinyin_alt = array[]::text[], radical = '山',
  radical_name = '山字旁', structure = '上下', stroke_count = 6,
  phrases = array['岁月', '长命百岁']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"岁月": "teacher", "长命百岁": "teacher"}'::jsonb
  where char_key = 'g2a::岁';

update public.chinese_char_entries set
  pinyin = 'dǎo', pinyin_alt = array[]::text[], radical = '山',
  radical_name = '山字旁', structure = '半包围', stroke_count = 7,
  phrases = array['小岛', '郊寒岛瘦']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"小岛": "teacher", "郊寒岛瘦": "teacher"}'::jsonb
  where char_key = 'g2a::岛';

update public.chinese_char_entries set
  pinyin = 'chuān', pinyin_alt = array[]::text[], radical = '丿',
  radical_name = '撇', structure = '独体', stroke_count = 3,
  phrases = array['四川', '山川', '川流不息']::text[], tiers = array['write']::text[], phrase_sources = '{"四川": "teacher", "川流不息": "teacher"}'::jsonb
  where char_key = 'g2a::川';

update public.chinese_char_entries set
  pinyin = 'jù', pinyin_alt = array[]::text[], radical = '匚',
  radical_name = '三框儿', structure = '独体', stroke_count = 4,
  phrases = array['事无巨细', '巨人']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"事无巨细": "teacher", "巨人": "teacher"}'::jsonb
  where char_key = 'g2a::巨';

update public.chinese_char_entries set
  pinyin = 'yǐ', pinyin_alt = array[]::text[], radical = '己',
  radical_name = '己部', structure = '独体', stroke_count = 3,
  phrases = array['万不得已', '已经']::text[], tiers = array['write']::text[], phrase_sources = '{"万不得已": "teacher", "已经": "teacher"}'::jsonb
  where char_key = 'g2a::已';

update public.chinese_char_entries set
  pinyin = 'shì', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '上下', stroke_count = 5,
  phrases = array['市长', '门庭若市']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"市长": "teacher", "门庭若市": "teacher"}'::jsonb
  where char_key = 'g2a::市';

update public.chinese_char_entries set
  pinyin = 'cháng', pinyin_alt = array[]::text[], radical = '巾',
  radical_name = '巾字旁', structure = '上下', stroke_count = 11,
  phrases = array['习以为常', '非常']::text[], tiers = array['write']::text[], phrase_sources = '{"习以为常": "teacher", "非常": "teacher"}'::jsonb
  where char_key = 'g2a::常';

update public.chinese_char_entries set
  pinyin = 'kù', pinyin_alt = array[]::text[], radical = '广',
  radical_name = '广字头', structure = '半包围', stroke_count = 7,
  phrases = array['千仓万库', '车库']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"千仓万库": "teacher", "车库": "teacher"}'::jsonb
  where char_key = 'g2a::库';

update public.chinese_char_entries set
  pinyin = 'zuò', pinyin_alt = array[]::text[], radical = '广',
  radical_name = '广字头', structure = '半包围', stroke_count = 10,
  phrases = array['一座', '高朋满座']::text[], tiers = array['write']::text[], phrase_sources = '{"一座": "teacher", "高朋满座": "teacher"}'::jsonb
  where char_key = 'g2a::座';

update public.chinese_char_entries set
  pinyin = 'zhāng', pinyin_alt = array[]::text[], radical = '弓',
  radical_name = '弓字旁', structure = '左右', stroke_count = 7,
  phrases = array['张开', '张灯结彩']::text[], tiers = array['write']::text[], phrase_sources = '{"张开": "teacher", "张灯结彩": "teacher"}'::jsonb
  where char_key = 'g2a::张';

update public.chinese_char_entries set
  pinyin = 'wān', pinyin_alt = array[]::text[], radical = '弓',
  radical_name = '弓字旁', structure = '上下', stroke_count = 9,
  phrases = array['弯弓', '弯曲', '转弯']::text[], tiers = array['write']::text[], phrase_sources = '{"弯弓": "teacher", "弯曲": "teacher", "转弯": "teacher"}'::jsonb
  where char_key = 'g2a::弯';

update public.chinese_char_entries set
  pinyin = 'xíng', pinyin_alt = array[]::text[], radical = '彡',
  radical_name = '三撇', structure = '左右', stroke_count = 7,
  phrases = array['形影不离', '形状']::text[], tiers = array['write']::text[], phrase_sources = '{"形影不离": "teacher", "形状": "teacher"}'::jsonb
  where char_key = 'g2a::形';

update public.chinese_char_entries set
  pinyin = 'cǎi', pinyin_alt = array[]::text[], radical = '彡',
  radical_name = '三撇', structure = '左右', stroke_count = 11,
  phrases = array['云彩', '喝彩', '彩虹']::text[], tiers = array['write']::text[], phrase_sources = '{"云彩": "teacher", "喝彩": "teacher", "彩虹": "teacher"}'::jsonb
  where char_key = 'g2a::彩';

update public.chinese_char_entries set
  pinyin = 'hěn', pinyin_alt = array[]::text[], radical = '彳',
  radical_name = '双人旁', structure = '左右', stroke_count = 9,
  phrases = array['很多', '很好', '很快']::text[], tiers = array['write']::text[], phrase_sources = '{"很多": "teacher", "很好": "teacher", "很快": "teacher"}'::jsonb
  where char_key = 'g2a::很';

update public.chinese_char_entries set
  pinyin = 'dé', pinyin_alt = array['de']::text[], radical = '彳',
  radical_name = '双人旁', structure = '左右', stroke_count = 11,
  phrases = array['跑得快', '飞得高']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"跑得快": "teacher", "飞得高": "teacher"}'::jsonb
  where char_key = 'g2a::得';

update public.chinese_char_entries set
  pinyin = 'zhì', pinyin_alt = array[]::text[], radical = '士',
  radical_name = '士部', structure = '上下', stroke_count = 7,
  phrases = array['专心致志', '志向']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"专心致志": "teacher", "志向": "teacher"}'::jsonb
  where char_key = 'g2a::志';

update public.chinese_char_entries set
  pinyin = 'wàng', pinyin_alt = array[]::text[], radical = '心',
  radical_name = '心字底', structure = '上下', stroke_count = 7,
  phrases = array['忘记', '过目不忘']::text[], tiers = array['write']::text[], phrase_sources = '{"忘记": "teacher", "过目不忘": "teacher"}'::jsonb
  where char_key = 'g2a::忘';

update public.chinese_char_entries set
  pinyin = 'máng', pinyin_alt = array[]::text[], radical = '忄',
  radical_name = '竖心旁', structure = '左右', stroke_count = 6,
  phrases = array['不慌不忙', '连忙']::text[], tiers = array['write']::text[], phrase_sources = '{"不慌不忙": "teacher", "连忙": "teacher"}'::jsonb
  where char_key = 'g2a::忙';

update public.chinese_char_entries set
  pinyin = 'zěn', pinyin_alt = array[]::text[], radical = '心',
  radical_name = '心字底', structure = '上下', stroke_count = 9,
  phrases = array['怎么', '怎样']::text[], tiers = array['write']::text[], phrase_sources = '{"怎么": "teacher", "怎样": "teacher"}'::jsonb
  where char_key = 'g2a::怎';

update public.chinese_char_entries set
  pinyin = 'guài', pinyin_alt = array[]::text[], radical = '忄',
  radical_name = '竖心旁', structure = '左右', stroke_count = 8,
  phrases = array['古怪', '大惊小怪']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"古怪": "teacher", "大惊小怪": "teacher"}'::jsonb
  where char_key = 'g2a::怪';

update public.chinese_char_entries set
  pinyin = 'zǒng', pinyin_alt = array[]::text[], radical = '心',
  radical_name = '心字底', structure = '上下', stroke_count = 9,
  phrases = array['总是', '林林总总']::text[], tiers = array['write']::text[], phrase_sources = '{"总是": "teacher", "林林总总": "teacher"}'::jsonb
  where char_key = 'g2a::总';

update public.chinese_char_entries set
  pinyin = 'xī', pinyin_alt = array[]::text[], radical = '自',
  radical_name = '自字头', structure = '上下', stroke_count = 10,
  phrases = array['息息相关', '消息']::text[], tiers = array['write']::text[], phrase_sources = '{"息息相关": "teacher", "消息": "teacher"}'::jsonb
  where char_key = 'g2a::息';

update public.chinese_char_entries set
  pinyin = 'nín', pinyin_alt = array[]::text[], radical = '心',
  radical_name = '心字底', structure = '上下', stroke_count = 11,
  phrases = array['您好', '您看', '您说']::text[], tiers = array['write']::text[], phrase_sources = '{"您好": "teacher", "您看": "teacher", "您说": "teacher"}'::jsonb
  where char_key = 'g2a::您';

update public.chinese_char_entries set
  pinyin = 'xiǎng', pinyin_alt = array[]::text[], radical = '心',
  radical_name = '心字底', structure = '上下', stroke_count = 13,
  phrases = array['想法', '胡思乱想']::text[], tiers = array['write']::text[], phrase_sources = '{"想法": "teacher", "胡思乱想": "teacher"}'::jsonb
  where char_key = 'g2a::想';

update public.chinese_char_entries set
  pinyin = 'xì', pinyin_alt = array[]::text[], radical = '又',
  radical_name = '又字旁', structure = '左右', stroke_count = 6,
  phrases = array['儿戏', '唱戏', '戏曲']::text[], tiers = array['write']::text[], phrase_sources = '{"儿戏": "teacher", "唱戏": "teacher", "戏曲": "teacher"}'::jsonb
  where char_key = 'g2a::戏';

update public.chinese_char_entries set
  pinyin = 'chéng', pinyin_alt = array[]::text[], radical = '戈',
  radical_name = '戈字旁', structure = '半包围', stroke_count = 6,
  phrases = array['成为', '成百上千']::text[], tiers = array['write']::text[], phrase_sources = '{"成为": "teacher", "成百上千": "teacher"}'::jsonb
  where char_key = 'g2a::成';

update public.chinese_char_entries set
  pinyin = 'zhàn', pinyin_alt = array[]::text[], radical = '戈',
  radical_name = '戈字旁', structure = '左右', stroke_count = 9,
  phrases = array['南征北战', '战士']::text[], tiers = array['write']::text[], phrase_sources = '{"南征北战": "teacher", "战士": "teacher"}'::jsonb
  where char_key = 'g2a::战';

update public.chinese_char_entries set
  pinyin = 'dài', pinyin_alt = array[]::text[], radical = '戈',
  radical_name = '戈字旁', structure = '半包围', stroke_count = 17,
  phrases = array['披星戴月', '爱戴']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"披星戴月": "teacher", "爱戴": "teacher"}'::jsonb
  where char_key = 'g2a::戴';

update public.chinese_char_entries set
  pinyin = 'chāo', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 7,
  phrases = array['抄书', '抄写', '摘抄']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"抄书": "teacher", "抄写": "teacher", "摘抄": "teacher"}'::jsonb
  where char_key = 'g2a::抄';

update public.chinese_char_entries set
  pinyin = 'zhuā', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 7,
  phrases = array['抓住', '抓耳挠腮']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"抓住": "teacher", "抓耳挠腮": "teacher"}'::jsonb
  where char_key = 'g2a::抓';

update public.chinese_char_entries set
  pinyin = 'hù', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 7,
  phrases = array['保驾护航', '呵护']::text[], tiers = array['write']::text[], phrase_sources = '{"保驾护航": "teacher", "呵护": "teacher"}'::jsonb
  where char_key = 'g2a::护';

update public.chinese_char_entries set
  pinyin = 'tái', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 8,
  phrases = array['抬头', '高抬贵手']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"抬头": "teacher", "高抬贵手": "teacher"}'::jsonb
  where char_key = 'g2a::抬';

update public.chinese_char_entries set
  pinyin = 'lā', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 8,
  phrases = array['东拉西扯', '拉面']::text[], tiers = array['write']::text[], phrase_sources = '{"东拉西扯": "teacher", "拉面": "teacher"}'::jsonb
  where char_key = 'g2a::拉';

update public.chinese_char_entries set
  pinyin = 'pāi', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 8,
  phrases = array['一拍即合', '拍手']::text[], tiers = array['write']::text[], phrase_sources = '{"一拍即合": "teacher", "拍手": "teacher"}'::jsonb
  where char_key = 'g2a::拍';

update public.chinese_char_entries set
  pinyin = 'ná', pinyin_alt = array[]::text[], radical = '人',
  radical_name = '单人旁', structure = '上下', stroke_count = 10,
  phrases = array['拿手好戏', '拿起']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"拿手好戏": "teacher", "拿起": "teacher"}'::jsonb
  where char_key = 'g2a::拿';

update public.chinese_char_entries set
  pinyin = 'guà', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 9,
  phrases = array['不足挂齿', '挂念']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"不足挂齿": "teacher", "挂念": "teacher"}'::jsonb
  where char_key = 'g2a::挂';

update public.chinese_char_entries set
  pinyin = 'jiē', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 11,
  phrases = array['再接再厉', '接住', '迎接']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"再接再厉": "teacher", "接住": "teacher"}'::jsonb
  where char_key = 'g2a::接';

update public.chinese_char_entries set
  pinyin = 'tí', pinyin_alt = array[]::text[], radical = '扌',
  radical_name = '提手旁', structure = '左右', stroke_count = 12,
  phrases = array['提心吊胆', '提手']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"提心吊胆": "teacher", "提手": "teacher"}'::jsonb
  where char_key = 'g2a::提';

update public.chinese_char_entries set
  pinyin = 'shōu', pinyin_alt = array[]::text[], radical = '攵',
  radical_name = '反文旁', structure = '左右', stroke_count = 6,
  phrases = array['回收', '美不胜收']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"回收": "teacher", "美不胜收": "teacher"}'::jsonb
  where char_key = 'g2a::收';

update public.chinese_char_entries set
  pinyin = 'dí', pinyin_alt = array[]::text[], radical = '舌',
  radical_name = '舌字旁', structure = '左右', stroke_count = 10,
  phrases = array['势均力敌', '敌人']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"势均力敌": "teacher", "敌人": "teacher"}'::jsonb
  where char_key = 'g2a::敌';

update public.chinese_char_entries set
  pinyin = 'sàn', pinyin_alt = array[]::text[], radical = '攵',
  radical_name = '反文旁', structure = '左右', stroke_count = 12,
  phrases = array['开枝散叶', '散步']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"开枝散叶": "teacher", "散步": "teacher"}'::jsonb
  where char_key = 'g2a::散';

update public.chinese_char_entries set
  pinyin = 'shù', pinyin_alt = array[]::text[], radical = '攵',
  radical_name = '反文旁', structure = '左右', stroke_count = 13,
  phrases = array['数一数二', '数学']::text[], tiers = array['write']::text[], phrase_sources = '{"数一数二": "teacher", "数学": "teacher"}'::jsonb
  where char_key = 'g2a::数';

update public.chinese_char_entries set
  pinyin = 'wǎn', pinyin_alt = array[]::text[], radical = '日',
  radical_name = '日字旁', structure = '左右', stroke_count = 11,
  phrases = array['早出晚归', '晚上']::text[], tiers = array['write']::text[], phrase_sources = '{"早出晚归": "teacher", "晚上": "teacher"}'::jsonb
  where char_key = 'g2a::晚';

update public.chinese_char_entries set
  pinyin = 'qǔ', pinyin_alt = array[]::text[], radical = '丨',
  radical_name = '竖', structure = '独体', stroke_count = 6,
  phrases = array['异曲同工', '歌曲']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"异曲同工": "teacher", "歌曲": "teacher"}'::jsonb
  where char_key = 'g2a::曲';

update public.chinese_char_entries set
  pinyin = 'gèng', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '独体', stroke_count = 7,
  phrases = array['更加', '更进一步']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"更加": "teacher", "更进一步": "teacher"}'::jsonb
  where char_key = 'g2a::更';

update public.chinese_char_entries set
  pinyin = 'péng', pinyin_alt = array[]::text[], radical = '月',
  radical_name = '月字旁', structure = '左右', stroke_count = 8,
  phrases = array['朋友', '高朋满座']::text[], tiers = array['write']::text[], phrase_sources = '{"朋友": "teacher", "高朋满座": "teacher"}'::jsonb
  where char_key = 'g2a::朋';

update public.chinese_char_entries set
  pinyin = 'cūn', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 7,
  phrases = array['千村万落', '村民']::text[], tiers = array['write']::text[], phrase_sources = '{"千村万落": "teacher", "村民": "teacher"}'::jsonb
  where char_key = 'g2a::村';

update public.chinese_char_entries set
  pinyin = 'tiáo', pinyin_alt = array[]::text[], radical = '夂',
  radical_name = '折文', structure = '上下', stroke_count = 7,
  phrases = array['井井有条', '面条']::text[], tiers = array['write']::text[], phrase_sources = '{"井井有条": "teacher", "面条": "teacher"}'::jsonb
  where char_key = 'g2a::条';

update public.chinese_char_entries set
  pinyin = 'yáng', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 7,
  phrases = array['杨树', '百步穿杨']::text[], tiers = array['write']::text[], phrase_sources = '{"杨树": "teacher", "百步穿杨": "teacher"}'::jsonb
  where char_key = 'g2a::杨';

update public.chinese_char_entries set
  pinyin = 'sōng', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 8,
  phrases = array['松手', '苍松翠柏']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"松手": "teacher", "苍松翠柏": "teacher"}'::jsonb
  where char_key = 'g2a::松';

update public.chinese_char_entries set
  pinyin = 'jí', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 7,
  phrases = array['北极', '登峰造极']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"北极": "teacher", "登峰造极": "teacher"}'::jsonb
  where char_key = 'g2a::极';

update public.chinese_char_entries set
  pinyin = 'zhī', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 8,
  phrases = array['枝干', '枝繁叶茂']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"枝干": "teacher", "枝繁叶茂": "teacher"}'::jsonb
  where char_key = 'g2a::枝';

update public.chinese_char_entries set
  pinyin = 'bǎi', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 9,
  phrases = array['松柏之志', '柏树']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"松柏之志": "teacher", "柏树": "teacher"}'::jsonb
  where char_key = 'g2a::柏';

update public.chinese_char_entries set
  pinyin = 'shù', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 9,
  phrases = array['树大根深', '树木']::text[], tiers = array['write']::text[], phrase_sources = '{"树大根深": "teacher", "树木": "teacher"}'::jsonb
  where char_key = 'g2a::树';

update public.chinese_char_entries set
  pinyin = 'guì', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 10,
  phrases = array['丹桂飘香', '桂花']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"丹桂飘香": "teacher", "桂花": "teacher"}'::jsonb
  where char_key = 'g2a::桂';

update public.chinese_char_entries set
  pinyin = 'kē', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 12,
  phrases = array['一棵草', '几棵']::text[], tiers = array['write']::text[], phrase_sources = '{"一棵草": "teacher", "几棵": "teacher"}'::jsonb
  where char_key = 'g2a::棵';

update public.chinese_char_entries set
  pinyin = 'yǐ', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 12,
  phrases = array['桌椅', '椅子', '椅背']::text[], tiers = array['write']::text[], phrase_sources = '{"桌椅": "teacher", "椅子": "teacher", "椅背": "teacher"}'::jsonb
  where char_key = 'g2a::椅';

update public.chinese_char_entries set
  pinyin = 'lóu', pinyin_alt = array[]::text[], radical = '木',
  radical_name = '木字旁', structure = '左右', stroke_count = 13,
  phrases = array['楼上', '高楼大厦']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"楼上": "teacher", "高楼大厦": "teacher"}'::jsonb
  where char_key = 'g2a::楼';

update public.chinese_char_entries set
  pinyin = 'cì', pinyin_alt = array[]::text[], radical = '丶',
  radical_name = '点', structure = '左右', stroke_count = 6,
  phrases = array['三番五次', '再次']::text[], tiers = array['write']::text[], phrase_sources = '{"三番五次": "teacher", "再次": "teacher"}'::jsonb
  where char_key = 'g2a::次';

update public.chinese_char_entries set
  pinyin = 'gē', pinyin_alt = array[]::text[], radical = '欠',
  radical_name = '欠字旁', structure = '左右', stroke_count = 14,
  phrases = array['唱歌', '能歌善舞']::text[], tiers = array['write']::text[], phrase_sources = '{"唱歌": "teacher", "能歌善舞": "teacher"}'::jsonb
  where char_key = 'g2a::歌';

update public.chinese_char_entries set
  pinyin = 'bù', pinyin_alt = array[]::text[], radical = '止',
  radical_name = '止字旁', structure = '上下', stroke_count = 7,
  phrases = array['平步青云', '步行']::text[], tiers = array['write']::text[], phrase_sources = '{"平步青云": "teacher", "步行": "teacher"}'::jsonb
  where char_key = 'g2a::步';

update public.chinese_char_entries set
  pinyin = 'měi', pinyin_alt = array[]::text[], radical = '母',
  radical_name = '母部', structure = '上下', stroke_count = 7,
  phrases = array['每况愈下', '每当']::text[], tiers = array['write']::text[], phrase_sources = '{"每况愈下": "teacher", "每当": "teacher"}'::jsonb
  where char_key = 'g2a::每';

update public.chinese_char_entries set
  pinyin = 'mín', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '独体', stroke_count = 5,
  phrases = array['人民', '国泰民安']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"人民": "teacher", "国泰民安": "teacher"}'::jsonb
  where char_key = 'g2a::民';

update public.chinese_char_entries set
  pinyin = 'hàn', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 5,
  phrases = array['汉语', '绿林好汉']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"汉语": "teacher", "绿林好汉": "teacher"}'::jsonb
  where char_key = 'g2a::汉';

update public.chinese_char_entries set
  pinyin = 'qì', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 7,
  phrases = array['冰镇汽水', '汽车']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"冰镇汽水": "teacher", "汽车": "teacher"}'::jsonb
  where char_key = 'g2a::汽';

update public.chinese_char_entries set
  pinyin = 'fǎ', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 8,
  phrases = array['书法', '想方设法']::text[], tiers = array['write']::text[], phrase_sources = '{"书法": "teacher", "想方设法": "teacher"}'::jsonb
  where char_key = 'g2a::法';

update public.chinese_char_entries set
  pinyin = 'ní', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 8,
  phrases = array['拖泥带水', '泥土']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"拖泥带水": "teacher", "泥土": "teacher"}'::jsonb
  where char_key = 'g2a::泥';

update public.chinese_char_entries set
  pinyin = 'yáng', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 9,
  phrases = array['洋洋自得', '海洋']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"洋洋自得": "teacher", "海洋": "teacher"}'::jsonb
  where char_key = 'g2a::洋';

update public.chinese_char_entries set
  pinyin = 'huó', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 9,
  phrases = array['快活', '活力', '活动', '生活', '生龙活虎']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"生活": "teacher", "生龙活虎": "teacher"}'::jsonb
  where char_key = 'g2a::活';

update public.chinese_char_entries set
  pinyin = 'hǎi', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 10,
  phrases = array['大海', '海阔天空']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"大海": "teacher", "海阔天空": "teacher"}'::jsonb
  where char_key = 'g2a::海';

update public.chinese_char_entries set
  pinyin = 'xiāo', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 10,
  phrases = array['消失', '烟消云散']::text[], tiers = array['write']::text[], phrase_sources = '{"消失": "teacher", "烟消云散": "teacher"}'::jsonb
  where char_key = 'g2a::消';

update public.chinese_char_entries set
  pinyin = 'yóu', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 12,
  phrases = array['游山玩水', '游戏']::text[], tiers = array['write']::text[], phrase_sources = '{"游山玩水": "teacher", "游戏": "teacher"}'::jsonb
  where char_key = 'g2a::游';

update public.chinese_char_entries set
  pinyin = 'hú', pinyin_alt = array[]::text[], radical = '氵',
  radical_name = '三点水', structure = '左右', stroke_count = 12,
  phrases = array['湖光山色', '湖面']::text[], tiers = array['write']::text[], phrase_sources = '{"湖光山色": "teacher", "湖面": "teacher"}'::jsonb
  where char_key = 'g2a::湖';

update public.chinese_char_entries set
  pinyin = 'miè', pinyin_alt = array[]::text[], radical = '一',
  radical_name = '一字旁', structure = '上下', stroke_count = 5,
  phrases = array['灭绝', '自生自灭']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"灭绝": "teacher", "自生自灭": "teacher"}'::jsonb
  where char_key = 'g2a::灭';

update public.chinese_char_entries set
  pinyin = 'lú', pinyin_alt = array[]::text[], radical = '火',
  radical_name = '火字旁', structure = '左右', stroke_count = 8,
  phrases = array['火炉', '炉火纯青']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"火炉": "teacher", "炉火纯青": "teacher"}'::jsonb
  where char_key = 'g2a::炉';

update public.chinese_char_entries set
  pinyin = 'chǎo', pinyin_alt = array[]::text[], radical = '火',
  radical_name = '火字旁', structure = '左右', stroke_count = 8,
  phrases = array['小炒', '炒菜', '炒面']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"小炒": "teacher", "炒菜": "teacher", "炒面": "teacher"}'::jsonb
  where char_key = 'g2a::炒';

update public.chinese_char_entries set
  pinyin = 'yān', pinyin_alt = array[]::text[], radical = '火',
  radical_name = '火字旁', structure = '左右', stroke_count = 10,
  phrases = array['烟云', '烟消云散', '烟花']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"烟消云散": "teacher", "烟花": "teacher"}'::jsonb
  where char_key = 'g2a::烟';

update public.chinese_char_entries set
  pinyin = 'zhào', pinyin_alt = array[]::text[], radical = '灬',
  radical_name = '四点底', structure = '上下', stroke_count = 13,
  phrases = array['照明', '阳光普照']::text[], tiers = array['write']::text[], phrase_sources = '{"照明": "teacher", "阳光普照": "teacher"}'::jsonb
  where char_key = 'g2a::照';

update public.chinese_char_entries set
  pinyin = 'ài', pinyin_alt = array[]::text[], radical = '爫',
  radical_name = '爪字头', structure = '上下', stroke_count = 10,
  phrases = array['可爱', '相亲', '相爱']::text[], tiers = array['write']::text[], phrase_sources = '{"可爱": "teacher", "相亲": "teacher", "相爱": "teacher"}'::jsonb
  where char_key = 'g2a::爱';

update public.chinese_char_entries set
  pinyin = 'yé', pinyin_alt = array[]::text[], radical = '父',
  radical_name = '父字头', structure = '上下', stroke_count = 6,
  phrases = array['太爷', '爷爷', '王爷']::text[], tiers = array['write']::text[], phrase_sources = '{"太爷": "teacher", "爷爷": "teacher", "王爷": "teacher"}'::jsonb
  where char_key = 'g2a::爷';

update public.chinese_char_entries set
  pinyin = 'zhuàng', pinyin_alt = array[]::text[], radical = '丬',
  radical_name = '将字旁', structure = '左右', stroke_count = 7,
  phrases = array['奇形怪状', '现状']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"奇形怪状": "teacher", "现状": "teacher"}'::jsonb
  where char_key = 'g2a::状';

update public.chinese_char_entries set
  pinyin = 'gǒu', pinyin_alt = array[]::text[], radical = '犭',
  radical_name = '反犬旁', structure = '左右', stroke_count = 8,
  phrases = array['小狗', '狗仗人势']::text[], tiers = array['write']::text[], phrase_sources = '{"小狗": "teacher", "狗仗人势": "teacher"}'::jsonb
  where char_key = 'g2a::狗';

update public.chinese_char_entries set
  pinyin = 'dú', pinyin_alt = array[]::text[], radical = '犭',
  radical_name = '反犬旁', structure = '左右', stroke_count = 9,
  phrases = array['孤独', '独来独往']::text[], tiers = array['write']::text[], phrase_sources = '{"孤独": "teacher", "独来独往": "teacher"}'::jsonb
  where char_key = 'g2a::独';

update public.chinese_char_entries set
  pinyin = 'láng', pinyin_alt = array[]::text[], radical = '犭',
  radical_name = '反犬旁', structure = '左右', stroke_count = 10,
  phrases = array['狼子野心', '狼牙']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"狼子野心": "teacher", "狼牙": "teacher"}'::jsonb
  where char_key = 'g2a::狼';

update public.chinese_char_entries set
  pinyin = 'māo', pinyin_alt = array[]::text[], radical = '犭',
  radical_name = '反犬旁', structure = '左右', stroke_count = 11,
  phrases = array['照猫画虎', '熊猫']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"照猫画虎": "teacher", "熊猫": "teacher"}'::jsonb
  where char_key = 'g2a::猫';

update public.chinese_char_entries set
  pinyin = 'huán', pinyin_alt = array[]::text[], radical = '王',
  radical_name = '王字旁', structure = '左右', stroke_count = 8,
  phrases = array['光环', '环环相扣']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"光环": "teacher", "环环相扣": "teacher"}'::jsonb
  where char_key = 'g2a::环';

update public.chinese_char_entries set
  pinyin = 'xiàn', pinyin_alt = array[]::text[], radical = '王',
  radical_name = '王字旁', structure = '左右', stroke_count = 8,
  phrases = array['活灵活现', '现在']::text[], tiers = array['write']::text[], phrase_sources = '{"活灵活现": "teacher", "现在": "teacher"}'::jsonb
  where char_key = 'g2a::现';

update public.chinese_char_entries set
  pinyin = 'lǐ', pinyin_alt = array[]::text[], radical = '王',
  radical_name = '王字旁', structure = '左右', stroke_count = 11,
  phrases = array['理由', '言之有理']::text[], tiers = array['write']::text[], phrase_sources = '{"理由": "teacher", "言之有理": "teacher"}'::jsonb
  where char_key = 'g2a::理';

update public.chinese_char_entries set
  pinyin = 'yóu', pinyin_alt = array[]::text[], radical = '丨',
  radical_name = '竖', structure = '独体', stroke_count = 5,
  phrases = array['不由自主', '由于']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"不由自主": "teacher", "由于": "teacher"}'::jsonb
  where char_key = 'g2a::由';

update public.chinese_char_entries set
  pinyin = 'jiè', pinyin_alt = array[]::text[], radical = '田',
  radical_name = '田字旁', structure = '上下', stroke_count = 9,
  phrases = array['花花世界', '边界']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"花花世界": "teacher", "边界": "teacher"}'::jsonb
  where char_key = 'g2a::界';

update public.chinese_char_entries set
  pinyin = 'zhí', pinyin_alt = array[]::text[], radical = '十',
  radical_name = '十字旁', structure = '上下', stroke_count = 8,
  phrases = array['一直', '心直口快']::text[], tiers = array['write']::text[], phrase_sources = '{"一直": "teacher", "心直口快": "teacher"}'::jsonb
  where char_key = 'g2a::直';

update public.chinese_char_entries set
  pinyin = 'duǎn', pinyin_alt = array[]::text[], radical = '矢',
  radical_name = '矢部', structure = '左右', stroke_count = 12,
  phrases = array['取长补短', '短小']::text[], tiers = array['write']::text[], phrase_sources = '{"取长补短": "teacher", "短小": "teacher"}'::jsonb
  where char_key = 'g2a::短';

update public.chinese_char_entries set
  pinyin = 'qiū', pinyin_alt = array[]::text[], radical = '禾',
  radical_name = '禾木旁', structure = '左右', stroke_count = 9,
  phrases = array['一叶知秋', '秋千']::text[], tiers = array['write']::text[], phrase_sources = '{"一叶知秋": "teacher", "秋千": "teacher"}'::jsonb
  where char_key = 'g2a::秋';

update public.chinese_char_entries set
  pinyin = 'zhǒng', pinyin_alt = array['zhòng']::text[], radical = '禾',
  radical_name = '禾木旁', structure = '左右', stroke_count = 9,
  phrases = array['刀耕火种', '播种', '种田']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"刀耕火种": "teacher", "种田": "teacher"}'::jsonb
  where char_key = 'g2a::种';

update public.chinese_char_entries set
  pinyin = 'kē', pinyin_alt = array[]::text[], radical = '禾',
  radical_name = '禾木旁', structure = '左右', stroke_count = 9,
  phrases = array['五子登科', '科学']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"五子登科": "teacher", "科学": "teacher"}'::jsonb
  where char_key = 'g2a::科';

update public.chinese_char_entries set
  pinyin = 'qióng', pinyin_alt = array[]::text[], radical = '穴',
  radical_name = '穴宝盖', structure = '上下', stroke_count = 7,
  phrases = array['人穷志短', '穷尽', '贫穷']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"人穷志短": "teacher", "贫穷": "teacher"}'::jsonb
  where char_key = 'g2a::穷';

update public.chinese_char_entries set
  pinyin = 'chuān', pinyin_alt = array[]::text[], radical = '穴',
  radical_name = '穴宝盖', structure = '上下', stroke_count = 9,
  phrases = array['滴水石穿', '穿衣']::text[], tiers = array['write']::text[], phrase_sources = '{"滴水石穿": "teacher", "穿衣": "teacher"}'::jsonb
  where char_key = 'g2a::穿';

update public.chinese_char_entries set
  pinyin = 'dì', pinyin_alt = array[]::text[], radical = '⺮',
  radical_name = '竹字头', structure = '上下', stroke_count = 11,
  phrases = array['书香门第', '第一']::text[], tiers = array['write']::text[], phrase_sources = '{"书香门第": "teacher", "第一": "teacher"}'::jsonb
  where char_key = 'g2a::第';

update public.chinese_char_entries set
  pinyin = 'dá', pinyin_alt = array[]::text[], radical = '⺮',
  radical_name = '竹字头', structure = '上下', stroke_count = 12,
  phrases = array['答非所问', '问答']::text[], tiers = array['write']::text[], phrase_sources = '{"答非所问": "teacher", "问答": "teacher"}'::jsonb
  where char_key = 'g2a::答';

update public.chinese_char_entries set
  pinyin = 'zhǐ', pinyin_alt = array[]::text[], radical = '纟',
  radical_name = '绞丝旁', structure = '左右', stroke_count = 7,
  phrases = array['白纸', '纸上谈兵']::text[], tiers = array['write']::text[], phrase_sources = '{"白纸": "teacher", "纸上谈兵": "teacher"}'::jsonb
  where char_key = 'g2a::纸';

update public.chinese_char_entries set
  pinyin = 'xiàn', pinyin_alt = array[]::text[], radical = '纟',
  radical_name = '绞丝旁', structure = '左右', stroke_count = 8,
  phrases = array['毛线', '穿针引线']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"毛线": "teacher", "穿针引线": "teacher"}'::jsonb
  where char_key = 'g2a::线';

update public.chinese_char_entries set
  pinyin = 'jīng', pinyin_alt = array[]::text[], radical = '纟',
  radical_name = '绞丝旁', structure = '左右', stroke_count = 8,
  phrases = array['漫不经心', '经过']::text[], tiers = array['write']::text[], phrase_sources = '{"漫不经心": "teacher", "经过": "teacher"}'::jsonb
  where char_key = 'g2a::经';

update public.chinese_char_entries set
  pinyin = 'gěi', pinyin_alt = array[]::text[], radical = '纟',
  radical_name = '绞丝旁', structure = '左右', stroke_count = 9,
  phrases = array['带给', '让给', '送给']::text[], tiers = array['write']::text[], phrase_sources = '{"带给": "teacher", "让给": "teacher", "送给": "teacher"}'::jsonb
  where char_key = 'g2a::给';

update public.chinese_char_entries set
  pinyin = 'jué', pinyin_alt = array[]::text[], radical = '纟',
  radical_name = '绞丝旁', structure = '左右', stroke_count = 9,
  phrases = array['绝对', '绝无仅有']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"绝对": "teacher", "绝无仅有": "teacher"}'::jsonb
  where char_key = 'g2a::绝';

update public.chinese_char_entries set
  pinyin = 'qún', pinyin_alt = array[]::text[], radical = '羊',
  radical_name = '羊字旁', structure = '左右', stroke_count = 13,
  phrases = array['三五成群', '羊群']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"三五成群": "teacher", "羊群": "teacher"}'::jsonb
  where char_key = 'g2a::群';

update public.chinese_char_entries set
  pinyin = 'dù', pinyin_alt = array[]::text[], radical = '月',
  radical_name = '月字旁', structure = '左右', stroke_count = 7,
  phrases = array['小肚鸡肠', '肚子']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"小肚鸡肠": "teacher", "肚子": "teacher"}'::jsonb
  where char_key = 'g2a::肚';

update public.chinese_char_entries set
  pinyin = 'féi', pinyin_alt = array[]::text[], radical = '月',
  radical_name = '月字旁', structure = '左右', stroke_count = 8,
  phrases = array['肥头大耳', '肥胖']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"肥头大耳": "teacher", "肥胖": "teacher"}'::jsonb
  where char_key = 'g2a::肥';

update public.chinese_char_entries set
  pinyin = 'dǎn', pinyin_alt = array[]::text[], radical = '月',
  radical_name = '月字旁', structure = '左右', stroke_count = 9,
  phrases = array['提心吊胆', '胆子']::text[], tiers = array['write']::text[], phrase_sources = '{"提心吊胆": "teacher", "胆子": "teacher"}'::jsonb
  where char_key = 'g2a::胆';

update public.chinese_char_entries set
  pinyin = 'shèng', pinyin_alt = array[]::text[], radical = '月',
  radical_name = '月字旁', structure = '左右', stroke_count = 9,
  phrases = array['引人入胜', '胜利']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"引人入胜": "teacher", "胜利": "teacher"}'::jsonb
  where char_key = 'g2a::胜';

update public.chinese_char_entries set
  pinyin = 'néng', pinyin_alt = array[]::text[], radical = '厶',
  radical_name = '私字儿', structure = '左右', stroke_count = 10,
  phrases = array['可能', '能言善辩']::text[], tiers = array['write']::text[], phrase_sources = '{"可能": "teacher", "能言善辩": "teacher"}'::jsonb
  where char_key = 'g2a::能';

update public.chinese_char_entries set
  pinyin = 'zhōu', pinyin_alt = array[]::text[], radical = '舟',
  radical_name = '舟字旁', structure = '独体', stroke_count = 6,
  phrases = array['刻舟求剑', '小舟']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"刻舟求剑": "teacher", "小舟": "teacher"}'::jsonb
  where char_key = 'g2a::舟';

update public.chinese_char_entries set
  pinyin = 'chuán', pinyin_alt = array[]::text[], radical = '舟',
  radical_name = '舟字旁', structure = '左右', stroke_count = 11,
  phrases = array['船只', '草船借箭']::text[], tiers = array['write']::text[], phrase_sources = '{"船只": "teacher", "草船借箭": "teacher"}'::jsonb
  where char_key = 'g2a::船';

update public.chinese_char_entries set
  pinyin = 'kǔ', pinyin_alt = array[]::text[], radical = '艹',
  radical_name = '草字头', structure = '上下', stroke_count = 8,
  phrases = array['苦尽甘来', '苦瓜']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"苦尽甘来": "teacher", "苦瓜": "teacher"}'::jsonb
  where char_key = 'g2a::苦';

update public.chinese_char_entries set
  pinyin = 'suī', pinyin_alt = array[]::text[], radical = '口',
  radical_name = '口字旁', structure = '上下', stroke_count = 9,
  phrases = array['虽然', '虽败犹荣']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"虽然": "teacher", "虽败犹荣": "teacher"}'::jsonb
  where char_key = 'g2a::虽';

update public.chinese_char_entries set
  pinyin = 'shé', pinyin_alt = array[]::text[], radical = '虫',
  radical_name = '虫字旁', structure = '左右', stroke_count = 11,
  phrases = array['毒蛇', '虎头蛇尾']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"毒蛇": "teacher", "虎头蛇尾": "teacher"}'::jsonb
  where char_key = 'g2a::蛇';

update public.chinese_char_entries set
  pinyin = 'bèi', pinyin_alt = array[]::text[], radical = '衤',
  radical_name = '衣字旁', structure = '左右', stroke_count = 10,
  phrases = array['被动', '被捕', '被迫']::text[], tiers = array['write']::text[], phrase_sources = '{"被动": "teacher", "被捕": "teacher", "被迫": "teacher"}'::jsonb
  where char_key = 'g2a::被';

update public.chinese_char_entries set
  pinyin = 'kù', pinyin_alt = array[]::text[], radical = '衤',
  radical_name = '衣字旁', structure = '左右', stroke_count = 12,
  phrases = array['衣裤', '裤子', '裤带']::text[], tiers = array['write']::text[], phrase_sources = '{"衣裤": "teacher", "裤子": "teacher", "裤带": "teacher"}'::jsonb
  where char_key = 'g2a::裤';

update public.chinese_char_entries set
  pinyin = 'yào', pinyin_alt = array[]::text[], radical = '西',
  radical_name = '西字旁', structure = '上下', stroke_count = 9,
  phrases = array['不要', '无关紧要']::text[], tiers = array['write']::text[], phrase_sources = '{"不要": "teacher", "无关紧要": "teacher"}'::jsonb
  where char_key = 'g2a::要';

update public.chinese_char_entries set
  pinyin = 'guān', pinyin_alt = array[]::text[], radical = '又',
  radical_name = '又字旁', structure = '左右', stroke_count = 6,
  phrases = array['坐井观天', '观看']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"坐井观天": "teacher", "观看": "teacher"}'::jsonb
  where char_key = 'g2a::观';

update public.chinese_char_entries set
  pinyin = 'shì', pinyin_alt = array[]::text[], radical = '礻',
  radical_name = '示字旁', structure = '左右', stroke_count = 8,
  phrases = array['电视', '视而不见']::text[], tiers = array['write']::text[], phrase_sources = '{"电视": "teacher", "视而不见": "teacher"}'::jsonb
  where char_key = 'g2a::视';

update public.chinese_char_entries set
  pinyin = 'xǔ', pinyin_alt = array[]::text[], radical = '讠',
  radical_name = '言字旁', structure = '左右', stroke_count = 6,
  phrases = array['许久', '许许多多']::text[], tiers = array['write']::text[], phrase_sources = '{"许久": "teacher", "许许多多": "teacher"}'::jsonb
  where char_key = 'g2a::许';

update public.chinese_char_entries set
  pinyin = 'lùn', pinyin_alt = array[]::text[], radical = '讠',
  radical_name = '言字旁', structure = '左右', stroke_count = 6,
  phrases = array['无论', '相提并论']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"无论": "teacher", "相提并论": "teacher"}'::jsonb
  where char_key = 'g2a::论';

update public.chinese_char_entries set
  pinyin = 'shí', pinyin_alt = array[]::text[], radical = '讠',
  radical_name = '言字旁', structure = '左右', stroke_count = 7,
  phrases = array['知识', '见多识广']::text[], tiers = array['write']::text[], phrase_sources = '{"知识": "teacher", "见多识广": "teacher"}'::jsonb
  where char_key = 'g2a::识';

update public.chinese_char_entries set
  pinyin = 'sù', pinyin_alt = array[]::text[], radical = '讠',
  radical_name = '言字旁', structure = '左右', stroke_count = 7,
  phrases = array['告诉', '如泣如诉']::text[], tiers = array['write']::text[], phrase_sources = '{"告诉": "teacher", "如泣如诉": "teacher"}'::jsonb
  where char_key = 'g2a::诉';

update public.chinese_char_entries set
  pinyin = 'chéng', pinyin_alt = array[]::text[], radical = '讠',
  radical_name = '言字旁', structure = '左右', stroke_count = 8,
  phrases = array['真诚', '诚实守信']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"真诚": "teacher", "诚实守信": "teacher"}'::jsonb
  where char_key = 'g2a::诚';

update public.chinese_char_entries set
  pinyin = 'huà', pinyin_alt = array[]::text[], radical = '讠',
  radical_name = '言字旁', structure = '左右', stroke_count = 8,
  phrases = array['话语', '长话短说']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"话语": "teacher", "长话短说": "teacher"}'::jsonb
  where char_key = 'g2a::话';

update public.chinese_char_entries set
  pinyin = 'gāi', pinyin_alt = array[]::text[], radical = '讠',
  radical_name = '言字旁', structure = '左右', stroke_count = 8,
  phrases = array['应该', '该当何罪']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"应该": "teacher", "该当何罪": "teacher"}'::jsonb
  where char_key = 'g2a::该';

update public.chinese_char_entries set
  pinyin = 'shuí', pinyin_alt = array[]::text[], radical = '讠',
  radical_name = '言字旁', structure = '左右', stroke_count = 10,
  phrases = array['舍我其谁', '谁的']::text[], tiers = array['write']::text[], phrase_sources = '{"舍我其谁": "teacher", "谁的": "teacher"}'::jsonb
  where char_key = 'g2a::谁';

update public.chinese_char_entries set
  pinyin = 'gǔ', pinyin_alt = array[]::text[], radical = '谷',
  radical_name = '谷字旁', structure = '上下', stroke_count = 7,
  phrases = array['五谷丰登', '山谷', '打谷']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"五谷丰登": "teacher", "山谷": "teacher"}'::jsonb
  where char_key = 'g2a::谷';

update public.chinese_char_entries set
  pinyin = 'huò', pinyin_alt = array[]::text[], radical = '贝',
  radical_name = '贝字旁', structure = '上下', stroke_count = 8,
  phrases = array['货真价实', '货船']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"货真价实": "teacher", "货船": "teacher"}'::jsonb
  where char_key = 'g2a::货';

update public.chinese_char_entries set
  pinyin = 'qǐ', pinyin_alt = array[]::text[], radical = '走',
  radical_name = '走字旁', structure = '半包围', stroke_count = 10,
  phrases = array['一起', '东山再起']::text[], tiers = array['write']::text[], phrase_sources = '{"一起": "teacher", "东山再起": "teacher"}'::jsonb
  where char_key = 'g2a::起';

update public.chinese_char_entries set
  pinyin = 'lù', pinyin_alt = array[]::text[], radical = '足',
  radical_name = '足字旁', structure = '左右', stroke_count = 13,
  phrases = array['走投无路', '路口']::text[], tiers = array['write']::text[], phrase_sources = '{"走投无路": "teacher", "路口": "teacher"}'::jsonb
  where char_key = 'g2a::路';

update public.chinese_char_entries set
  pinyin = 'tiào', pinyin_alt = array[]::text[], radical = '足',
  radical_name = '足字旁', structure = '左右', stroke_count = 13,
  phrases = array['心跳', '跳远', '跳高']::text[], tiers = array['write']::text[], phrase_sources = '{"心跳": "teacher", "跳远": "teacher", "跳高": "teacher"}'::jsonb
  where char_key = 'g2a::跳';

update public.chinese_char_entries set
  pinyin = 'qīng', pinyin_alt = array[]::text[], radical = '车',
  radical_name = '车字旁', structure = '左右', stroke_count = 9,
  phrases = array['轻松', '轻而易举']::text[], tiers = array['write']::text[], phrase_sources = '{"轻松": "teacher", "轻而易举": "teacher"}'::jsonb
  where char_key = 'g2a::轻';

update public.chinese_char_entries set
  pinyin = 'xīn', pinyin_alt = array[]::text[], radical = '辛',
  radical_name = '辛字旁', structure = '上下', stroke_count = 7,
  phrases = array['千辛万苦', '辛劳']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"千辛万苦": "teacher", "辛劳": "teacher"}'::jsonb
  where char_key = 'g2a::辛';

update public.chinese_char_entries set
  pinyin = 'lián', pinyin_alt = array[]::text[], radical = '辶',
  radical_name = '走之底', structure = '半包围', stroke_count = 7,
  phrases = array['连忙', '连成一片']::text[], tiers = array['write']::text[], phrase_sources = '{"连忙": "teacher", "连成一片": "teacher"}'::jsonb
  where char_key = 'g2a::连';

update public.chinese_char_entries set
  pinyin = 'sòng', pinyin_alt = array[]::text[], radical = '辶',
  radical_name = '走之底', structure = '半包围', stroke_count = 9,
  phrases = array['送给', '雪中送炭']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"送给": "teacher", "雪中送炭": "teacher"}'::jsonb
  where char_key = 'g2a::送';

update public.chinese_char_entries set
  pinyin = 'nà', pinyin_alt = array[]::text[], radical = '阝',
  radical_name = '耳刀旁', structure = '左右', stroke_count = 6,
  phrases = array['那么', '那时', '那边']::text[], tiers = array['write']::text[], phrase_sources = '{"那么": "teacher", "那时": "teacher", "那边": "teacher"}'::jsonb
  where char_key = 'g2a::那';

update public.chinese_char_entries set
  pinyin = 'lín', pinyin_alt = array[]::text[], radical = '阝',
  radical_name = '耳刀旁', structure = '左右', stroke_count = 7,
  phrases = array['左邻右舍', '邻居']::text[], tiers = array['write']::text[], phrase_sources = '{"左邻右舍": "teacher", "邻居": "teacher"}'::jsonb
  where char_key = 'g2a::邻';

update public.chinese_char_entries set
  pinyin = 'yě', pinyin_alt = array[]::text[], radical = '里',
  radical_name = '里字旁', structure = '左右', stroke_count = 11,
  phrases = array['田野', '野心勃勃']::text[], tiers = array['write']::text[], phrase_sources = '{"田野": "teacher", "野心勃勃": "teacher"}'::jsonb
  where char_key = 'g2a::野';

update public.chinese_char_entries set
  pinyin = 'jīn', pinyin_alt = array[]::text[], radical = '金',
  radical_name = '金字旁', structure = '上下', stroke_count = 8,
  phrases = array['拾金不昧', '金色']::text[], tiers = array['write']::text[], phrase_sources = '{"拾金不昧": "teacher", "金色": "teacher"}'::jsonb
  where char_key = 'g2a::金';

update public.chinese_char_entries set
  pinyin = 'dìng', pinyin_alt = array[]::text[], radical = '钅',
  radical_name = '金字旁', structure = '左右', stroke_count = 7,
  phrases = array['板上钉钉', '钉牢']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"板上钉钉": "teacher", "钉牢": "teacher"}'::jsonb
  where char_key = 'g2a::钉';

update public.chinese_char_entries set
  pinyin = 'tiě', pinyin_alt = array[]::text[], radical = '钅',
  radical_name = '金字旁', structure = '左右', stroke_count = 10,
  phrases = array['铁丝', '铁面无私']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"铁丝": "teacher", "铁面无私": "teacher"}'::jsonb
  where char_key = 'g2a::铁';

update public.chinese_char_entries set
  pinyin = 'yín', pinyin_alt = array[]::text[], radical = '钅',
  radical_name = '金字旁', structure = '左右', stroke_count = 11,
  phrases = array['火树银花', '银发']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"火树银花": "teacher", "银发": "teacher"}'::jsonb
  where char_key = 'g2a::银';

update public.chinese_char_entries set
  pinyin = 'shǎn', pinyin_alt = array[]::text[], radical = '门',
  radical_name = '门字旁', structure = '半包围', stroke_count = 5,
  phrases = array['金光闪闪', '闪电']::text[], tiers = array['write']::text[], phrase_sources = '{"金光闪闪": "teacher", "闪电": "teacher"}'::jsonb
  where char_key = 'g2a::闪';

update public.chinese_char_entries set
  pinyin = 'bì', pinyin_alt = array[]::text[], radical = '门',
  radical_name = '门字旁', structure = '半包围', stroke_count = 6,
  phrases = array['关闭', '闭门造车']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"关闭": "teacher", "闭门造车": "teacher"}'::jsonb
  where char_key = 'g2a::闭';

update public.chinese_char_entries set
  pinyin = 'duì', pinyin_alt = array[]::text[], radical = '阝',
  radical_name = '耳刀旁', structure = '左右', stroke_count = 4,
  phrases = array['成群结队', '队员']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"成群结队": "teacher", "队员": "teacher"}'::jsonb
  where char_key = 'g2a::队';

update public.chinese_char_entries set
  pinyin = 'yīn', pinyin_alt = array[]::text[], radical = '阝',
  radical_name = '耳刀旁', structure = '左右', stroke_count = 6,
  phrases = array['阴山', '阴差阳错']::text[], tiers = array['write']::text[], phrase_sources = '{"阴山": "teacher", "阴差阳错": "teacher"}'::jsonb
  where char_key = 'g2a::阴';

update public.chinese_char_entries set
  pinyin = 'zhèn', pinyin_alt = array[]::text[], radical = '阝',
  radical_name = '耳刀旁', structure = '左右', stroke_count = 6,
  phrases = array['轻装上阵', '阵雨']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"轻装上阵": "teacher", "阵雨": "teacher"}'::jsonb
  where char_key = 'g2a::阵';

update public.chinese_char_entries set
  pinyin = 'nán', pinyin_alt = array[]::text[], radical = '又',
  radical_name = '又字旁', structure = '左右', stroke_count = 10,
  phrases = array['一言难尽', '难过']::text[], tiers = array['write']::text[], phrase_sources = '{"一言难尽": "teacher", "难过": "teacher"}'::jsonb
  where char_key = 'g2a::难';

update public.chinese_char_entries set
  pinyin = 'fēi', pinyin_alt = array[]::text[], radical = '非',
  radical_name = '非字旁', structure = '左右', stroke_count = 8,
  phrases = array['是非', '非同小可']::text[], tiers = array['write']::text[], phrase_sources = '{"是非": "teacher", "非同小可": "teacher"}'::jsonb
  where char_key = 'g2a::非';

update public.chinese_char_entries set
  pinyin = 'dǐng', pinyin_alt = array[]::text[], radical = '页',
  radical_name = '页字旁', structure = '左右', stroke_count = 8,
  phrases = array['山顶', '顶天立地']::text[], tiers = array['write']::text[], phrase_sources = '{"山顶": "teacher", "顶天立地": "teacher"}'::jsonb
  where char_key = 'g2a::顶';

update public.chinese_char_entries set
  pinyin = 'lǐng', pinyin_alt = array[]::text[], radical = '页',
  radical_name = '页字旁', structure = '左右', stroke_count = 11,
  phrases = array['心领神会', '领带']::text[], tiers = array['write']::text[], phrase_sources = '{"心领神会": "teacher", "领带": "teacher"}'::jsonb
  where char_key = 'g2a::领';

update public.chinese_char_entries set
  pinyin = 'jī', pinyin_alt = array[]::text[], radical = '饣',
  radical_name = '食字旁', structure = '左右', stroke_count = 5,
  phrases = array['饥寒交迫', '饥饿']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"饥寒交迫": "teacher", "饥饿": "teacher"}'::jsonb
  where char_key = 'g2a::饥';

update public.chinese_char_entries set
  pinyin = 'è', pinyin_alt = array[]::text[], radical = '饣',
  radical_name = '食字旁', structure = '左右', stroke_count = 10,
  phrases = array['忍饥挨饿', '饥饿']::text[], tiers = array['recognize', 'write']::text[], phrase_sources = '{"忍饥挨饿": "teacher", "饥饿": "teacher"}'::jsonb
  where char_key = 'g2a::饿';

update public.chinese_char_entries set
  pinyin = 'xiāng', pinyin_alt = array[]::text[], radical = '香',
  radical_name = '香字旁', structure = '上下', stroke_count = 9,
  phrases = array['香味', '鸟语花香']::text[], tiers = array['write']::text[], phrase_sources = '{"香味": "teacher", "鸟语花香": "teacher"}'::jsonb
  where char_key = 'g2a::香';

update public.chinese_lesson_chars set pinyin_in_lesson = 'dìng'
  where lesson_key = 'g2a::u4-l10' and char_key = 'g2a::钉' and track = 'write' and pinyin_in_lesson = 'dīng';

update public.chinese_lesson_chars set pinyin_in_lesson = 'jìn'
  where lesson_key = 'g2a::u4-l7' and char_key = 'g2a::尽' and track = 'write' and pinyin_in_lesson = 'jǐn';

update public.chinese_lesson_chars set pinyin_in_lesson = 'zhòng'
  where lesson_key = 'g2a::u5-l13' and char_key = 'g2a::种' and track = 'write' and pinyin_in_lesson = 'zhǒng';

update public.chinese_lesson_chars set pinyin_in_lesson = 'sì'
  where lesson_key = 'g2a::u7-l18' and char_key = 'g2a::似' and track = 'write' and pinyin_in_lesson = 'shì';

update public.chinese_lesson_chars set pinyin_in_lesson = 'de'
  where lesson_key = 'g2a::u7-l20' and char_key = 'g2a::得' and track = 'write' and pinyin_in_lesson = 'dé';

update public.chinese_lesson_chars set pinyin_in_lesson = 'zǐ'
  where lesson_key = 'g2a::u8-l21' and char_key = 'g2a::仔' and track = 'write' and pinyin_in_lesson = 'zǎi';

update public.chinese_lesson_chars set pinyin_in_lesson = 'jìn'
  where lesson_key = 'g2a::u4-l7' and char_key = 'g2a::尽' and track = 'recognize' and pinyin_in_lesson = 'jǐn';

update public.chinese_lesson_chars set pinyin_in_lesson = 'dìng'
  where lesson_key = 'g2a::u4-l10' and char_key = 'g2a::钉' and track = 'recognize' and pinyin_in_lesson = 'dīng';

update public.chinese_lesson_chars set pinyin_in_lesson = 'sì'
  where lesson_key = 'g2a::u7-l18' and char_key = 'g2a::似' and track = 'recognize' and pinyin_in_lesson = 'shì';

-- 校验：248 字已打标 · 9 处课字拼音已修正
select
  (select count(*) from public.chinese_char_entries
    where char_key like 'g2a::%' and phrase_sources <> '{}'::jsonb) as tagged_chars,
  (select count(*) from public.chinese_lesson_chars
    where lesson_key like 'g2a::%' and pinyin_in_lesson in
      ('jìn', 'dìng', 'zhòng', 'sì', 'de', 'zǐ')
      and char_key in ('g2a::尽', 'g2a::钉', 'g2a::种', 'g2a::似', 'g2a::得', 'g2a::仔')) as fixed_lc;
