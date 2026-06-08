# 自然拼读（Phonics）音节划分与标注规则文档

## 一、颜色标注体系

| 类别 | 英文名 | 标注颜色 | 色值 |
|------|--------|----------|------|
| 短元音 | Short Vowels | 红色 | `#FF6B6B` |
| 长元音 | Long Vowels | 橙色 | `#FF8C00` |
| 元音组合 | Vowel Teams | 青色 | `#00CED1` |
| 辅音组合 | Consonant Digraphs | 黄色 | `#FFD700` |
| 辅音丛 | Consonant Clusters | 蓝色 | `#4169E1` |
| R控元音 | R-Controlled Vowels | 紫色 | `#9370DB` |
| 魔力E | Magic-E (VCe) | 金色 | `#DAA520` |
| 特殊后缀 | Special Suffixes | 绿色 | `#32CD32` |
| 静音字母 | Silent Letters | 无色 | `#888888` |
| 普通辅音 | Regular Consonants | 无色 | — |

---

## 二、标注优先级（冲突时按此顺序判断）

```
R控元音 > 元音组合 > 魔力E > 特殊后缀 > 辅音组合 > 辅音丛 > 短元音/长元音 > 静音字母
```

**示例**：
- `delicious` → `de`（开音节长e）+ `li`（开音节长i）+ `cious`（特殊后缀整体绿色）
- `night` → `n`（普通辅音）+ `igh`（元音组合青色）+ `t`（普通辅音）
- `bird` → `b`（普通辅音）+ `ir`（R控元音紫色）+ `d`（普通辅音）
- `cake` → `c`（普通辅音）+ `a`（长元音橙色）+ `k`（普通辅音）+ `e`（魔力E金色）

---

## 三、各类规则详解

---

### 1. 短元音（Short Vowels）— 红色 `#FF6B6B`

单个元音字母在**闭音节**（后接辅音，无魔力E）中发短促音。

| 字母 | 音标 | 典型例词 |
|------|------|---------|
| a | /æ/ | cat, map, bag, hand, lamp |
| e | /ɛ/ | bed, net, pet, web, best |
| i | /ɪ/ | sit, tip, bin, fish, wish |
| o | /ɒ/ | hot, log, box, frog, stop |
| u | /ʌ/ | cup, bug, sun, jump, drum |

**判断条件**：元音字母 + 辅音结尾（无魔力E，无元音组合，无R控）

---

### 2. 长元音（Long Vowels）— 橙色 `#FF8C00`

元音在**开音节**中发该字母的名称音（"说自己的名字"）。

| 字母 | 音标 | 典型例词 |
|------|------|---------|
| a | /eɪ/ | baby, lady, paper |
| e | /iː/ | he, she, me, be, we |
| i | /aɪ/ | hi, pilot, tiger |
| o | /oʊ/ | go, so, no, open, robot |
| u | /juː/ | music, unit, human |

**判断条件**：元音字母后无辅音（音节末尾），或音节结构为 CV（辅音+元音结尾）

> 注意：魔力E结构中被"拉长"的元音标**橙色**，末尾e单独标**金色**

---

### 3. 元音组合（Vowel Teams）— 青色 `#00CED1`

两个或多个字母组合，共同发出**一个元音音素**，整体标青色。

#### 3.1 长元音组合

| 组合 | 音标 | 例词 | 备注 |
|------|------|------|------|
| ai | /eɪ/ | rain, tail, wait, mail | 通常在词中 |
| ay | /eɪ/ | day, play, say, way | 通常在词尾 |
| ee | /iː/ | feet, tree, see, keep | |
| ea | /iː/ | meat, read, sea, teach | 异读：/ɛ/ bread, head |
| oa | /oʊ/ | boat, road, coat, soap | |
| oe | /oʊ/ | toe, doe, foe, hoe | |
| ie | /aɪ/ | pie, tie, lie, die | 异读：/iː/ field, chief |
| igh | /aɪ/ | night, light, fight, right | gh为静音 |
| ue | /juː/ | blue, clue, true, glue | |
| ew | /juː/ | new, few, dew, flew | 异读：/uː/ blew, chew |
| ui | /uː/ | fruit, juice, suit, bruise | |
| ei | /eɪ/ | vein, rein, beige | 异读：/iː/ receive |
| eigh | /eɪ/ | eight, weight, freight, neigh | |
| eu | /juː/ | feud, neuter, neutral | |

#### 3.2 双元音（二合元音）

