import { load } from "cheerio";
import { AppError } from "../../../src/core/errors.js";
import type { Institution, InstitutionSnapshot, KnowledgeRecord, LogisticsService } from "./types.js";

export function recordText(record: KnowledgeRecord): string {
  return [record.title, record.phone && `电话：${record.phone}`, record.email && `邮箱：${record.email}`, record.kind === "teacher" && !record.phone && !record.email && "联系方式：当前资料未收录，请核对官方来源", record.office && `办公地点：${record.office}`, [positionText(record), record.department].filter(Boolean).join(" · "), record.text && (record.kind === "teacher" ? `研究方向：${record.text}` : record.text), `来源：${record.source.url}`, `采集时间：${record.source.fetchedAt}`].filter(Boolean).join("\n");
}

function positionText(record: KnowledgeRecord): string {
  const values = [record.role, record.category].filter((value): value is string => Boolean(value));
  return [...new Set(values.flatMap(value => value.split(/[；·]/).map(part => part.trim()).filter(Boolean)))].join("；");
}

export function institutionContactText(institution: Institution): string {
  const contact = institution.contact;
  return contact ? [`${institution.name}办公联系方式`, contact.phone && `电话：${contact.phone}`, contact.email && `邮箱：${contact.email}`, `来源：${contact.source.url}`, `采集时间：${contact.source.fetchedAt}`].filter(Boolean).join("\n") : "";
}

function excerpt(text: string, limit: number): string {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

export function basicCategory(value: string): string {
  return [...new Set(value.split("；").map(part => {
    const text = part.trim();
    if (!/当前位置|^首页|[>»→]/.test(text)) return text;
    return text.replace(/当前位置\s*[：:]?\s*/g, "").split(/\s+|[>»→]/).filter(Boolean).at(-1) ?? "";
  }).filter(part => part && !/^(首页|师资队伍|教师名录|系部|职称)$/.test(part)))].join("；");
}

export function researchDirection(text: string): string {
  const value = text.replace(/[\u200b-\u200d\ufeff]/g, "").split(/(?:教授|讲授|开设|开授|主讲).{0,5}课程|(?:联系|联络|系)方式|联系(?:邮箱|电子邮箱|邮件|电话)|电子邮|邮箱|手机号|手机号码|电话号码|电话\s*[：:]|办公(?:地址|地点)|(?:同行评议期刊|代表性|代表|科研|学术|研究)?论文|(?:个人|教育|工作)(?:简介|简历|经历)|(?:社会|学术)兼职|主要获奖|科研项目|研究成果|主要学术(?:成果|成绩)|主持|承担|发表|出版|https?:|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:Teaching|Courses?|Publications|Contact|E-?mail)\b|(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)|(?<!\d)(?:0\d{2,3}[-\s]?)?\d{7,8}(?!\d)/i)[0]!
    .replace(/[；;，,\s]+$/, "").trim();
  return excerpt(value, 160);
}

export function contactEmail(value: string): string {
  const text = value.replace(/\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|（\s*at\s*）)\s*|\s+at\s+/gi, "@").replace(/\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|（\s*dot\s*）)\s*|\s+dot\s+/gi, ".");
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match && !/^(?:\.{2,}|…)/.test(text.slice(match.index! + match[0].length)) && !/^(?:username|yourname|your\.name|example|xxx+)@/i.test(match[0]) ? match[0] : "";
}

