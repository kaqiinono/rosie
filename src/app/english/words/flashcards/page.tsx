'use client'

interface PhraseCard {
  phrase: string
  zh: string
  emoji: string
  bg: string
  example: string
  exZh: string
  label?: string
}

interface GrammarExample {
  en: string
  zh: string
  note?: string
}

interface GrammarBlock {
  title: string
  subtitle: string
  rule: string
  examples: GrammarExample[]
  tip?: string
}

// ── Unit 7: Travel Phrases ──────────────────────────────────────────────────
const travelPhrases: PhraseCard[] = [
  {
    phrase: 'buy presents',
    zh: '买礼物；购买纪念品',
    emoji: '🛍️',
    bg: 'bg-amber-50',
    example: 'I always buy presents for my family when I travel.',
    exZh: '旅行时我总会给家人买礼物。',
  },
  {
    phrase: 'go camping',
    zh: '去露营',
    emoji: '⛺',
    bg: 'bg-emerald-50',
    example: 'We go camping in the mountains every summer.',
    exZh: '我们每年夏天都去山里露营。',
  },
  {
    phrase: 'lie on the beach',
    zh: '躺在沙滩上',
    emoji: '🏖️',
    bg: 'bg-sky-50',
    example: 'She loves to lie on the beach and read a book.',
    exZh: '她喜欢躺在沙滩上看书。',
  },
  {
    phrase: 'stay at a hotel',
    zh: '住酒店；入住旅馆',
    emoji: '🏨',
    bg: 'bg-violet-50',
    example: 'We stayed at a nice hotel during our trip.',
    exZh: '旅途中我们住在一家不错的酒店。',
  },
  {
    phrase: 'do water sports',
    zh: '做水上运动',
    emoji: '🏄',
    bg: 'bg-cyan-50',
    example: 'You can do water sports like surfing here.',
    exZh: '你可以在这里做冲浪等水上运动。',
  },
  {
    phrase: 'go sightseeing',
    zh: '去观光；游览名胜',
    emoji: '🗺️',
    bg: 'bg-green-50',
    example: 'We spent all day going sightseeing in Paris.',
    exZh: '我们花了一整天在巴黎观光游览。',
  },
  {
    phrase: 'ride a bike',
    zh: '骑自行车',
    emoji: '🚲',
    bg: 'bg-pink-50',
    example: "It's fun to ride a bike along the river.",
    exZh: '沿着河边骑自行车非常有趣。',
  },
  {
    phrase: 'take photos',
    zh: '拍照；拍照片',
    emoji: '📷',
    bg: 'bg-orange-50',
    example: "Don't forget to take photos of the scenery!",
    exZh: '别忘了拍下美丽的风景！',
  },
]

// ── Unit 7: Travel & Holiday Items ─────────────────────────────────────────
const travelItems: PhraseCard[] = [
  {
    phrase: 'airport',
    zh: '机场',
    emoji: '🛫',
    bg: 'bg-sky-50',
    example: 'We arrived at the airport two hours before the flight.',
    exZh: '我们在航班起飞前两小时到达机场。',
  },
  {
    phrase: 'coach',
    zh: '长途汽车；大巴',
    emoji: '🚌',
    bg: 'bg-yellow-50',
    example: 'We travel to London by coach because it is cheaper.',
    exZh: '我们坐大巴去伦敦，因为这样更便宜。',
  },
  {
    phrase: 'ferry',
    zh: '渡轮；轮渡',
    emoji: '⛴️',
    bg: 'bg-blue-50',
    example: 'He caught a ferry from France to Britain.',
    exZh: '他从法国坐渡轮去了英国。',
  },
  {
    phrase: 'flight',
    zh: '航班；飞行',
    emoji: '✈️',
    bg: 'bg-cyan-50',
    example: 'My flight to Tokyo leaves at 6 pm.',
    exZh: '我去东京的航班晚上 6 点起飞。',
  },
  {
    phrase: 'guidebook',
    zh: '旅游指南；导游手册',
    emoji: '📖',
    bg: 'bg-amber-50',
    example: 'A good guidebook helps you find famous places.',
    exZh: '一本好的旅游指南能帮你找到名胜景点。',
  },
  {
    phrase: 'map',
    zh: '地图',
    emoji: '🗺️',
    bg: 'bg-lime-50',
    example: 'Use the map to find the museum.',
    exZh: '用地图找到博物馆。',
  },
  {
    phrase: 'passport',
    zh: '护照',
    emoji: '🛂',
    bg: 'bg-rose-50',
    example: "Don't forget your passport at the airport!",
    exZh: '在机场可别忘了你的护照！',
  },
  {
    phrase: 'station',
    zh: '车站',
    emoji: '🚉',
    bg: 'bg-orange-50',
    example: 'The train leaves the station in ten minutes.',
    exZh: '火车十分钟后从车站出发。',
  },
  {
    phrase: 'suitcase',
    zh: '行李箱；手提箱',
    emoji: '🧳',
    bg: 'bg-violet-50',
    example: 'Pack your clothes in the suitcase.',
    exZh: '把你的衣服打包进行李箱里。',
  },
  {
    phrase: 'ticket',
    zh: '票；车票；机票',
    emoji: '🎫',
    bg: 'bg-pink-50',
    example: 'A friend paid for his flight ticket.',
    exZh: '一位朋友为他付了机票钱。',
  },
  {
    phrase: 'tour guide',
    zh: '导游',
    emoji: '🧑‍🏫',
    bg: 'bg-emerald-50',
    example: 'The tour guide showed us around the old city.',
    exZh: '导游带我们参观了老城。',
  },
  {
    phrase: 'tourist',
    zh: '游客；旅游者',
    emoji: '📸',
    bg: 'bg-teal-50',
    example: 'Lots of tourists visit Paris in summer.',
    exZh: '夏天有很多游客来巴黎旅游。',
  },
]

