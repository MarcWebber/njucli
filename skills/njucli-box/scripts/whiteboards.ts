import { randomInt, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { AppError } from "../../../src/core/errors.js";

const elementSchema = z.object({
  id: z.string().min(1), type: z.string().min(1),
  x: z.number(), y: z.number(), width: z.number().nonnegative(), height: z.number().nonnegative(),
  version: z.number().int().positive(),
}).passthrough();
export const whiteboardContentSchema = z.object({ elements: z.array(elementSchema) });
export const whiteboardSnapshotSchema = whiteboardContentSchema.extend({
  repoId: z.string().min(1), path: z.string().startsWith("/"), fileUuid: z.string().uuid(),
  version: z.number().int().nonnegative(),
});
export type WhiteboardContent = z.output<typeof whiteboardContentSchema>;
export type WhiteboardSnapshot = z.output<typeof whiteboardSnapshotSchema>;

export function checkWhiteboardEdit(content: WhiteboardContent, base?: WhiteboardSnapshot): void {
  const ids = new Set<string>();
  for (const element of content.elements) {
    if (ids.has(element.id)) throw new AppError("INVALID_INPUT", "白板元素 id 须各自唯一");
    ids.add(element.id);
    const original = base?.elements.find((item) => item.id === element.id);
    if (original && isDeepStrictEqual(original, element)) continue;
    if (!["rectangle", "diamond", "ellipse", "text", "arrow", "line", "freedraw", "frame"].includes(element.type)) {
      throw new AppError("INVALID_INPUT", "白板输入支持原生形状、文字、连线、手绘与画框；已有图片等元素请保留原样，在网页中编辑");
    }
    if (element.type === "text" && (typeof element.text !== "string" || typeof element.fontSize !== "number" || element.fontSize <= 0)) {
      throw new AppError("INVALID_INPUT", "白板文字需要 text 和正数 fontSize");
    }
    if (["arrow", "line", "freedraw"].includes(element.type) &&
      !z.array(z.tuple([z.number(), z.number()])).min(2).safeParse(element.points).success) {
      throw new AppError("INVALID_INPUT", "白板线条需要至少两个 points 坐标");
    }
    if (original && element.version <= original.version) {
      throw new AppError("INVALID_INPUT", "修改已有白板元素时，请递增该元素的 version");
    }
  }
}

export const chartSchema = z.object({
  title: z.string().trim().min(1), kind: z.enum(["bar", "line"]),
  labels: z.array(z.string().trim().min(1)).min(1),
  series: z.array(z.object({ name: z.string().trim().min(1), values: z.array(z.number()).min(1) })).min(1),
  yLabel: z.string().optional(),
}).superRefine((chart, ctx) => {
  if (chart.series.some((series) => series.values.length !== chart.labels.length)) {
    ctx.addIssue({ code: "custom", message: "每组 values 的数量须与 labels 相同" });
  }
});

// Excalidraw's native vector format is also the NJU Box whiteboard format.
// Keeping charts as ordinary elements lets users edit their labels and shapes online.
export function chartWhiteboard(chart: z.output<typeof chartSchema>): WhiteboardContent {
  const elements: WhiteboardContent["elements"] = [];
  const shape = (type: string, x: number, y: number, width: number, height: number, extra: Record<string, unknown> = {}) => {
    elements.push({
      id: randomUUID(), type, x, y, width, height, angle: 0, strokeColor: "#334155", backgroundColor: "transparent",
      fillStyle: "solid", strokeWidth: 2, strokeStyle: "solid", roughness: 0, opacity: 100,
      groupIds: [], frameId: null, roundness: null, seed: randomInt(1, 2 ** 30), version: 1,
      versionNonce: randomInt(1, 2 ** 30), isDeleted: false, boundElements: null, updated: Date.now(), link: null, locked: false,
      ...extra,
    });
  };
  const textWidth = (value: string, size: number) => Math.max(...value.split("\n").map((line) =>
    [...line].reduce((sum, char) => sum + (char.codePointAt(0)! > 255 ? size : size * 0.6), 0)));
  const text = (x: number, y: number, value: string, size = 20, color = "#334155") => shape("text", x, y,
    textWidth(value, size), value.split("\n").length * size * 1.25, {
      text: value, originalText: value, fontSize: size, fontFamily: 2, textAlign: "left", verticalAlign: "top",
      containerId: null, lineHeight: 1.25, autoResize: true, strokeColor: color,
    });
  const line = (x: number, y: number, dx: number, dy: number, color = "#94a3b8") => shape("line", x, y, Math.abs(dx), Math.abs(dy), {
    points: [[0, 0], [dx, dy]], startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null, strokeColor: color,
  });
  const colors = ["#3b82f6", "#16a34a", "#9333ea", "#ea580c", "#db2777", "#0891b2"];
  const slot = Math.max(100, ...chart.labels.map((label) => textWidth(label, 22) + 28), chart.series.length * 38);
  const width = Math.max(1000, chart.labels.length * slot), height = 260, left = 100, top = 140;
  const values = chart.series.flatMap((series) => series.values);
  const min = Math.min(0, ...values), max = Math.max(0, ...values);
  const span = max - min || 1;
  if (!Number.isFinite(span)) throw new AppError("INVALID_INPUT", "图表数值范围过大，请先换算单位");
  const y = (value: number) => top + (1 - (value - min) / span) * height;
  const labelY = top + height + 42;
  const legendTop = labelY + 35 + Math.max(...chart.labels.map((label) => label.split("\n").length)) * 28;
  // SeaDoc overlays the whiteboard filename at the top of its preview; reserve visible padding.
  shape("rectangle", 0, -40, width + left + 90, legendTop + chart.series.length * 32 + 70, {
    backgroundColor: "#ffffff", strokeColor: "#ffffff", strokeWidth: 1, locked: true,
  });
  text(left, 28, chart.title, 32);
  if (chart.yLabel) text(left, 90, chart.yLabel, 18);
  for (let tick = 0; tick <= 4; tick++) {
    const value = min + span * tick / 4, label = Number(value.toPrecision(4)).toString();
    line(left, y(value), width, 0, "#e2e8f0");
    text(left - textWidth(label, 18) - 15, y(value) - 11, label, 18);
  }
  line(left, y(0), width, 0, "#64748b");
  chart.labels.forEach((label, index) => text(left + width * (index + 0.5) / chart.labels.length - textWidth(label, 22) / 2, labelY, label, 22));
  chart.series.forEach((series, seriesIndex) => {
    const color = colors[seriesIndex % colors.length]!;
    const barWidth = width / chart.labels.length * 0.7 / chart.series.length;
    let previous: [number, number] | undefined;
    series.values.forEach((value, index) => {
      const center = left + width * (index + 0.5) / chart.labels.length;
      if (chart.kind === "bar") {
        const x = center - barWidth * chart.series.length / 2 + barWidth * seriesIndex;
        shape("rectangle", x + 3, Math.min(y(value), y(0)), barWidth - 6, Math.abs(y(value) - y(0)), {
          backgroundColor: color, strokeColor: color, strokeWidth: 1,
        });
        const label = String(value);
        text(x + barWidth / 2 - textWidth(label, 18) / 2, y(value) + (value < 0 ? 6 : -26), label, 18, color);
      } else {
        if (previous) line(previous[0], previous[1], center - previous[0], y(value) - previous[1], color);
        shape("ellipse", center - 5, y(value) - 5, 10, 10, { backgroundColor: color, strokeColor: color });
        previous = [center, y(value)];
      }
    });
    const legendY = legendTop + seriesIndex * 32;
    shape("rectangle", left, legendY, 20, 20, { backgroundColor: color, strokeColor: color });
    text(left + 32, legendY - 2, series.name, 20);
  });
  return { elements };
}