| 组合 | 音标 | 例词 | 备注 |
|------|------|------|------|
| oi | /ɔɪ/ | oil, coin, join, foil | 通常在词中 |
| oy | /ɔɪ/ | boy, toy, joy, enjoy | 通常在词尾 |
| ou | /aʊ/ | out, loud, mouth, count | 异读：/oʊ/ soul；/uː/ you；/ʌ/ country |
| ow | /aʊ/ | cow, now, town, how | 异读：/oʊ/ snow, flow, own |

#### 3.3 oo 组合

| 组合 | 音标 | 例词 | 建议标注 |
|------|------|------|---------|
| oo（长） | /uː/ | moon, food, boot, cool, zoo | 青色 `#00CED1` |
| oo（短） | /ʊ/ | book, foot, look, cook, good | 深青 `#008B8B` 或加下划线 |

#### 3.4 受控元音组合

| 组合 | 音标 | 例词 |
|------|------|------|
| au | /ɔː/ | August, pause, cause, haunt |
| aw | /ɔː/ | saw, draw, claw, lawn |

---

### 4. R控元音（R-Controlled Vowels）— 紫色 `#9370DB`

元音字母 + r，整体标紫色。

| 组合 | 音标 | 例词 |
|------|------|------|
| ar | /ɑːr/ | car, star, farm, yard, cart |
| or | /ɔːr/ | for, corn, born, sport, fork |
| er | /ɜːr/ | her, fern, verb, serve, stern |
| ir | /ɜːr/ | bird, sir, girl, first, shirt |
| ur | /ɜːr/ | fur, burn, turn, hurt, purse |
| air | /eər/ | hair, fair, pair, chair, stair |
| ear（读法1） | /ɪər/ | ear, dear, fear, hear, near |
| ear（读法2） | /ɜːr/ | earth, early, learn, heard |
| ear（读法3） | /eər/ | bear, wear, pear |
| oar | /ɔːr/ | oar, board, roar |
| oor | /ʊər/ | poor, moor, floor |
| are | /eər/ | care, share, bare, dare |
| ore | /ɔːr/ | more, store, before, score |
| ire | /aɪər/ | fire, hire, tire, wire |
| ure | /jʊər/ | pure, cure, sure |

---

### 5. 魔力E（Magic-E / VCe）— 金色 `#DAA520`

结构：**元音（橙色）+ 辅音（无色）+ 词尾不发音e（金色）**

| 模式 | 元音音标 | 例词 |
|------|---------|------|
| a_e | /eɪ/ | cake, name, date, game, lake |
| e_e | /iː/ | here, theme, these, eve |
| i_e | /aɪ/ | bike, time, side, like, rice |
| o_e | /oʊ/ | hope, note, home, rose, bone |
| u_e | /juː/ | cute, cube, tune, mute, huge |

**不规则Magic-E**（e不改变元音音质，但仍标金色）：
- love, have, give, live, come, some, done, none, gone

---

### 6. 辅音组合（Consonant Digraphs）— 黄色 `#FFD700`

两个辅音字母发出**一个全新音素**，整体标黄色。

| 组合 | 音标 | 例词 | 位置 |
|------|------|------|------|
| ch | /tʃ/ | chip, chat, much, lunch | 首/尾 |
| sh | /ʃ/ | ship, wish, shop, brush | 首/尾 |
| th（清） | /θ/ | thin, thank, path, teeth | 首/尾 |
| th（浊） | /ð/ | this, that, them, with | 首/尾 |
| wh | /w/ | when, where, while, whale | 首 |
| ph | /f/ | phone, photo, graph, dolphin | 首/尾 |
| ng | /ŋ/ | ring, song, strong, king | 尾 |
| ck | /k/ | back, kick, duck, black | 尾 |
| tch | /tʃ/ | catch, match, watch, witch | 尾 |
| dge | /dʒ/ | bridge, badge, edge, judge | 尾 |
| gh | /g/ | ghost, ghoul | 首（少见）|

**ch 的异读**：
- /k/：chorus, echo, school, character
- /ʃ/：chef, machine, charade

---

### 7. 辅音丛（Consonant Clusters）— 蓝色 `#4169E1`

多个辅音相邻，**各自保留原音素**，整体标蓝色。

#### 7.1 词首辅音丛