// ── Unit 7: Travel Verb Collocations ───────────────────────────────────────
const travelVerbs: PhraseCard[] = [
  {
    phrase: 'take (a photo / a train)',
    zh: '拍（照片）/ 乘坐（火车）',
    emoji: '🤳',
    bg: 'bg-orange-50',
    example: 'We took a photo in front of the Eiffel Tower.',
    exZh: '我们在埃菲尔铁塔前拍了一张照片。',
  },
  {
    phrase: 'catch (a bus / a flight)',
    zh: '赶上（公交车 / 航班）',
    emoji: '🎯',
    bg: 'bg-amber-50',
    example: 'He caught a flight home to plan his next trip.',
    exZh: '他赶上回家的航班去规划下一次旅行。',
  },
  {
    phrase: 'pack (a suitcase / your things)',
    zh: '收拾（行李箱）/ 打包（东西）',
    emoji: '🎒',
    bg: 'bg-violet-50',
    example: 'He packed his things into his rickshaw.',
    exZh: '他把东西装进了他的人力车。',
  },
  {
    phrase: 'travel by (bus / train / car)',
    zh: '乘坐（公交车 / 火车 / 汽车）出行',
    emoji: '🚆',
    bg: 'bg-sky-50',
    example: 'He only travels by boat or plane when there is no other choice.',
    exZh: '只有别无选择时他才坐船或坐飞机出行。',
  },
  {
    phrase: 'arrive at / in',
    zh: '到达（某地）',
    emoji: '🛬',
    bg: 'bg-emerald-50',
    example: 'He finally arrived at the famous Bird’s Nest Stadium.',
    exZh: '他最终到达了著名的鸟巢体育馆。',
  },
  {
    phrase: 'get on / get off',
    zh: '上（车 / 飞机）/ 下（车 / 飞机）',
    emoji: '🚪',
    bg: 'bg-cyan-50',
    example: 'He got on his rickshaw and rode to Brazil.',
    exZh: '他坐上人力车一路骑到了巴西。',
  },
]

// ── Unit 7: Irregular Past Simple Verbs ────────────────────────────────────
const irregularVerbs: PhraseCard[] = [
  {
    phrase: 'come → came',
    zh: '来；过来',
    emoji: '👋',
    bg: 'bg-amber-50',
    example: 'My friend Annabel came with us.',
    exZh: '我的朋友 Annabel 跟我们一起来了。',
  },
  {
    phrase: 'swim → swam',
    zh: '游泳',
    emoji: '🏊',
    bg: 'bg-cyan-50',
    example: 'We swam in the sea every day.',
    exZh: '我们每天都在海里游泳。',
  },
  {
    phrase: 'lie → lay',
    zh: '躺；平卧',
    emoji: '🛌',
    bg: 'bg-sky-50',
    example: 'We lay on the beach.',
    exZh: '我们躺在沙滩上。',
  },
  {
    phrase: 'do → did',
    zh: '做；干',
    emoji: '✅',
    bg: 'bg-green-50',
    example: 'We did lots of water sports.',
    exZh: '我们做了许多水上运动。',
  },
  {
    phrase: 'ride → rode',
    zh: '骑（自行车 / 马）',
    emoji: '🚲',
    bg: 'bg-pink-50',
    example: 'We rode our bikes.',
    exZh: '我们骑了自行车。',
  },
  {
    phrase: 'get up → got up',
    zh: '起床',
    emoji: '🌅',
    bg: 'bg-orange-50',
    example: 'We got up late every day.',
    exZh: '我们每天都起得很晚。',
  },
  {
    phrase: 'have → had',
    zh: '有；度过',
    emoji: '🎉',
    bg: 'bg-rose-50',
    example: 'We had a really good time.',
    exZh: '我们玩得非常开心。',
  },
  {
    phrase: 'give → gave',
    zh: '给予；送给',
    emoji: '🎁',
    bg: 'bg-red-50',
    example: 'My parents gave me a new phone.',
    exZh: '我父母送了我一部新手机。',
  },
  {
    phrase: 'take → took',
    zh: '拿；取；乘坐',
    emoji: '📷',
    bg: 'bg-yellow-50',
    example: 'I took hundreds of photos.',
    exZh: '我拍了几百张照片。',
  },
  {
    phrase: 'go → went',
    zh: '去；前往',
    emoji: '🚶',
    bg: 'bg-emerald-50',
    example: 'I went to Istanbul, in Turkey.',
    exZh: '我去了土耳其的伊斯坦布尔。',
  },
  {
    phrase: 'see → saw',
    zh: '看见；参观',
    emoji: '👁️',
    bg: 'bg-blue-50',
    example: 'I saw some interesting places.',
    exZh: '我参观了一些有趣的地方。',
  },
  {
    phrase: 'buy → bought',
    zh: '买；购买',
    emoji: '💳',
    bg: 'bg-purple-50',
    example: 'I bought you a present.',
    exZh: '我给你买了一份礼物。',
  },
  {
    phrase: 'eat → ate',
    zh: '吃',
    emoji: '🍽️',
    bg: 'bg-lime-50',
    example: 'I only ate one sweet.',
    exZh: '我只吃了一颗糖。',
  },
  {
    phrase: 'can → could',
    zh: '能够；可以',
    emoji: '💪',
    bg: 'bg-teal-50',
    example: 'We could walk to the beach in five minutes.',
    exZh: '我们五分钟就能走到海滩。',
  },
  {
    phrase: 'begin → began',
    zh: '开始',
    emoji: '🚀',
    bg: 'bg-fuchsia-50',
    example: 'The story began in 2001.',
    exZh: '故事始于 2001 年。',
  },
  {
    phrase: 'hear → heard',
    zh: '听见；听说',
    emoji: '👂',
    bg: 'bg-sky-50',
    example: 'He heard that the games were coming to Beijing.',
    exZh: '他听说奥运会要在北京举办。',
  },
  {
    phrase: 'leave → left',
    zh: '离开；留下',
    emoji: '🚪',
    bg: 'bg-stone-50',
    example: 'He left his village and cycled all over China.',
    exZh: '他离开村庄骑遍了中国。',
  },
  {
    phrase: 'sleep → slept',
    zh: '睡觉',
    emoji: '😴',
    bg: 'bg-indigo-50',
    example: 'He slept in his rickshaw.',
    exZh: '他睡在他的人力车里。',
  },
  {
    phrase: 'catch → caught',
    zh: '抓住；赶上',
    emoji: '🪤',
    bg: 'bg-amber-50',
    example: 'He caught a ferry to Britain.',
    exZh: '他坐渡轮去了英国。',
  },
  {
    phrase: 'meet → met',
    zh: '遇见；见到',
    emoji: '🤝',
    bg: 'bg-rose-50',
    example: 'He met lots of tourists.',
    exZh: '他遇到了许多游客。',
  },
  {
    phrase: 'tell → told',
    zh: '告诉；讲述',
    emoji: '🗣️',
    bg: 'bg-orange-50',
    example: 'He told them his story.',
    exZh: '他给他们讲了自己的故事。',
  },
  {
    phrase: 'fly → flew',
    zh: '飞；乘飞机',
    emoji: '✈️',
    bg: 'bg-cyan-50',
    example: 'In 2013, he flew back to London.',
    exZh: '2013 年，他乘飞机回到了伦敦。',
  },
  {
    phrase: 'put → put',
    zh: '放置（过去式不变）',
    emoji: '📦',
    bg: 'bg-yellow-50',
    example: 'He put his rickshaw on a ship to Canada.',
    exZh: '他把人力车放上了去加拿大的船。',
  },
  {
    phrase: 'pay → paid',
    zh: '支付；付款',
    emoji: '💰',
    bg: 'bg-green-50',
    example: 'A friend paid for his flight ticket.',
    exZh: '一位朋友为他付了机票钱。',
  },
  {
    phrase: 'make → made',
    zh: '制造；交（朋友）',
    emoji: '🛠️',
    bg: 'bg-violet-50',
    example: 'He made lots more friends.',
    exZh: '他交了更多的朋友。',
  },
  {
    phrase: 'find → found',
    zh: '找到；发现',
    emoji: '🔍',
    bg: 'bg-pink-50',
    example: 'Use the map to find famous places.',
    exZh: '用地图找到那些名胜。',
  },
]

