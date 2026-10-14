import { load } from "cheerio";
import { AppError } from "../../../src/core/errors.js";
import type { Institution, LogisticsService } from "./types.js";

const SPECIAL_IDS: Record<string, string> = {
  "经济学院": "nubs-economics", "管理学院": "nubs-management",
  "化工学院": "chemical-engineering", "先进制造学院": "advanced-manufacturing", "药学院": "pharmacy",
};
const CATEGORY_PREFIXES: Record<string, string> = { "党群组织": "party", "行政部门": "admin", "基础教学科研单位与高等研究院": "research", "直属单位": "direct" };

export function parseInstitutionDirectory(html: string, fetchedAt: string, url = "https://www.nju.edu.cn/xybm.htm"): Institution[] {
  const $ = load(html);
  const source = { url, fetchedAt, selector: ".yxbm" };
  const items: Institution[] = [];
  for (const group of $(".yxbm > ul").toArray()) {
    const category = $(group).children("h3").text().trim();
    if (!category) throw new AppError("REMOTE_SCHEMA_CHANGED", "机构目录缺少分类标题");
    for (const row of $(group).children("li").toArray()) {
      const primary = $(row).children("h4").children("a").first();
      const name = primary.text().trim();
      if (!name) throw new AppError("REMOTE_SCHEMA_CHANGED", "机构目录缺少名称");
      const make = (name: string, href: string | undefined, parentId?: string): Institution => {
        if (!name) throw new AppError("REMOTE_SCHEMA_CHANGED", "机构目录缺少子机构名称");
        const target = href?.trim() ? new URL(href.trim(), url) : undefined;
        if (target && !["https:", "http:"].includes(target.protocol)) throw new AppError("REMOTE_SCHEMA_CHANGED", "机构官网链接不是 HTTP 地址");
        const id = SPECIAL_IDS[name] ?? (category === "学院" && target ? target.hostname.split(".")[0]! : `${CATEGORY_PREFIXES[category] ?? category}-${name}`);
        return { id, name, category, source, ...(parentId ? { parentId } : {}), ...(target ? { url: target.href } : {}) };
      };
      const institution = make(name, primary.attr("href"));
      items.push(institution);
      for (const child of $(row).children(".bm-er").children("a").toArray()) items.push(make($(child).text().trim(), $(child).attr("href"), institution.id));
    }
  }
  if (!items.length) throw new AppError("REMOTE_SCHEMA_CHANGED", "官方机构目录为空");
  if (new Set(items.map(item => item.id)).size !== items.length) throw new AppError("REMOTE_SCHEMA_CHANGED", "官方机构目录存在重复标识，请核对机构关系");
  return items;
}

export function parseLogisticsServices(html: string, fetchedAt: string, url = "https://www.nju.edu.cn/xyfw/hqfw.htm"): LogisticsService[] {
  const $ = load(html);
  const source = { url, fetchedAt, selector: "#vsb_content_2 table" };
  const rows = $(source.selector).first().find("tr").toArray();
  const grid: string[][] = [];
  for (const [rowIndex, row] of rows.entries()) {
    const values = grid[rowIndex] ??= [];
    let column = 0;
    for (const cell of $(row).children("td, th").toArray()) {
      while (values[column] !== undefined) column++;
      const value = $(cell).text().replace(/\s+/g, " ").trim();
      const height = Number($(cell).attr("rowspan") ?? 1);
      const width = Number($(cell).attr("colspan") ?? 1);
      if (!Number.isSafeInteger(height) || !Number.isSafeInteger(width) || height < 1 || width < 1 || rowIndex + height > rows.length || column + width > 3) throw new AppError("REMOTE_SCHEMA_CHANGED", "后勤表格合并单元格结构变化");
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) (grid[rowIndex + y] ??= [])[column + x] = value;
      column += width;
    }
  }
  if (grid[0]?.join("|") !== "单位|部门|办公电话") throw new AppError("REMOTE_SCHEMA_CHANGED", "后勤表格表头变化");
  const items: LogisticsService[] = [];
  for (const row of grid.slice(1)) {
    if (row.every(value => !value)) continue;
    const [unit, department, phone] = row;
    if (row.length !== 3 || !unit || !department || !phone) throw new AppError("REMOTE_SCHEMA_CHANGED", "后勤表格缺少单位、部门或办公电话");
    items.push({ unit, department, phone, source });
  }
  if (!items.length) throw new AppError("REMOTE_SCHEMA_CHANGED", "后勤服务表为空");
  return items;
}
