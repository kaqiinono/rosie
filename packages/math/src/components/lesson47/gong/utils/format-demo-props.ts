function formatPrimitive(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return `'${value}'`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function isFlatCoordArray(value: unknown[]): value is (number | string)[][] {
  return value.every(
    (item) =>
      Array.isArray(item) &&
      item.length > 0 &&
      item.every((x) => typeof x === "number" || typeof x === "string"),
  );
}

function isNumberMatrix(value: unknown[]): value is number[][] {
  return value.every((item) => Array.isArray(item) && item.every((x) => typeof x === "number"));
}

function formatFlatCoordArray(arr: (number | string)[][], indent: number): string {
  const pad = " ".repeat(indent);
  if (arr.length <= 4 && arr.every((row) => row.length <= 3)) {
    return `[${arr.map((row) => `[${row.map(formatPrimitive).join(", ")}]`).join(", ")}]`;
  }
  const rows = arr.map((row) => `${pad}  [${row.map(formatPrimitive).join(", ")}],`);
  return `[\n${rows.join("\n")}\n${pad}]`;
}

function formatNumberMatrix(arr: number[][], indent: number): string {
  const pad = " ".repeat(indent);
  const rows = arr.map((row) => `${pad}  [${row.join(", ")}],`);
  return `[\n${rows.join("\n")}\n${pad}]`;
}

function formatNestedArray(arr: unknown[], indent: number): string {
  const pad = " ".repeat(indent);
  const inner = arr.map((item) => {
    if (Array.isArray(item)) {
      if (isFlatCoordArray(item)) return formatFlatCoordArray(item, indent + 2);
      if (isNumberMatrix(item)) return formatNumberMatrix(item, indent + 2);
      return `[${item.map((x) => (Array.isArray(x) ? formatNestedArray(x, indent + 2) : formatPrimitive(x))).join(", ")}]`;
    }
    return formatPrimitive(item);
  });
  if (inner.length <= 2 && inner.every((s) => !s.includes("\n"))) {
    return `[${inner.join(", ")}]`;
  }
  return `[\n${pad}  ${inner.join(`,\n${pad}  `)}\n${pad}]`;
}

function formatJsxValue(value: unknown, indent = 2): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (isFlatCoordArray(value)) return formatFlatCoordArray(value, indent);
    if (isNumberMatrix(value)) return formatNumberMatrix(value, indent);
    return formatNestedArray(value, indent);
  }
  return `{${formatPrimitive(value)}}`;
}

/** 将 props 格式化为 JSX 属性行（不含组件名） */
export function formatDemoPropLines(props: Record<string, unknown>): string[] {
  return Object.entries(props)
    .filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0))
    .map(([key, value]) => `${key}={${formatJsxValue(value)}}`);
}

/** 生成完整 JSX 用法字符串，与下方渲染组件使用同一套 props */
export function formatComponentUsage(componentName: string, props: Record<string, unknown>): string {
  const lines = formatDemoPropLines(props).map((line) => `  ${line}`);
  if (lines.length === 0) return `<${componentName} />`;
  return `<${componentName}\n${lines.join("\n")}\n/>`;
}

/** 将 props 序列化为可编辑 JSX 属性文本（Demo 调试用） */
export function serializeDemoPropAttributes(props: Record<string, unknown>): string {
  return formatDemoPropLines(props).join("\n");
}

/** 相邻数组字面量之间补逗号，兼容换行省略逗号的写法（如 `[1,1,3]\n[2,2,4]`） */
function normalizeAdjacentArrayLiterals(expr: string): string {
  return expr.replace(/\]([\s\n\r]*)\[/g, "],$1[");
}

function evalJsExpression(expr: string): unknown {
  const trimmed = expr.trim();
  if (!trimmed) throw new Error("属性值不能为空");
  const normalized = normalizeAdjacentArrayLiterals(trimmed);
  try {
    // Demo 调试专用：解析数组/字符串等字面量
    return new Function(`return (${normalized})`)();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "表达式无效";
    const missingCommaHint =
      /Unexpected token '\['|Unexpected number|Unexpected identifier/.test(msg)
        ? "；相邻数组元素之间可能缺少逗号"
        : "";
    throw new Error(`${msg}${missingCommaHint}：${trimmed.slice(0, 80)}${trimmed.length > 80 ? "…" : ""}`);
  }
}

function parseBraceBlock(text: string, openBraceIndex: number): { inner: string; endIndex: number } {
  if (text[openBraceIndex] !== "{") throw new Error(`位置 ${openBraceIndex} 处应为 {`);
  let depth = 0;
  let inString: "'" | '"' | null = null;
  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === inString && text[i - 1] !== "\\") inString = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      inString = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { inner: text.slice(openBraceIndex + 1, i), endIndex: i + 1 };
      }
    }
  }
  throw new Error("存在未闭合的 {");
}

/** 去掉可选的 <Component ... /> 包裹，只保留属性部分 */
function normalizeDemoPropInput(text: string): string {
  const trimmed = text.trim();
  const wrapped = trimmed.match(/^<[A-Za-z]\w*\s+([\s\S]*?)\/?>$/);
  if (wrapped) return wrapped[1]!.trim();
  return trimmed;
}

/** 解析 JSX 属性格式入参，例如 rows={[4]} cells={[[1,1,3]]} */
export function parseDemoPropAttributes(text: string): Record<string, unknown> {
  const source = normalizeDemoPropInput(text);
  if (!source) return {};

  const props: Record<string, unknown> = {};
  let i = 0;

  while (i < source.length) {
    while (i < source.length && /[\s,]/.test(source[i]!)) i++;
    if (i >= source.length) break;

    const rest = source.slice(i);
    const nameMatch = /^([a-zA-Z_]\w*)\s*=\s*\{/.exec(rest);
    if (!nameMatch) {
      throw new Error(`无法解析属性：${rest.slice(0, 48).trim()}…`);
    }

    const key = nameMatch[1]!;
    i += nameMatch[0].length - 1;
    const { inner, endIndex } = parseBraceBlock(source, i);
    i = endIndex;
    props[key] = evalJsExpression(inner);
  }

  return props;
}

/** @deprecated 使用 parseDemoPropAttributes */
export function parseDemoProps(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "JSON 解析失败";
      throw new Error(msg);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error('入参必须是 JSON 对象，例如 { "rows": [4], "cells": [] }');
    }
    return parsed as Record<string, unknown>;
  }
  return parseDemoPropAttributes(text);
}

/** @deprecated 使用 serializeDemoPropAttributes */
export function serializeDemoProps(props: Record<string, unknown>): string {
  return serializeDemoPropAttributes(props);
}