// ── Unit 8: Home Items (A–K from image) ────────────────────────────────────
const homeItems: PhraseCard[] = [
  {
    label: 'A',
    phrase: 'carpet',
    zh: '地毯',
    emoji: '🟥',
    bg: 'bg-red-50',
    example: 'There is a soft red carpet on the living room floor.',
    exZh: '客厅地板上铺着一块柔软的红色地毯。',
  },
  {
    label: 'B',
    phrase: 'armchair',
    zh: '扶手椅；单人沙发',
    emoji: '🪑',
    bg: 'bg-orange-50',
    example: 'Grandpa always reads the newspaper in his armchair.',
    exZh: '爷爷总是坐在扶手椅里看报纸。',
  },
  {
    label: 'C',
    phrase: 'lamp',
    zh: '灯；台灯',
    emoji: '💡',
    bg: 'bg-yellow-50',
    example: 'She turned on the lamp to read before bed.',
    exZh: '她打开台灯，睡前看了会儿书。',
  },
  {
    label: 'D',
    phrase: 'cushion',
    zh: '靠垫；坐垫',
    emoji: '🛋️',
    bg: 'bg-rose-50',
    example: 'The colourful cushions make the sofa look cosy.',
    exZh: '色彩鲜艳的靠垫让沙发看起来很舒适。',
  },
  {
    label: 'E',
    phrase: 'chest of drawers',
    zh: '五斗柜；抽屉柜',
    emoji: '🗃️',
    bg: 'bg-amber-50',
    example: 'My socks are in the top drawer of the chest of drawers.',
    exZh: '我的袜子放在五斗柜的最上层抽屉里。',
  },
  {
    label: 'F',
    phrase: 'cupboard',
    zh: '衣柜；橱柜',
    emoji: '🚪',
    bg: 'bg-stone-50',
    example: 'Hang your coat in the cupboard by the door.',
    exZh: '把你的外套挂进门边的衣柜里。',
  },
  {
    label: 'G',
    phrase: 'photographs',
    zh: '照片；相片',
    emoji: '🖼️',
    bg: 'bg-lime-50',
    example: 'The wall is covered with family photographs.',
    exZh: '墙上挂满了家人的照片。',
  },
  {
    label: 'H',
    phrase: 'blanket',
    zh: '毯子；毛毯',
    emoji: '🛏️',
    bg: 'bg-orange-50',
    example: 'She wrapped herself in a warm blanket on the sofa.',
    exZh: '她裹着一条暖和的毯子坐在沙发上。',
  },
  {
    label: 'I',
    phrase: 'curtains',
    zh: '窗帘',
    emoji: '🪟',
    bg: 'bg-sky-50',
    example: "Please draw the curtains — it's getting dark outside.",
    exZh: '请把窗帘拉上，外面天快黑了。',
  },
  {
    label: 'J',
    phrase: 'bookshelf',
    zh: '书架；书柜',
    emoji: '📚',
    bg: 'bg-emerald-50',
    example: 'There are hundreds of books on the bookshelf.',
    exZh: '书架上摆着数百本书。',
  },
  {
    label: 'K',
    phrase: 'mirror',
    zh: '镜子',
    emoji: '🪞',
    bg: 'bg-violet-50',
    example: 'She checked her hair in the mirror before leaving.',
    exZh: '她出门前对着镜子整理了一下头发。',
  },
]