export function basicTeacher(text: string, name = ""): { text: string; role: string; phone: string; email: string; office: string } {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const labeled = (labels: string): string[] => {
    const pattern = new RegExp(`(?:^|[\\s，。；;])(?:${labels})\\s*[：:]\\s*(.*)|^(?:${labels})$`, "i");
    const values: string[] = [];
    for (const [index, line] of lines.entries()) {
      const match = line.match(pattern);
      if (!match) continue;
      const value = (match[1]?.trim() || lines[index + 1] || "").split(/(?:\s|[，。；;])(?:姓名|职称|职务|学系|电话|传真|联系邮箱|邮箱|电子邮箱|电子邮件|电子信箱|邮件|办公地址|办公地点|邮编|Email|E-mail|Mail|Phone|Fax|Office|Title|Position)\s*[：:]/i)[0]!.trim();
      if (value && !/^(?:电话|传真|联系邮箱|邮箱|电子邮箱|电子邮件|电子信箱|邮件|地址|办公地址|办公地点|邮编|职称|Email|E-mail|Mail|Phone|Fax|Office|Title|Position)\s*[：:]/i.test(value) && !/^(?:个人简介|个人简历|个人情况|研究方向|研究成果|教育经历|工作经历|联系方式)$/.test(value)) values.push(value);
    }
    return values;
  };
  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phonePattern = /\+?[\d(（][\d\s()（）-]{6,}\d(?:\s*(?:转|ext\.?|extension)\s*\d+)?/gi;
  const date = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/;
  const phoneValues = labeled("联系电话|办公电话|办公室电话|电话|手机|联系方式|联络方式|系方式|Phone|Telephone|Tel\\.?").flatMap(value => value.match(phonePattern) ?? []).map(value => value.trim()).filter(value => !date.test(value));
  const phone = [...new Set(phoneValues)].join("；") || lines.slice(0, 6).find((line, index) => !date.test(line) && !/^(Fax|传真)/i.test(lines[index - 1] ?? "") && /^\+?[\d(（][\d\s()（）-]{6,}\d$/.test(line)) || "";
  const email = labeled("联系邮箱|电子邮箱|电子邮件|电子信箱|信箱|邮箱|邮件|联系方式|联络方式|系方式|Email|E-mail|E_mail|Mail").map(contactEmail).find(Boolean) ?? lines.slice(0, 25).map(line => { const email = contactEmail(line); return email === line ? email : ""; }).find(Boolean) ?? "";
  const officeValue = labeled("办公地址|办公地点|办公室地址|办公室|Office(?: address)?")[0] ?? "";
  const office = officeValue && !emailPattern.test(officeValue) && !/https?:|个人网页|个人主页|课题组主页/.test(officeValue) ? excerpt(officeValue, 100) : "";
  const heading = /^(?:主要)?(?:研究方向|研究领域|研究兴趣|研究内容|Research Interests|Research Areas|Research Fields)\s*(?:[：:]\s*(.*)|$)/i;
  const section = /^[★◆◇·•\d、.（）()\s]*(?:(?:主要|代表性|最新)?(?:个人简介|个人简历|教育|工作|经历|教学|研究成果|开设.{0,5}课程|开授.{0,5}课程|课程|科研|学术|成果|论文|著作|奖励|荣誉|项目|联系方式|电子邮|邮箱|电话|办公|招生|主持|承担|发表|出版|欢迎)|主要承担|Publications|Education|Teaching|Projects|Awards|Contact|Employment|Biography|Email|Tel)/i;
  const contentLine = researchDirection;
  let direction = "";
  for (const [index, line] of lines.entries()) {
    const match = line.match(heading);
    if (!match) continue;
    const content = match[1] && !section.test(match[1]) ? [contentLine(match[1])].filter(Boolean) : [];
    for (const next of lines.slice(index + 1, index + 4)) {
      if (section.test(next) || heading.test(next)) break;
      const value = contentLine(next);
      if (!value) break;
      content.push(value);
    }
    if (content.length) { direction = researchDirection(content.join("；")); break; }
  }
  const rank = /准聘副教授|准聘助理教授|长聘副教授|特聘教授|副教授|助理教授|教授|特任助理研究员|副研究员|助理研究员|专职研究员|特聘研究员|研究员|讲师|高级工程师|工程师|主任医师|副主任医师|主治医师|医师|博士后|院士|助教|Associate Professor|Assistant Professor|Professor|Lecturer/i;
  const labeledRole = labeled("职称|专业技术职务|职务|Title|Position").find(value => rank.test(value) || /院长|主任|书记|主管/.test(value)) ?? "";
  let role = labeledRole && (rank.test(labeledRole) || /院长|主任|书记|主管/.test(labeledRole)) ? labeledRole : "";
  if (!role) role = lines.slice(0, 25).find(line => line.length < 60 && !/(?:教授|讲授|开设|开授).{0,5}课程/.test(line) && (rank.test(line) && (line.match(rank)?.[0] === line || /^(?:[^|]+\|\s*)?(?:教授|副教授|助理教授|准聘|特聘|讲师|博士后|中科院院士|中国科学院院士)/.test(line)))) ?? "";
  if (!role) role = text.match(/(?:现任|目前任|现为)[^。；\n]{0,80}/)?.[0]?.match(rank)?.[0] ?? "";
  if (!role) role = lines.find(line => /^(?:教授|副教授|博士|文学博士|理学博士|工学博士)[，、,\s]/.test(line))?.match(rank)?.[0] ?? "";
  if (!role && name) {
    const identity = lines.slice(0, 25).find(line => line.replace(/\s/g, "").startsWith(name.replace(/\s/g, "")))?.slice(0, 120).split(/[。；]/)[0];
    const match = identity?.match(rank);
    if (match && !/年|毕业|曾|晋升|获聘|入选/.test(identity!.slice(0, match.index))) role = match[0];
  }
  if (name && role.split("|")[0]?.replace(/\s/g, "") === name.replace(/\s/g, "")) role = role.split("|").slice(1).join("|").trim();
  role = role.split(/研究方向|研究领域|研究兴趣/)[0]!.replace(/[，、,\s]+$/, "");
  return { text: direction, role: excerpt(role, 60), phone, email, office };
}

export function basicOverview(text: string): string {
  const paragraph = text.split(/\r?\n/).map(line => line.trim()).find(line => line.length >= 35 && !/^(?:https?:|发布日期|发布时间|字体|当前位置)/.test(line)) ?? "";
  return excerpt(paragraph, 400);
}

function cell(value: string): string { return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " "); }

export function institutionFilename(institution: Institution): string {
  return `${institution.name.replace(/[\\/:*?"<>|]/g, "-")}.md`;
}

export function snapshotJson(snapshot: InstitutionSnapshot): string {
  const sections = { institutions: snapshot.institutions, records: snapshot.records, services: snapshot.services, coverage: snapshot.coverage };
  return `{\n  "schemaVersion": ${snapshot.schemaVersion},\n  "generatedAt": ${JSON.stringify(snapshot.generatedAt)},\n${Object.entries(sections).map(([name, items]) => `  "${name}": [\n${items.map(item => `    ${JSON.stringify(item)}`).join(",\n")}\n  ]`).join(",\n")}\n}\n`;
}

export function directoryMarkdown(snapshot: InstitutionSnapshot): string {
  return ["# 机构目录", "", `快照时间：${snapshot.generatedAt}`, "", "| ID | 名称 | 分类 | 官网 |", "| --- | --- | --- | --- |", ...snapshot.institutions.map(item => `| ${cell(item.id)} | ${cell(item.name)} | ${cell(item.category)} | ${item.url ? `[官网](${item.url})` : "—"} |`), ""].join("\n");
}

export function institutionMarkdown(institution: Institution, snapshot: InstitutionSnapshot): string {
  const records = snapshot.records.filter(record => record.institutionId === institution.id);
  const coverage = snapshot.coverage.find(item => item.institutionId === institution.id);
  const lines = [`# ${institution.name}`, "", `机构 ID：${institution.id}；分类：${institution.category}`, `快照时间：${snapshot.generatedAt}`, ...(institution.url ? [`官网：${institution.url}`] : []), ""];
  if (institution.contact) lines.push("## 办公联系方式", "", institutionContactText(institution).split("\n").slice(1).join("\n\n"), "");
  for (const record of records.filter(item => item.kind === "overview")) lines.push("## 学院简介", "", record.text, "", `来源：${record.source.url}`, "");
  const teachers = records.filter(item => item.kind === "teacher");
  if (teachers.length) {
    if (coverage?.rosterSource) lines.push(`师资名录来源：${coverage.rosterSource.url}`, "");
    lines.push("## 教师名录", "", "| 姓名 | 职称/身份 | 单位 | 电话 | 邮箱 | 办公地点 | 来源 |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const record of teachers) {
      lines.push(`| ${cell(record.title)} | ${cell(positionText(record) || "职称待核对")} | ${cell(record.department ?? "—")} | ${cell(record.phone || "—")} | ${cell(record.email || "—")} | ${cell(record.office || "—")} | [来源](${record.source.url}) |`);
    }
    lines.push("");
  }
  if (coverage?.notes.length) lines.push("## 资料说明", "", ...coverage.notes.map(note => `- ${note}`), "");
  return lines.join("\n");
}

export function servicesMarkdown(services: LogisticsService[]): string {
  return ["# 后勤电话", "", ...(services[0] ? [`来源：${services[0].source.url}`, `采集时间：${services[0].source.fetchedAt}`, ""] : []), "| 单位 | 部门 | 办公电话 |", "| --- | --- | --- |", ...services.map(item => `| ${cell(item.unit)} | ${cell(item.department)} | ${cell(item.phone)} |`), ""].join("\n");
}

export function decodeHtml(bytes: Uint8Array, contentType: string | null): string {
  const declaredCharset = (value: string) => value.match(/(?:^|;)\s*charset\s*=\s*["']?([\w-]+)["']?\s*(?:;|$)/i)?.[1];
  let charset = declaredCharset(contentType ?? "");
  if (!charset) {
    const $ = load(new TextDecoder().decode(bytes));
    for (const element of $("meta").toArray()) {
      const meta = $(element);
      const direct = meta.attr("charset")?.trim();
      charset = direct && /^[\w-]+$/.test(direct) ? direct
        : meta.attr("http-equiv")?.toLowerCase() === "content-type" ? declaredCharset(meta.attr("content") ?? "") : undefined;
      if (charset) break;
    }
  }
  return new TextDecoder(charset ?? "utf-8").decode(bytes);
}

export function extractText(html: string, selector: string): string {
  const $ = load(html);
  const selected = $(selector);
  const elements = new Set(selected.toArray());
  const content = selected.filter((_, element) => !$(element).parents().toArray().some(parent => elements.has(parent))).clone();
  if (!content.length) throw new AppError("REMOTE_SCHEMA_CHANGED", `正文选择器未匹配：${selector}`);
  content.find("script,style,noscript,iframe,nav").remove();
  content.find("br").replaceWith("\n");
  content.find("p,div,li,tr,h1,h2,h3,h4,h5,section").append("\n");
  const text = content.toArray().map(element => $(element).text()).join("\n")
    .replace(/\u00a0/g, " ").split(/\r?\n/)
    .map(line => line.replace(/[\t ]+/g, " ").trim()).filter(Boolean).join("\n");
  if (!text) throw new AppError("REMOTE_SCHEMA_CHANGED", `正文为空：${selector}`);
  return text;
}
