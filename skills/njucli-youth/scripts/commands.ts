import { Option, type Command } from "commander";

import type { YouthServices } from "./services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import { ACTIVITY_STATES, AWARD_KINDS, type ActivityState, type AwardKind, type YouthDocument, type YouthListOptions, type YouthPage, type YouthRow } from "./client.js";
import { optionalPositiveInteger } from "../../../src/core/options.js";

type ListOptions = FormatOptions & { page?: string; size?: string; year?: string };

export function registerYouthCommands(program: Command, service: YouthServices, runtime: CommandRuntime): Command {
  const youth = program.command("youth").description("第二课堂、志愿服务、社会实践与社团");

  addFormatOption(youth.command("profile").description("查看当前身份与志愿者资料"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.profile();
      return { data, text: `${data.name} · ${data.studentId} · ${data.department}\n${documentText(data.volunteer)}` };
    }));
  addFormatOption(youth.command("menus").description("列出当前账号的青年平台功能入口"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.menus();
      return { data, text: data.map((menu) => `${menu.name}\n${menu.url}`).join("\n\n") };
    }));
  addFormatOption(youth.command("years").description("列出学年与筛选 ID"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.years();
      return { data, text: data.map((year) => `${year.id}  ${year.name}`).join("\n") };
    }));
  addFormatOption(youth.command("hours").description("查询已认定志愿时长与参与活动数").option("--year <id>", "学年 ID；省略为全部学年"))
    .action(async (options: FormatOptions & { year?: string }) => runCommand(runtime, options, async () => {
      const data = await service.hours(options.year);
      return { data, text: `${data.year ?? "全部学年"}：志愿服务 ${data.hours} 小时，参与 ${data.activities} 次活动` };
    }));

  const activities = paging(youth.command("activities [query]").description("查询志愿活动；--mine 查看自己的报名与时长")
    .option("--mine", "我的活动")
    .option("--year <id>", "我的活动学年 ID")
    .addOption(new Option("--state <state>", "活动状态").choices(ACTIVITY_STATES).default("recruiting")));
  activities.action(async (query: string | undefined, options: ListOptions & { mine?: boolean; state: ActivityState }) => runCommand(runtime, options, async () => {
    const data = await service.activities({ ...listOptions(options), query, mine: options.mine, state: options.state });
    return { data, text: [`第 ${data.page} 页 · 共 ${data.total} 项`, ...data.items.map((item) => [
      `${item.name}（${item.id}）`, `${item.organizer} · ${item.location} · ${item.year ?? "未设置学年"}`,
      `活动：${dateText(item.startsAt)} — ${dateText(item.endsAt)}`,
      `报名：${dateText(item.registrationStartsAt)} — ${dateText(item.registrationEndsAt)}`,
      item.registrationId ? `报名记录 ${item.registrationId} · ${item.registrationStatus} · ${item.hours === null ? "时长待认定" : `${item.hours} 小时`}` : item.enrolled ? "已报名" : "未报名",
    ].join("\n"))].join("\n\n") };
  }));

  detail("activity", "志愿活动说明与报名要求", service.activity);
  addFormatOption(youth.command("enroll <id>").description("报名指定志愿活动并回读报名记录")
    .requiredOption("--understanding <text>", "对本活动的认识")
    .requiredOption("--strengths <text>", "自我优势")
    .requiredOption("--qq <number>", "QQ 号码")
    .option("--password <password>", "活动报名密码（如需要）"))
    .action(async (id: string, options: FormatOptions & { understanding: string; strengths: string; qq: string; password?: string }) => runCommand(runtime, options, async () => {
      const data = await service.enroll(id, options);
      return { data, text: `已报名：${data.name}\n报名记录 ${data.registrationId} · ${data.registrationStatus}` };
    }));
  addFormatOption(youth.command("cancel <registration-id>").description("取消指定志愿活动报名并回读确认"))
    .action(async (id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.cancel(id);
      return { data, text: `已取消报名记录 ${data.registrationId}` };
    }));
  addFormatOption(youth.command("rate <registration-id>").description("评价已参加活动并回读确认")
    .requiredOption("--stars <1-5>", "评价星级")
    .requiredOption("--comment <text>", "评价内容"))
    .action(async (id: string, options: FormatOptions & { stars: string; comment: string }) => runCommand(runtime, options, async () => {
      const stars = optionalPositiveInteger(options.stars, "--stars")!;
      if (stars > 5) throw new AppError("INVALID_INPUT", "--stars 必须为 1 至 5");
      const data = await service.rate(id, stars, options.comment);
      return { data, text: `已保存 ${data.stars} 星评价：${data.comment}` };
    }));

  list("teams", "志愿服务组织", service.teams, "mc", true);
  detail("team", "志愿服务组织介绍", service.team);
  list("trainings", "志愿者培训与报名状态", service.trainings, "mc", true);
  for (const [name, description, operation] of [
    ["training-enroll", "报名指定志愿者培训", service.enrollTraining],
    ["training-cancel", "取消指定志愿者培训报名", service.cancelTraining],
  ] as const) {
    addFormatOption(youth.command(`${name} <id>`).description(description))
      .action(async (id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
        const data = await operation(id);
        return { data, text: `${rowName(data, "mc")} · ${data.bmzt ? "已报名" : "未报名"}` };
      }));
  }

  list("categories", "第二课堂申请类别、填报说明与开放时间", service.categories, "bt");
  list("applications", "我的第二课堂申请", service.applications, "mc");
  detail("application", "第二课堂申请内容与审核记录", service.application);
  list("transcript", "我的第二课堂成绩单明细", service.transcript, "mc", true);
  addFormatOption(youth.command("transcript-export").description("下载我的第二课堂成绩单 PDF").requiredOption("--output <path>", "本地 PDF 输出文件"))
    .action(async (options: FormatOptions & { output: string }) => runCommand(runtime, options, async () => {
      const data = await service.exportTranscript(options.output);
      return { data, text: `已保存 ${data.path}（${data.bytes} 字节）` };
    }));
  list("courses", "青马课程报名中心", service.courses, "mc");
  detail("course", "青马课程说明", service.course);
  list("course-grades", "我的青马课程成绩", service.courseGrades, "xm");
  list("practices", "我的社会实践", service.practices, "tdmc");
  detail("practice", "我的社会实践详情", service.practice);
  list("practice-teams", "社会实践团队招募", service.practiceTeams, "tdmc", true, true);
  detail("practice-team", "社会实践团队介绍", service.practiceTeam);
  list("practice-resources", "社会实践资料库", service.practiceResources, "tdmc", true, true);
  detail("practice-resource", "社会实践资料详情", service.practiceResource);
  list("practice-journals", "我的社会实践行程记录", service.practiceJournals, "mc");

  paging(youth.command("clubs").description("全校社团与入社状态")
    .option("--mine", "我加入的社团")
    .option("--category <id>", "社团类别 ID")
    .option("--stars <stars>", "社团星级")
    .option("--department <id>", "指导单位 ID"))
    .action(async (options: ListOptions & { mine?: boolean; category?: string; stars?: string; department?: string }) => runCommand(runtime, options, async () => {
      const data = await service.clubs({ ...listOptions(options), mine: options.mine, category: options.category, stars: options.stars, department: options.department });
      return { data, text: pageText(data, "qc") };
    }));
  detail("club", "社团介绍与入社要求", service.club);

  for (const [name, description, operation, title, keyword] of [
    ["jobs", "实习岗位与我的报名", service.jobs, "mc", true],
    ["recruitments", "学生骨干招募与我的报名", service.recruitments, "gzz.name", false],
    ["tickets", "票务活动与我的票券", service.tickets, "mc", true],
  ] as const) {
    paging(youth.command(`${name}${keyword ? " [query]" : ""}`).description(description).option("--mine", "查询我的记录"))
      .action(async (...args: [string | undefined, ListOptions & { mine?: boolean }] | [ListOptions & { mine?: boolean }]) => {
        const query = keyword ? args[0] as string | undefined : undefined;
        const options = args[keyword ? 1 : 0] as ListOptions & { mine?: boolean };
        return runCommand(runtime, options, async () => {
          const data = await operation({ ...listOptions(options), query, mine: options.mine });
          return { data, text: pageText(data, title) };
        });
      });
  }

  paging(youth.command("awards").description("社会实践与志愿者评选记录")
    .addOption(new Option("--kind <kind>", "team/report/student/advisor/volunteer").choices(AWARD_KINDS).default("student")))
    .action(async (options: ListOptions & { kind: AwardKind }) => runCommand(runtime, options, async () => {
      const data = await service.awards(options.kind, listOptions(options));
      return { data, text: pageText(data, "mc") };
    }));
  list("projects", "科创作品申报记录", service.projects, "mc");
  list("complaints", "我的志愿服务投诉记录", service.complaints, "tszz.mc");
  return youth;

  function paging(command: Command): Command {
    return addFormatOption(command.option("--page <page>", "页码，从 1 开始").option("--size <size>", "每页条数"));
  }

  function list(name: string, description: string, operation: (options?: YouthListOptions) => Promise<YouthPage>, title: string, keyword = false, year = false): void {
    const command = paging(youth.command(`${name}${keyword ? " [query]" : ""}`).description(description));
    if (year) command.option("--year <id>", "学年 ID");
    command.action(async (...args: [string | undefined, ListOptions] | [ListOptions]) => {
      const query = keyword ? args[0] as string | undefined : undefined;
      const options = args[keyword ? 1 : 0] as ListOptions;
      return runCommand(runtime, options, async () => {
        const data = await operation({ ...listOptions(options), query });
        return { data, text: pageText(data, title) };
      });
    });
  }

  function detail(name: string, description: string, operation: (id: string) => Promise<YouthDocument>): void {
    addFormatOption(youth.command(`${name} <id>`).description(description))
      .action(async (id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
        const data = await operation(id);
        return { data, text: documentText(data) };
      }));
  }
}