// ── Unit 8: Indefinite Pronouns (someone / anyone, etc.) ───────────────────
const indefinitePronouns: PhraseCard[] = [
  {
    phrase: 'everyone',
    zh: '每个人；人人',
    emoji: '👥',
    bg: 'bg-amber-50',
    example: 'Everyone in the class likes the colour blue.',
    exZh: '班里每个人都喜欢蓝色。',
  },
  {
    phrase: 'someone',
    zh: '某人；有人',
    emoji: '👤',
    bg: 'bg-rose-50',
    example: 'Someone gave me these shoes.',
    exZh: '有人送了我这双鞋。',
  },
  {
    phrase: 'anyone',
    zh: '任何人',
    emoji: '❓',
    bg: 'bg-yellow-50',
    example: 'Did anyone come to your party?',
    exZh: '有任何人来你的派对吗？',
  },
  {
    phrase: 'no one',
    zh: '没有人',
    emoji: '🚫',
    bg: 'bg-stone-50',
    example: 'No one told me that you wrote stories!',
    exZh: '没人告诉过我你会写故事！',
  },
  {
    phrase: 'everywhere',
    zh: '到处；处处',
    emoji: '🌍',
    bg: 'bg-emerald-50',
    example: 'I looked for my keys everywhere.',
    exZh: '我到处都找了我的钥匙。',
  },
  {
    phrase: 'somewhere',
    zh: '某处；在某地',
    emoji: '📍',
    bg: 'bg-sky-50',
    example: 'She went somewhere hot for her holidays.',
    exZh: '她去了一个炎热的地方度假。',
  },
  {
    phrase: 'anywhere',
    zh: '任何地方',
    emoji: '🧭',
    bg: 'bg-cyan-50',
    example: 'Can you think of anywhere to go this afternoon?',
    exZh: '你能想到今天下午去哪儿玩吗？',
  },
  {
    phrase: 'nowhere',
    zh: '哪里都不；无处',
    emoji: '⛔',
    bg: 'bg-red-50',
    example: 'Nowhere in my house is a special place.',
    exZh: '我家里没有任何一个地方算是特别的地方。',
  },
  {
    phrase: 'everything',
    zh: '每件事；一切',
    emoji: '🌐',
    bg: 'bg-lime-50',
    example: 'You can write everything you like.',
    exZh: '你想写什么都可以。',
  },
  {
    phrase: 'something',
    zh: '某事；某物',
    emoji: '💭',
    bg: 'bg-pink-50',
    example: 'Please tell me something about your holiday.',
    exZh: '请跟我讲讲你假期的事吧。',
  },
  {
    phrase: 'anything',
    zh: '任何事；任何东西',
    emoji: '❔',
    bg: 'bg-orange-50',
    example: 'Do you remember anything about the film?',
    exZh: '你还记得这部电影的任何内容吗？',
  },
  {
    phrase: 'nothing',
    zh: '没有事；没有东西',
    emoji: '💨',
    bg: 'bg-violet-50',
    example: "It's very dark. I can't see nothing → I can see nothing.",
    exZh: '太黑了。我什么也看不见。',
  },
]