| 类型 | 组合 | 例词 |
|------|------|------|
| l丛 | bl, cl, fl, gl, pl, sl | blue, clap, flag, glad, play, slip |
| r丛 | br, cr, dr, fr, gr, pr, tr | bring, crab, drop, frog, grab, print, trip |
| s丛 | sc, sk, sm, sn, sp, st, sw | scan, skip, small, snap, spin, stop, swim |
| 其他 | tw, qu | twin, queen（qu发/kw/）|
| 三合 | scr, spl, spr, str, squ, thr | scream, split, spring, strap, square, three |

#### 7.2 词尾辅音丛

| 组合 | 例词 |
|------|------|
| -nd | hand, bend, wind, sand |
| -nt | ant, bent, mint, hunt |
| -nk | ink, bank, think, drink |
| -st | best, fast, list, rest |
| -sk | desk, disk, risk, mask |
| -ft | left, soft, drift, gift |
| -lt | salt, belt, melt, bolt |
| -lf | self, half, shelf, wolf |
| -lm | calm, palm, film, elm |
| -lp | help, gulp, scalp, pulp |
| -mp | jump, camp, stamp, bump |
| -pt | kept, slept, wept |
| -ct | act, fact, contact |
| -xt | next, text |
| -sp | wasp, clasp, crisp |
| -nch | lunch, bench, branch, inch |
| -rk | dark, work, bark, fork |
| -rt | cart, hurt, sort, start |

---

### 8. 特殊后缀（Special Suffixes）— 绿色 `#32CD32`

词尾常见后缀有固定拼读规律，整体标绿色。

#### 8.1 -ous 家族（重点）

辅音 + ious 会改变辅音的发音，需细分：

| 后缀 | 发音 | 触发规则 | 例词 |
|------|------|---------|------|
| -ous | /əs/ | 基础形式 | famous, nervous, joyous, enormous, generous |
| -ious | /iəs/ | i保留元音音值 | serious, curious, obvious, various, glorious |
| -cious | /ʃəs/ | c+ious → /ʃ/ | delicious, precious, vicious, spacious, gracious, ferocious, atrocious |
| -scious | /ʃəs/ | sc+ious → /ʃ/ | conscious, unconscious, luscious |
| -tious | /ʃəs/ | t+ious → /ʃ/ | ambitious, cautious, infectious, nutritious, fictitious, superstitious |
| -xious | /kʃəs/ | x+ious → /kʃ/ | anxious, obnoxious, noxious |
| -gious | /dʒəs/ | g+ious → /dʒ/（软G）| religious, contagious, prodigious, prestigious |

> 以上均整体标绿色，不拆分内部字母。
> 分词边界：在后缀前一个辅音处切割，如 de·li·**cious**，am·bi·**tious**，re·li·**gious**

#### 8.2 -tion / -sion 家族

| 后缀 | 发音 | 例词 |
|------|------|------|
| -tion | /ʃən/ | nation, station, fraction, action, mention |
| -sion | /ʃən/ | tension, mission, passion, permission |
| -sion | /ʒən/ | vision, decision, division, explosion |
| -cion | /ʃən/ | suspicion, coercion |
| -cian | /ʃən/ | musician, magician, technician, physician |

#### 8.3 -ture / -sure 家族

| 后缀 | 发音 | 例词 |
|------|------|------|
| -ture | /tʃər/ | nature, picture, future, lecture, adventure |
| -sure | /ʒər/ | treasure, measure, pleasure, exposure |

#### 8.4 -tial / -cial 家族

| 后缀 | 发音 | 例词 |
|------|------|------|
| -tial | /ʃəl/ | partial, essential, initial, potential |
| -cial | /ʃəl/ | special, official, social, facial |
| -ial | /iəl/ | serial, material, memorial |

#### 8.5 -le / -el / -al 家族

| 后缀 | 发音 | 例词 |
|------|------|------|
| -le | /əl/ | table, little, apple, simple, purple |
| -el | /əl/ | camel, travel, model, vowel, tunnel |
| -al | /əl/ | local, total, animal, final, central |

#### 8.6 其他常用后缀

| 后缀 | 发音 | 例词 |
|------|------|------|
| -ic | /ɪk/ | magic, topic, traffic, comic, classic |
| -ive | /ɪv/ | active, native, massive, relative |
| -age | /ɪdʒ/ | village, cabbage, manage, package |
| -ace | /ɪs/ | palace, surface, necklace, furnace |
| -ance | /əns/ | dance, balance, romance, distance |
| -ence | /əns/ | fence, sentence, silence, difference |
| -ment | /mənt/ | moment, payment, treatment, movement |
| -ness | /nɪs/ | darkness, kindness, sadness, illness |
| -ful | /fʊl/ | careful, thankful, helpful, wonderful |
| -less | /lɪs/ | helpless, hopeless, careless, useless |
| -ly | /li/ | slowly, quickly, carefully, friendly |