function listOptions(options: ListOptions): YouthListOptions {
  return { page: optionalPositiveInteger(options.page, "--page"), size: optionalPositiveInteger(options.size, "--size"), year: options.year };
}

function rowName(row: YouthRow, field: string): string {
  let value: unknown = row;
  for (const key of field.split(".")) value = (value as Record<string, unknown> | null)?.[key];
  return typeof value === "string" ? value : String(row.id);
}

function pageText(page: YouthPage, title: string): string {
  const labels: Record<string, string> = { sqks: "申请开始", sqjs: "申请截止", sqyq: "申请要求", bmks: "报名开始", bmjs: "报名截止", bksqyy: "申请说明", sqsj: "申请时间", shsj: "审核时间", fwzsc: "志愿时长", fzrlxfs: "负责人联系方式", pxjj: "培训介绍", dqrsfksq: "可申请", bmzt: "已报名", syzt: "报名开放", dwMc: "指导单位", lbMc: "类别", sfrs: "已入社", sfksqrs: "可申请入社", rs: "人数" };
  const rows = page.items.map((row) => {
    const values = Object.entries(row).filter(([key, value]) => Object.hasOwn(labels, key) && value !== null);
    return [`${rowName(row, title)}（${row.id}）`, ...values.map(([key, value]) => `${labels[key]}：${typeof value === "boolean" ? value ? "是" : "否" : dateText(String(value))}`)].join("\n");
  });
  return `第 ${page.page} 页 · 共 ${page.total} 项\n${rows.length ? rows.join("\n\n") : "暂无记录"}`;
}

function dateText(value: string | null): string {
  if (!value) return "未设置";
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function documentText(document: YouthDocument): string {
  return `${document.text}\n\n${document.links.map((link) => `${link.text}: ${link.url}`).join("\n")}\n${document.url}`;
}