// ── Unit 8: Free-time Activities ────────────────────────────────────────────
const freeTimeActivities: PhraseCard[] = [
  {
    phrase: 'draw pictures',
    zh: '画画',
    emoji: '🎨',
    bg: 'bg-rose-50',
    example: 'When I went out, I always had lots of ideas to draw pictures.',
    exZh: '我出门时总有许多画画的灵感。',
  },
  {
    phrase: 'listen to music',
    zh: '听音乐',
    emoji: '🎧',
    bg: 'bg-sky-50',
    example: 'I close the door, lie on my bed and listen to music.',
    exZh: '我关上门，躺在床上听音乐。',
  },
  {
    phrase: 'paint pictures',
    zh: '绘画；画油画',
    emoji: '🖌️',
    bg: 'bg-amber-50',
    example: 'She went out to paint pictures by the sea.',
    exZh: '她出门去海边画画。',
  },
  {
    phrase: 'play the drums',
    zh: '打鼓',
    emoji: '🥁',
    bg: 'bg-red-50',
    example: 'My brother plays the drums in a band.',
    exZh: '我哥哥在乐队里打鼓。',
  },
  {
    phrase: 'play the guitar',
    zh: '弹吉他',
    emoji: '🎸',
    bg: 'bg-orange-50',
    example: 'She loves to play the guitar after dinner.',
    exZh: '她喜欢晚饭后弹吉他。',
  },
  {
    phrase: 'play computer games',
    zh: '玩电脑游戏',
    emoji: '🎮',
    bg: 'bg-violet-50',
    example: 'We played computer games last night.',
    exZh: '我们昨晚玩了电脑游戏。',
  },
  {
    phrase: 'read a blog',
    zh: '读博客',
    emoji: '📱',
    bg: 'bg-cyan-50',
    example: 'I read a blog about travel every week.',
    exZh: '我每周都读一篇关于旅行的博客。',
  },
  {
    phrase: 'read magazines',
    zh: '读杂志',
    emoji: '📰',
    bg: 'bg-yellow-50',
    example: 'She likes to read magazines in the armchair.',
    exZh: '她喜欢坐在扶手椅里读杂志。',
  },
  {
    phrase: 'write a blog',
    zh: '写博客',
    emoji: '✍️',
    bg: 'bg-emerald-50',
    example: 'He writes a blog about his journeys.',
    exZh: '他在博客里记录自己的旅程。',
  },
  {
    phrase: 'write a diary',
    zh: '写日记',
    emoji: '📓',
    bg: 'bg-lime-50',
    example: 'I write a diary every evening before bed.',
    exZh: '我每天晚上睡前写日记。',
  },
  {
    phrase: 'write songs',
    zh: '写歌；作曲',
    emoji: '🎵',
    bg: 'bg-pink-50',
    example: 'She started writing her own songs about nature.',
    exZh: '她开始创作关于自然的歌曲。',
  },
  {
    phrase: 'write stories',
    zh: '写故事',
    emoji: '📚',
    bg: 'bg-stone-50',
    example: 'My cousin writes stories for children.',
    exZh: '我表妹给孩子们写故事。',
  },
]

// ── Unit 8: Life Skills — Safety at Home ───────────────────────────────────
const safetyItems: PhraseCard[] = [
  {
    phrase: 'lighter',
    zh: '打火机',
    emoji: '🔥',
    bg: 'bg-red-50',
    example: 'Be careful with matches and lighters.',
    exZh: '使用火柴和打火机时要小心。',
  },
  {
    phrase: 'matches',
    zh: '火柴',
    emoji: '🔥',
    bg: 'bg-orange-50',
    example: "It's dangerous to use matches without adults around.",
    exZh: '没有大人在场时使用火柴很危险。',
  },
  {
    phrase: 'rug',
    zh: '小地毯；地垫',
    emoji: '🟫',
    bg: 'bg-amber-50',
    example: "Make sure rugs don't move on the floor.",
    exZh: '确保地毯不会在地板上滑动。',
  },
  {
    phrase: 'knives',
    zh: '刀（knife 的复数）',
    emoji: '🔪',
    bg: 'bg-stone-50',
    example: 'Use scissors and knives carefully.',
    exZh: '使用剪刀和刀具时要小心。',
  },
  {
    phrase: 'heater',
    zh: '取暖器；暖气片',
    emoji: '♨️',
    bg: 'bg-rose-50',
    example: "Don't touch a hot iron or heater.",
    exZh: '不要触摸炽热的熨斗或取暖器。',
  },
  {
    phrase: 'iron',
    zh: '熨斗',
    emoji: '🧺',
    bg: 'bg-sky-50',
    example: 'You need to be careful with hot irons.',
    exZh: '使用热熨斗时一定要小心。',
  },
  {
    phrase: 'stairs',
    zh: '楼梯',
    emoji: '🪜',
    bg: 'bg-yellow-50',
    example: "Don't leave books or shoes on the stairs.",
    exZh: '不要把书或鞋子放在楼梯上。',
  },
  {
    phrase: 'fire extinguisher',
    zh: '灭火器',
    emoji: '🧯',
    bg: 'bg-red-50',
    example: "It's a good idea to keep a fire extinguisher at home.",
    exZh: '在家里准备一个灭火器是个好主意。',
  },
  {
    phrase: 'sharp',
    zh: '锋利的；尖锐的',
    emoji: '🗡️',
    bg: 'bg-slate-50',
    example: "Don't touch sharp, metal objects.",
    exZh: '不要触摸锋利的金属物品。',
  },
]

