/** Published order is also the stable PET Unit number. Never reorder this list. */
export const PET_TOPICS = [
  ['clothes-accessories', '服装与配饰'],
  ['colours', '颜色'],
  ['communications-technology', '通信与技术'],
  ['education', '教育'],
  ['entertainment-media', '娱乐与媒体'],
  ['environment', '环境'],
  ['food-drink', '食物与饮品'],
  ['health-medicine-exercise', '健康与身体'],
  ['hobbies-leisure', '爱好与休闲'],
  ['house-home', '房屋与家庭'],
  ['language', '语言'],
  ['feelings-opinions-experiences', '感受与经历'],
  ['buildings', '建筑物'],
  ['countryside', '乡村'],
  ['town-city', '城镇与城市'],
  ['services', '服务'],
  ['shopping', '购物'],
  ['sport', '运动'],
  ['natural-world', '自然'],
  ['time', '时间'],
  ['travel-transport', '旅行与交通'],
  ['weather', '天气'],
  ['work-jobs', '工作与职业'],
  ['basics', '基础与功能词'],
] as const

export function petTopicLabel(topic: string): string {
  return PET_TOPICS.find(([id]) => id === topic)?.[1] ?? topic
}

export const PET_PRIORITY_LABELS: Record<string, string> = {
  core: '核心必默',
  reading: '阅读高频',
  irregular: '不规则动词',
  official: '官方词表',
}
