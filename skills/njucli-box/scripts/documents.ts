import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { AppError } from "../../../src/core/errors.js";

// Preserve native block attributes so editing text does not discard existing rich content.
export const documentContentSchema = z.object({
  format_version: z.literal(4),
  elements: z.array(z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    children: z.array(z.record(z.string(), z.unknown())).min(1),
  }).passthrough()).min(1),
});
export const documentSnapshotSchema = documentContentSchema.extend({
  repoId: z.string().min(1),
  path: z.string().startsWith("/"),
  docUuid: z.string().uuid(),
  version: z.number().int().nonnegative(),
});
export type DocumentContent = z.output<typeof documentContentSchema>;
export type DocumentSnapshot = z.output<typeof documentSnapshotSchema>;

const textLeafSchema = z.object({ id: z.string().min(1), text: z.string(), type: z.undefined().optional(), children: z.undefined().optional() });
const inlineLinkSchema = z.object({
  id: z.string().min(1), type: z.literal("link"), href: z.url({ protocol: /^https?$/ }),
  title: z.string(), children: z.array(textLeafSchema).min(1),
});
const textBlockSchema = z.object({
  type: z.enum(["title", "header2", "paragraph"]),
  children: z.array(z.union([textLeafSchema, inlineLinkSchema])).min(1),
});
const whiteboardBlockSchema = z.object({
  type: z.literal("whiteboard"), repo_id: z.string().uuid(), title: z.string().min(1),
  file_path: z.string().startsWith("/").endsWith(".exdraw"),
  link: z.url().startsWith("https://box.nju.edu.cn/smart-link/"),
  children: z.array(z.object({ id: z.string().min(1), text: z.literal("") })).length(1),
});

export function checkDocumentEdit(content: DocumentContent, base?: DocumentSnapshot): void {
  if (content.elements[0]?.type !== "title" || content.elements.slice(1).some((node) => node.type === "title")) {
    throw new AppError("INVALID_INPUT", "文档须以一个 title 标题块开始");
  }
  const ids = new Set<string>();
  const collectIds = (nodes: unknown[]) => {
    for (const value of nodes) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("INVALID_INPUT", "文档节点须为 JSON 对象");
      const node = value as Record<string, unknown>;
      if (typeof node.id !== "string" || !node.id || ids.has(node.id)) throw new AppError("INVALID_INPUT", "文档块与文本节点须使用各自唯一的 id");
      ids.add(node.id);
      if (Array.isArray(node.children)) collectIds(node.children);
    }
  };
  collectIds(content.elements);
  for (const node of content.elements) {
    if (base?.elements.some((original) => isDeepStrictEqual(original, node))) continue;
    if (!textBlockSchema.safeParse(node).success && !whiteboardBlockSchema.safeParse(node).success) {
      throw new AppError("INVALID_INPUT", "新增或修改支持 title、header2、paragraph 和 whiteboard 块；已有其他内容请保持原样");
    }
  }
}

export async function readDocumentInput<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const text = await readFile(path, "utf8");
  let data: unknown;
  try { data = JSON.parse(text); }
  catch { throw new AppError("INVALID_INPUT", "文档输入文件需要合法 JSON"); }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new AppError("INVALID_INPUT", `输入 JSON 字段有误（${issue.path.join(".") || "根节点"}）：${issue.message}`);
  }
  return parsed.data;
}