// ── Unit 9: Clothes ────────────────────────────────────────────────────────
const clothes: PhraseCard[] = [
  {
    label: 'A',
    phrase: 'socks',
    zh: '袜子（一双）',
    emoji: '🧦',
    bg: 'bg-stone-50',
    example: 'My parents bought me warm socks for the skiing holiday.',
    exZh: '爸妈给我买了滑雪假期穿的厚袜子。',
  },
  {
    label: 'B',
    phrase: 'jumper',
    zh: '套头毛衣',
    emoji: '🧥',
    bg: 'bg-violet-50',
    example: 'I saw an amazing black and purple jumper with pockets.',
    exZh: '我看到一件超棒的黑紫色毛衣，还带口袋。',
  },
  {
    label: 'C',
    phrase: 'sunglasses',
    zh: '太阳镜；墨镜',
    emoji: '🕶️',
    bg: 'bg-cyan-50',
    example: 'I got pale blue swimming shorts and sunglasses.',
    exZh: '我买了浅蓝色泳裤和太阳镜。',
  },
  {
    label: 'D',
    phrase: 'cap',
    zh: '鸭舌帽；棒球帽',
    emoji: '🧢',
    bg: 'bg-blue-50',
    example: 'The best thing is a bright blue cap!',
    exZh: '最棒的是一顶亮蓝色的鸭舌帽！',
  },
  {
    label: 'E',
    phrase: 'swimming shorts',
    zh: '泳裤',
    emoji: '🩳',
    bg: 'bg-sky-50',
    example: 'Are these your swimming shorts?',
    exZh: '这是你的泳裤吗？',
  },
  {
    label: 'F',
    phrase: 'trainers',
    zh: '运动鞋',
    emoji: '👟',
    bg: 'bg-emerald-50',
    example: 'And black trainers — the best thing is a bright blue cap!',
    exZh: '还有黑色运动鞋——最棒的是那顶亮蓝色帽子！',
  },
  {
    label: 'G',
    phrase: 'scarf',
    zh: '围巾',
    emoji: '🧣',
    bg: 'bg-red-50',
    example: 'I got socks, gloves and a scarf for my skiing holiday.',
    exZh: '我滑雪假期买了袜子、手套和围巾。',
  },
  {
    label: 'H',
    phrase: 'gloves',
    zh: '手套（一双）',
    emoji: '🧤',
    bg: 'bg-indigo-50',
    example: "I'm sure those gloves are mine.",
    exZh: '我确定那双手套是我的。',
  },
  {
    label: 'I',
    phrase: 'suit',
    zh: '西装；套装',
    emoji: '👔',
    bg: 'bg-slate-50',
    example: 'He bought me a pale grey suit for the wedding.',
    exZh: '他给我买了一套浅灰色西装去参加婚礼。',
  },
  {
    label: 'J',
    phrase: 'swimming costume',
    zh: '泳衣',
    emoji: '👙',
    bg: 'bg-pink-50',
    example: 'My sister and I bought swimming costumes last summer.',
    exZh: '去年夏天我和姐姐买了泳衣。',
  },
  {
    label: 'K',
    phrase: 'boots',
    zh: '靴子',
    emoji: '👢',
    bg: 'bg-red-50',
    example: 'My best buy last year was a pair of bright red boots.',
    exZh: '我去年最满意的就是一双亮红色靴子。',
  },
  {
    label: 'L',
    phrase: 'tie',
    zh: '领带',
    emoji: '🎀',
    bg: 'bg-lime-50',
    example: 'He bought a pale green tie for the wedding.',
    exZh: '他买了一条淡绿色领带去参加婚礼。',
  },
]

// ── Unit 9: Materials ──────────────────────────────────────────────────────
const materials: PhraseCard[] = [
  {
    phrase: 'wool',
    zh: '羊毛',
    emoji: '🐑',
    bg: 'bg-rose-50',
    example: 'Is your jumper made of wool?',
    exZh: '你的毛衣是羊毛做的吗？',
  },
  {
    phrase: 'leather',
    zh: '皮革',
    emoji: '👞',
    bg: 'bg-amber-50',
    example: 'Are you wearing a pair of leather boots?',
    exZh: '你穿的是一双皮靴吗？',
  },
  {
    phrase: 'cork',
    zh: '软木；木塞',
    emoji: '🍾',
    bg: 'bg-orange-50',
    example: 'You can use cork to make hats and shoes.',
    exZh: '你可以用软木做帽子和鞋子。',
  },
  {
    phrase: 'metal',
    zh: '金属',
    emoji: '⛓️',
    bg: 'bg-slate-50',
    example: 'This dress is made of metal from old food cans.',
    exZh: '这件裙子是用废旧食品罐头的金属做成的。',
  },
  {
    phrase: 'plastic',
    zh: '塑料',
    emoji: '♻️',
    bg: 'bg-cyan-50',
    example: 'They make jewellery out of plastic knives and forks.',
    exZh: '他们用塑料刀叉做首饰。',
  },
  {
    phrase: 'cotton',
    zh: '棉；棉布',
    emoji: '🌱',
    bg: 'bg-green-50',
    example: 'Are your shorts made of cotton?',
    exZh: '你的短裤是棉做的吗？',
  },
]

// ── Unit 9: Possessive Pronouns ────────────────────────────────────────────
const possessivePronouns: PhraseCard[] = [
  {
    phrase: 'my → mine',
    zh: '我的（限定词 → 代词）',
    emoji: '🙋',
    bg: 'bg-amber-50',
    example: "They're my trainers. → They're mine.",
    exZh: '那是我的运动鞋。 → 它们是我的。',
  },
  {
    phrase: 'your → yours',
    zh: '你的 / 你们的',
    emoji: '👉',
    bg: 'bg-sky-50',
    example: 'Are they your shorts? → Are they yours?',
    exZh: '那是你的短裤吗？ → 它们是你的吗？',
  },
  {
    phrase: 'his → his',
    zh: '他的（限定词与代词同形）',
    emoji: '👦',
    bg: 'bg-blue-50',
    example: "It's his jumper. → It's his.",
    exZh: '那是他的毛衣。 → 那是他的。',
  },
  {
    phrase: 'her → hers',
    zh: '她的',
    emoji: '👧',
    bg: 'bg-rose-50',
    example: 'Are they her gloves? → Are they hers?',
    exZh: '那是她的手套吗？ → 它们是她的吗？',
  },
  {
    phrase: 'its (no pronoun form)',
    zh: '它的（无独立代词形式）',
    emoji: '🐱',
    bg: 'bg-stone-50',
    example: "It's its blanket. (no its-form pronoun)",
    exZh: '那是它的毯子。（没有独立的代词形式）',
  },
  {
    phrase: 'our → ours',
    zh: '我们的',
    emoji: '👨‍👩‍👧',
    bg: 'bg-emerald-50',
    example: "It's our clothes blog. → It's ours.",
    exZh: '那是我们的服装博客。 → 那是我们的。',
  },
  {
    phrase: 'their → theirs',
    zh: '他们的 / 她们的',
    emoji: '👯',
    bg: 'bg-violet-50',
    example: "They're their swimming costumes. → They're theirs.",
    exZh: '那是他们的泳衣。 → 那是他们的。',
  },
]

