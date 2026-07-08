export type DemoCategory = "paint" | "bridge" | "sudoku";

export interface DemoItem {
  href: string;
  slug: string;
  title: string;
  component: string;
  desc: string;
  category: DemoCategory;
  categoryLabel: string;
}

export const DEMO_CATEGORIES: Record<DemoCategory, string> = {
  paint: "涂色划分",
  bridge: "数桥",
  sudoku: "数独变体",
};

export const DEMO_ITEMS: DemoItem[] = [
  {
    href: "/demo/shulian",
    slug: "shulian",
    title: "数连",
    component: "ShulianGrid",
    desc: "相同数字横向/纵向相连，涂色路径不可交叉，需覆盖所有格子",
    category: "paint",
    categoryLabel: DEMO_CATEGORIES.paint,
  },
  {
    href: "/demo/shufang",
    slug: "shufang",
    title: "数方",
    component: "ShufangGrid",
    desc: "将棋盘划分为矩形区域，数字表示区域面积",
    category: "paint",
    categoryLabel: DEMO_CATEGORIES.paint,
  },
  {
    href: "/demo/shuqiao",
    slug: "shuqiao",
    title: "数桥",
    component: "ShuqiaoGrid",
    desc: "用桥连接岛屿，数字表示该岛桥的数量",
    category: "bridge",
    categoryLabel: DEMO_CATEGORIES.bridge,
  },
  {
    href: "/demo/juchi",
    slug: "juchi",
    title: "锯齿数独",
    component: "JuchiSudokuGrid",
    desc: "6×6 数独 + 不规则宫格划分",
    category: "sudoku",
    categoryLabel: DEMO_CATEGORIES.sudoku,
  },
  {
    href: "/demo/duijiaoxian",
    slug: "duijiaoxian",
    title: "对角线数独",
    component: "DuijiaoxianSudokuGrid",
    desc: "6×6 数独 + 两条主对角线约束",
    category: "sudoku",
    categoryLabel: DEMO_CATEGORIES.sudoku,
  },
  {
    href: "/demo/changgui",
    slug: "changgui",
    title: "常规数独",
    component: "ChangguiSudokuGrid",
    desc: "标准数独：每行、每列、每宫数字不重复",
    category: "sudoku",
    categoryLabel: DEMO_CATEGORIES.sudoku,
  },
  {
    href: "/demo/budeng",
    slug: "budeng",
    title: "不等号数独",
    component: "BudengSudokuGrid",
    desc: "4×4 数独 + 大于/小于约束",
    category: "sudoku",
    categoryLabel: DEMO_CATEGORIES.sudoku,
  },
  {
    href: "/demo/wuma",
    slug: "wuma",
    title: "无马数独",
    component: "WumaSudokuGrid",
    desc: "6×6 数独 + 马步约束",
    category: "sudoku",
    categoryLabel: DEMO_CATEGORIES.sudoku,
  },
  {
    href: "/demo/chuangkou",
    slug: "chuangkou",
    title: "窗口数独",
    component: "ChuangkouSudokuGrid",
    desc: "9×9 数独 + 四个窗口区域约束",
    category: "sudoku",
    categoryLabel: DEMO_CATEGORIES.sudoku,
  },
];