#### 8.7 语法后缀

| 后缀 | 发音 | 例词 |
|------|------|------|
| -ing | /ɪŋ/ | running, playing, jumping, sleeping |
| -ed | /d/ /t/ /ɪd/ | played / talked / wanted |
| -er | /ər/ | teacher, bigger, runner, player |
| -est | /ɪst/ | biggest, fastest, tallest, smallest |
| -s / -es | /s/ /z/ /ɪz/ | cats / dogs / boxes |
| -y（词尾） | /i/ | happy, funny, baby, candy, rainy |

---

### 9. 静音字母（Silent Letters）— 灰色 `#888888`

字母写出但不发音，将该静音字母单独标灰色。

| 静音字母 | 常见组合 | 例词 |
|---------|---------|------|
| k | kn- | knee, know, knife, knock, knight |
| w | wr- | write, wrong, wrap, wrist, wreck |
| b | -mb | lamb, bomb, climb, comb, thumb |
| g | gn- / -gn | gnome, sign, design, align, reign |
| gh | -igh / -ght | light, night, high, right, sight |
| gh | -ough | though, through, dough, although |
| h | wh-（部分）| what, where, when, which, white |
| c | sc- | scene, science, scissors, scent |
| l | -lk | talk, walk, chalk, stalk, folk |
| l | -lf | half, calf, behalf |
| n | -mn | autumn, column, hymn, condemn |
| p | pn- | pneumonia, pneumatic |
| p | ps- | psychology, psalm, psychic |
| h | rh- | rhythm, rhyme, rhinoceros |
| t | -sten / -stle | listen, fasten, castle, whistle, bustle |

---

## 四、音节划分规则

### 4.1 基本原则

1. 每个音节只有**一个元音音素**（元音组合/R控元音算作一个）
2. 辅音夹在两个元音之间时：
   - 单辅音 → 随后面音节（开音节优先）：`o·pen`，`ba·by`
   - 双辅音 → 各归一个音节：`but·ter`，`hap·pen`
3. 辅音组合/辅音丛不拆开，整体归一个音节：`broth·er`，`chick·en`
4. 特殊后缀整体不拆开：`na·tion`，`pic·ture`，`de·li·cious`

### 4.2 常见音节结构类型

| 类型 | 缩写 | 结构 | 例词 | 元音发音 |
|------|------|------|------|---------|
| 闭音节 | CVC | 辅+元+辅 | cat, dog, sit | 短元音 |
| 开音节 | CV | 辅+元（结尾）| go, me, hi | 长元音 |
| 魔力E音节 | VCe | 元+辅+e | cake, bike | 长元音+魔力E |
| 元音组合音节 | VV | 两元音 | rain, boat | 元音组合 |
| R控音节 | Vr | 元音+r | car, bird | R控元音 |
| 辅音+le音节 | Cle | 辅+le | ta·ble, lit·tle | /əl/ |

### 4.3 多音节词划分示例

| 单词 | 音节划分 | 标注说明 |
|------|---------|---------|
| delicious | de·li·cious | de/li 开音节长元音（橙）+ cious 后缀（绿）|
| ambitious | am·bi·tious | am 闭音节短a（红）+ bi 开音节长i（橙）+ tious 后缀（绿）|
| conscious | con·scious | con 闭音节短o（红）+ scious 后缀（绿）|
| religious | re·li·gious | re/li 开音节长元音（橙）+ gious 后缀（绿）|
| anxious | anx·ious | anx（辅音丛蓝色）+ ious 后缀（绿）|
| sunshine | sun·shine | sun 闭音节短u（红）+ sh 辅音组合（黄）+ i 长元音（橙）+ e 魔力E（金）|
| rainbow | rain·bow | rain ai组合（青）+ bow ow组合（青）|
| birthday | birth·day | birth ir R控（紫）+ day ay组合（青）|
| sleeping | sleep·ing | sleep ee组合（青）+ ing 后缀（绿）|
| station | sta·tion | sta 开音节长a（橙）+ tion 后缀（绿）|
| picture | pic·ture | pic 闭音节短i（红）+ ture 后缀（绿）|
| night | night | igh 元音组合（青）+ t 普通辅音，gh 静音（灰）|
| ferocious | fe·ro·cious | fe/ro 开音节长元音（橙）+ cious 后缀（绿）|
| contagious | con·ta·gious | con 闭音节（红）+ ta 开音节（橙）+ gious 后缀（绿）|