// ── Grammar reference content ─────────────────────────────────────────────
const pastSimpleGrammar: GrammarBlock = {
  title: '一般过去时：不规则动词',
  subtitle: 'Past simple: irregular verbs',
  rule: '描述过去发生的动作。许多常用动词的过去式不规则，需单独记忆。否定句用 didn’t + 动词原形，疑问句用 Did + 主语 + 动词原形。',
  examples: [
    { en: 'We swam in the sea every day.', zh: '我们每天都在海里游泳。' },
    { en: 'Did you get up early every day?', zh: '你每天都早起吗？' },
    { en: 'No, we didn’t. We got up late.', zh: '不，我们没有。我们起得晚。' },
    { en: 'My parents gave me a new phone.', zh: '我父母送了我一部新手机。' },
    {
      en: 'My family gave (NOT gived) me a lot of presents.',
      zh: 'gived 是错误形式；不规则动词不能加 -ed。',
      note: '常见易错点',
    },
  ],
  tip: '复习建议：把不规则动词按读音或拼写规律分组记忆（如 buy/bought, catch/caught, think/thought）。',
}

const indefinitePronounsGrammar: GrammarBlock = {
  title: '不定代词：someone / anyone 等',
  subtitle: 'someone, anyone, everywhere, nothing …',
  rule: '由 every- / some- / any- / no- 与 -one / -where / -thing 组合而成。-one 指人，-where 指地点，-thing 指事物。否定句中只能用一次否定（用 anything / anywhere / anyone）。',
  examples: [
    { en: 'Someone gave me these shoes.', zh: '有人送了我这双鞋。（人）' },
    { en: 'She went somewhere hot for her holidays.', zh: '她去了一个炎热的地方度假。（地点）' },
    { en: 'I don’t need anything else.', zh: '我不需要任何其他东西了。（否定 + any-）' },
    { en: 'No one told me!', zh: '没有人告诉过我！' },
    {
      en: '❌ I can’t see no one. → ✅ I can’t see anyone.',
      zh: '否定句不要双重否定。',
      note: '常见易错点',
    },
  ],
  tip: 'some- 用于肯定句，any- 用于否定句和疑问句，no- 本身已含否定意义。',
}

const pronounsGrammar: GrammarBlock = {
  title: '物主限定词与物主代词',
  subtitle: 'Pronouns and determiners',
  rule: '限定词（my / your / his / her / its / our / their）后必须跟名词；物主代词（mine / yours / his / hers / ours / theirs）可独立使用，相当于「形容词性物主代词 + 名词」。',
  examples: [
    { en: "They're my trainers. → They're mine.", zh: '那是我的运动鞋。 → 它们是我的。' },
    { en: 'This cap is his. (= his cap)', zh: '这顶帽子是他的。' },
    { en: "Are these pens yours? No, they're hers.", zh: '这些笔是你的吗？不，是她的。' },
    {
      en: '❌ You can borrow me book. → ✅ You can borrow my book.',
      zh: '名词前要用限定词 my，不要用宾格 me。',
      note: '常见易错点',
    },
    {
      en: '❌ a pair of trainers like my → ✅ … like mine',
      zh: '没有名词时要用代词 mine。',
      note: '常见易错点',
    },
  ],
}

// ── Shared card component ───────────────────────────────────────────────────
function FlashCard({ card }: { card: PhraseCard }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* Banner */}
      <div className={`${card.bg} relative flex h-24 items-center justify-center sm:h-28`}>
        {card.label && (
          <span className="absolute top-2 left-2.5 rounded bg-pink-500 px-1.5 py-0.5 text-[11px] leading-none font-bold text-white select-none">
            {card.label}
          </span>
        )}
        <span className="text-5xl select-none sm:text-6xl" role="img" aria-label={card.phrase}>
          {card.emoji}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="text-base font-semibold tracking-tight text-gray-900">{card.phrase}</p>
          <p className="mt-0.5 text-sm text-gray-500">{card.zh}</p>
        </div>

        <hr className="border-gray-100" />

        <div>
          <p className="mb-1 text-[10px] font-medium tracking-widest text-gray-400 uppercase">
            例句
          </p>
          <p className="text-sm leading-relaxed text-gray-600 italic">{card.example}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">{card.exZh}</p>
        </div>
      </div>
    </div>
  )
}

// ── Section wrapper ─────────────────────────────────────────────────────────
function Section({
  id,
  title,
  subtitle,
  cards,
}: {
  id?: string
  title: string
  subtitle: string
  cards: PhraseCard[]
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-24">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          {subtitle} · {cards.length} 个词
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <FlashCard key={card.phrase} card={card} />
        ))}
      </div>
    </section>
  )
}