---

## 五、特殊情况处理

### 5.1 一字多音（需结合语境）

| 单词 | 读音1 | 读音2 |
|------|-------|-------|
| read | /riːd/ 现在时 | /rɛd/ 过去时 |
| wind | /wɪnd/ 风 | /waɪnd/ 缠绕 |
| tear | /tɪər/ 眼泪 | /tɛər/ 撕扯 |
| bow | /boʊ/ 蝴蝶结 | /baʊ/ 鞠躬 |
| ow | /oʊ/ snow | /aʊ/ cow |
| ea | /iː/ meat | /ɛ/ bread |
| ie | /aɪ/ pie | /iː/ field |
| oo | /uː/ moon | /ʊ/ book |

### 5.2 软C / 软G规则

c 或 g 后接 **e、i、y** 时发软音：

| 字母 | 软音 | 条件 | 例词 |
|------|------|------|------|
| c → /s/ | 软C | c + e/i/y | city, cycle, cent, ice, face, nice |
| g → /dʒ/ | 软G | g + e/i/y | gem, giant, gym, page, age, stage |
| c → /k/ | 硬C | 其他情况 | cat, cup, car, coat |
| g → /g/ | 硬G | 其他情况 | got, gun, gap, glad |

> 例外：get, give, girl 中 g 仍为硬音，建议纳入不规则词表。

### 5.3 不规则词（Sight Words）

不完全遵循拼读规则，建议全词标注或单独记忆：

said, was, are, were, where, there, they, you, your, come, some, love, have, give, live, do, to, who, two, one, once, any, many, water, of, off, the, a, I, is, his, has, as, into, pretty, been, could, should, would

---

## 六、分词操作步骤（9步流程）

对词库中每个词进行标注时，按以下顺序逐步检查：

```
Step 1  识别特殊后缀（从词尾开始）
        先识别 -cious / -tious / -xious / -gious / -scious
        再识别 -tion / -sion / -cian / -ture / -sure
        再识别 -tial / -cial / -le / -al / -ic / -ive / -age 等
        → 整体标绿色，确定词尾边界

Step 2  识别静音字母
        kn- / wr- / -mb / gn- / -gh / sc- / -lk / -mn 等
        → 单独标灰色

Step 3  识别R控元音
        ar / er / ir / or / ur / air / ear / oar / are / ore 等
        → 整体标紫色

Step 4  识别元音组合
        ai/ay / ee/ea / oa/ow / oo / igh / ew / oi/oy / ou / au/aw 等
        → 整体标青色

Step 5  识别魔力E结构
        元音 + 辅音 + 词尾e（未被Step1归入后缀）
        → 元音标橙色，e标金色

Step 6  识别辅音组合
        ch / sh / th / wh / ph / ng / ck / tch / dge
        → 整体标黄色

Step 7  识别辅音丛
        词首：bl / cl / str / spr 等
        词尾：-nd / -mp / -nch 等
        → 整体标蓝色

Step 8  判断剩余元音
        开音节 → 长元音，标橙色
        闭音节 → 短元音，标红色

Step 9  剩余辅音字母 → 不标色（普通辅音）
```

---

## 七、-ous 家族快速判断树

```
词尾是 -ous？
│
├─ 前接 c  → -cious  /ʃəs/    delicious, precious, vicious, spacious
├─ 前接 sc → -scious /ʃəs/    conscious, unconscious, luscious
├─ 前接 t  → -tious  /ʃəs/    ambitious, cautious, nutritious
├─ 前接 x  → -xious  /kʃəs/   anxious, obnoxious, noxious
├─ 前接 g  → -gious  /dʒəs/   religious, contagious, prestigious
├─ 前接辅音+i → -ious /iəs/   serious, curious, obvious, glorious
└─ 直接接辅音 → -ous  /əs/    famous, nervous, joyous, enormous
```

---

## 八、版本记录

| 版本 | 更新内容 |
|------|---------|
| v1.0 | 初版，含9大类规则 |
| v1.1 | 补充eu/ei/eigh/ui元音组合；补充air/ear/oar/oor R控元音；补充静音字母；新增软C/G；完善音节划分步骤 |
| v1.2 | 新增-cious/-tious/-xious/-gious/-scious后缀；新增-ous家族快速判断树；标注优先级调整（特殊后缀提前）；补充例词 |