// ── Unit header ────────────────────────────────────────────────────────────
function UnitHeader({
  id,
  unit,
  title,
  zhTitle,
  accent,
}: {
  id: string
  unit: number
  title: string
  zhTitle: string
  accent: string
}) {
  return (
    <div id={id} className="mb-6 scroll-mt-24">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white sm:h-12 sm:w-12 sm:text-lg ${accent}`}
        >
          {unit}
        </span>
        <div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h2>
          <p className="mt-0.5 text-sm text-gray-500">Unit {unit} · {zhTitle}</p>
        </div>
      </div>
      <div className="mt-4 h-px w-full bg-gradient-to-r from-gray-200 to-transparent" />
    </div>
  )
}

// ── Grammar reference block ────────────────────────────────────────────────
function GrammarSection({ block, accent }: { block: GrammarBlock; accent: string }) {
  return (
    <section className="mb-12 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className={`${accent} px-5 py-4 sm:px-6`}>
        <p className="text-[11px] font-bold tracking-widest text-white/80 uppercase">Grammar</p>
        <h3 className="mt-0.5 text-lg font-bold text-white sm:text-xl">{block.title}</h3>
        <p className="mt-0.5 text-sm text-white/80">{block.subtitle}</p>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-gray-700">{block.rule}</p>

        <div className="space-y-3">
          {block.examples.map((ex, i) => (
            <div
              key={i}
              className={`rounded-lg border px-3 py-2 ${
                ex.note
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-gray-100 bg-gray-50'
              }`}
            >
              {ex.note && (
                <p className="mb-1 text-[10px] font-bold tracking-widest text-amber-700 uppercase">
                  {ex.note}
                </p>
              )}
              <p className="text-sm font-medium text-gray-900">{ex.en}</p>
              <p className="mt-0.5 text-xs text-gray-500">{ex.zh}</p>
            </div>
          ))}
        </div>

        {block.tip && (
          <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
            <p className="mb-1 text-[10px] font-bold tracking-widest text-sky-700 uppercase">
              小贴士
            </p>
            <p className="text-sm leading-relaxed text-sky-900">{block.tip}</p>
          </div>
        )}
      </div>
    </section>
  )
}

// ── Top navigation (anchor links) ──────────────────────────────────────────
const tocLinks = [
  { href: '#unit-7', label: 'Unit 7', sub: 'Travel' },
  { href: '#unit-8', label: 'Unit 8', sub: 'Places' },
  { href: '#unit-9', label: 'Unit 9', sub: 'Clothes' },
]

function TopNav() {
  return (
    <nav className="mb-10 grid grid-cols-3 gap-2 sm:gap-3">
      {tocLinks.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="group flex flex-col items-center rounded-xl border border-gray-100 bg-white px-3 py-3 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="text-sm font-bold text-gray-900 sm:text-base">{link.label}</span>
          <span className="mt-0.5 text-[11px] text-gray-500 sm:text-xs">{link.sub}</span>
        </a>
      ))}
    </nav>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function FlashcardList() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs font-bold tracking-widest text-emerald-600 uppercase">
            Units 7–9 Review
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 sm:text-3xl">
            英语单词卡片 · 第 7–9 单元复习
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Vocabulary Flashcards · An Exciting Trip · Favourite Places · Clothes and Fashion
          </p>
        </div>

        <TopNav />

        {/* Unit 7 */}
        <UnitHeader
          id="unit-7"
          unit={7}
          title="An Exciting Trip"
          zhTitle="一次激动人心的旅行"
          accent="bg-gradient-to-br from-sky-500 to-cyan-500"
        />
        <Section
          title="① 假期活动短语"
          subtitle="Holidays — activities"
          cards={travelPhrases}
        />
        <Section
          title="② 旅行物品与人物"
          subtitle="Holidays — travel items"
          cards={travelItems}
        />
        <Section
          title="③ 旅行动词搭配"
          subtitle="Verb collocations for journeys"
          cards={travelVerbs}
        />
        <Section
          title="④ 不规则动词过去式"
          subtitle="Irregular past simple verbs"
          cards={irregularVerbs}
        />
        <GrammarSection
          block={pastSimpleGrammar}
          accent="bg-gradient-to-r from-sky-500 to-cyan-500"
        />

        {/* Unit 8 */}
        <UnitHeader
          id="unit-8"
          unit={8}
          title="Favourite Places"
          zhTitle="最喜爱的地方"
          accent="bg-gradient-to-br from-violet-500 to-fuchsia-500"
        />
        <Section
          title="① 卧室与家居物品"
          subtitle="Bedroom & home items (A–K)"
          cards={homeItems}
        />
        <Section
          title="② 不定代词"
          subtitle="someone, anyone, everywhere …"
          cards={indefinitePronouns}
        />
        <Section
          title="③ 休闲活动"
          subtitle="Free-time activities"
          cards={freeTimeActivities}
        />
        <Section
          title="④ 家居安全（Life Skills）"
          subtitle="Safety at home"
          cards={safetyItems}
        />
        <GrammarSection
          block={indefinitePronounsGrammar}
          accent="bg-gradient-to-r from-violet-500 to-fuchsia-500"
        />

        {/* Unit 9 */}
        <UnitHeader
          id="unit-9"
          unit={9}
          title="Clothes and Fashion"
          zhTitle="服装与时尚"
          accent="bg-gradient-to-br from-pink-500 to-rose-500"
        />
        <Section title="① 服装" subtitle="Clothes (A–L)" cards={clothes} />
        <Section title="② 材质" subtitle="Materials" cards={materials} />
        <Section
          title="③ 物主代词与限定词"
          subtitle="Pronouns and determiners"
          cards={possessivePronouns}
        />
        <GrammarSection
          block={pronounsGrammar}
          accent="bg-gradient-to-r from-pink-500 to-rose-500"
        />

        {/* Footer note */}
        <div className="mt-12 rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm sm:p-6">
          <p className="text-sm font-semibold text-gray-900">
            🎯 复习目标 · Review Goals
          </p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            掌握 Units 7–9 全部词汇与短语 · 熟记 26 个不规则动词过去式 · 能区分不定代词的用法
            · 正确使用限定词与物主代词
          </p>
        </div>
      </div>
    </div>
  )
}
