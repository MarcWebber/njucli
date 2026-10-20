import { scholarshipDraftSchema } from "./scholarship.js";
import { classroomQuerySchema } from "./classrooms.js";
import { requiredText } from "../../../src/core/guards.js";
import type { Command } from "commander";
import { readFile } from "node:fs/promises";

import type { EHallServices } from './services.js';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import { COURSE_SELECTION_KINDS, type CourseSelectionKind, EHALL_APPLICATION_STATES, EHALL_TASK_KINDS, type EHallApplicationState, type EHallTaskKind } from "./types.js";
import { tripInputSchema } from "./trip.js";
import { PROFILE_KINDS, profileInputSchema, type ProfileKind } from "./profile.js";
import { optionalPositiveInteger } from "../../../src/core/options.js";
import {
  graduateExamsText,
  graduateGradesText,
  graduatePlanText,
  graduateScheduleText,
  courseOfferingsText,
  occurrenceText,
  occurrencesText,
  scheduleText,
  selectedCoursesText,
  termText,
  termsText,
  ehallApplicationsText,
  ehallServiceLinkText,
  ehallServicesText,
  ehallTasksText,
} from './text.js';

interface TermOptions extends FormatOptions {
  term?: string;
}

interface SelectionOptions extends FormatOptions {
  kind: string;
  page?: string;
  pageSize?: string;
}

interface PageOptions extends FormatOptions {
  page?: string;
  pageSize?: string;
}

interface TripOptions extends FormatOptions {
  input?: string;
  holiday?: string;
  stay?: boolean;
  from?: string;
  to?: string;
  destination?: string;
  address?: string;
  transport?: string;
  serviceNumber?: string;
  returnTransport?: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  onCampus?: boolean;
  offCampus?: boolean;
  residence?: string;
  dryRun?: boolean;
}

export function registerEHallCommands(
  program: Command,
  service: EHallServices,
  runtime: CommandRuntime,
): Command {
  const ehall = program.command("ehall").description("教务、课表、选课、个人资料与办事大厅");

  addFormatOption(ehall.command("classroom-campuses").description("查询空闲教室服务的校区代码"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.classroomCampuses();
      return { data, text: data.map(row => `${row.id} ${row.name}`).join("\n") || "暂无可查询校区" };
    }));
  addFormatOption(ehall.command("classroom-buildings <campus>").description("查询指定校区的教学楼代码"))
    .action(async (campus: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.classroomBuildings(requiredText(campus, "校区代码"));
      return { data, text: data.map(row => `${row.id} ${row.name}`).join("\n") || "暂无教学楼" };
    }));
  addFormatOption(ehall.command("classrooms [date]").description("查询指定日期、连续节次内均空闲的教室，默认今天")
    .requiredOption("--campus <id>", "校区代码，见 classroom-campuses")
    .requiredOption("--period <range>", "单节或连续节次，如 5 或 5-8")
    .option("--building <id>", "教学楼代码，见 classroom-buildings")
    .option("--page <page>", "页码，默认 1")
    .option("--page-size <size>", "每页条数，默认 50"))
    .action(async (date: string | undefined, options: PageOptions & { campus: string; period: string; building?: string }) => runCommand(runtime, options, async () => {
      const parsed = classroomQuerySchema.safeParse({ ...options, date,
        page: options.page === undefined ? undefined : Number(options.page), pageSize: options.pageSize === undefined ? undefined : Number(options.pageSize),
      });
      if (!parsed.success) throw new AppError("INVALID_INPUT", parsed.error.issues.map(issue => issue.message).join("；"));
      const data = await service.classrooms(parsed.data);
      return { data, text: [
        `${data.date} 第 ${data.period} 节：共 ${data.total} 间空闲教室；第 ${data.page} 页，本页 ${data.items.length} 间`,
        ...data.items.map(room => [room.name, room.building, room.type, room.seats === null ? null : `${room.seats} 座`, room.time].filter(Boolean).join(" | ")),
      ].join("\n") };
    }));

  addFormatOption(ehall.command("profile [kind]").description("查询研究生论文、获奖、专利、著作和导师项目"))
    .action(async (kind: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.profile(kind === undefined ? undefined : profileKind(kind));
      return { data, text: data.categories.map((category) => [
        `${category.name}：${category.records.length} 条；${category.editable ? "可补充" : "当前只读"}${category.requiresReview ? "；需审核" : ""}`,
        ...category.records.flatMap((record) => [
          `\n${record.title}\n编号：${record.id}`,
          ...category.fields.filter((field) => field.name !== "title" && record.values[field.name] !== undefined)
            .map((field) => `  ${field.label}：${typeof record.values[field.name] === "boolean" ? record.values[field.name] ? "是" : "否" : record.values[field.name]}`),
          ...(record.attachmentToken ? [`  附件编号：${record.attachmentToken}`] : []),
        ]),
      ].join("\n")).join("\n\n") || "当前账号没有开放的资料栏目" };
    }));

  addFormatOption(ehall.command("profile-fields <kind>").description("查询个人资料必填字段、官网选项和附件支持"))
    .action(async (kind: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.profileFields(profileKind(kind));
      return { data, text: [
        `${data.name}：${data.editable ? "可补充" : "当前只读"}${data.requiresReview ? "；保存后需在官网提交审核" : ""}`,
        ...data.fields.map((field) => `${field.name}：${field.label}${field.required ? field.requiredWhen ? `（published=${field.requiredWhen.published} 时必填）` : "（必填）" : ""}；${field.type}${field.choices ? `；${field.choices.map((c) => `${c.name} (${c.id})`).join("、")}` : ""}`),
        `附件：${data.attachments ? "可用 --attachment 提供本地文件" : "此栏目未开放"}`,
        ...(data.kind === "papers" ? ["published=true 时填写 publishedOn；published=false 时填写 acceptedOn。"] : []),
      ].join("\n") };
    }));

  addFormatOption(ehall.command("profile-add <kind>").description("新增一条个人资料，保留已有记录并回读核对")
    .requiredOption("--input <file>", "新增资料的 JSON 文件")
    .option("--attachment <file...>", "佐证材料文件，可提供多个")
    .option("--dry-run", "校验资料并预览，正式记录和附件均不写入"))
    .action(async (kind: string, options: FormatOptions & { input: string; attachment?: string[]; dryRun?: boolean }) => runCommand(runtime, options, async () => {
      const selected = profileKind(kind);
      const value = JSON.parse(await readFile(options.input, "utf8")) as unknown;
      const parsed = profileInputSchema.safeParse(value);
      if (!parsed.success) throw new AppError("INVALID_INPUT", "资料 JSON 应为字段对象，字段值使用文本、数值或布尔值");
      const data = await service.addProfile(selected, parsed.data, options.attachment, options.dryRun);
      return { data, text: data.submitted
        ? `${data.plan.name}已保存并核对：${data.record.title}\n编号：${data.record.id}${data.plan.requiresReview ? "\n请在官网提交审核；当前结果表示资料已保存。" : ""}`
        : `${data.plan.name}预览通过：${data.plan.values.title}\n原有 ${data.plan.previousCount} 条记录将保留；附件 ${data.plan.attachments.length} 个。` };
    }));

  addFormatOption(ehall.command("profile-remove <kind> <id>").description("删除本人维护的一条资料并回读核对"))
    .action(async (kind: string, id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.removeProfile(profileKind(kind), id);
      return { data, text: `已删除并核对：${data.title}\n编号：${data.id}` };
    }));

  const scholarship = ehall.command("scholarship").description("研究生奖学金查询、填写与草稿保存");
  for (const [name, description, method] of [
    ["list", "查询奖种与开放时间", service.scholarships],
    ["applications", "查询本人奖学金申请与审核状态", service.scholarshipApplications],
  ] as const) {
    addFormatOption(scholarship.command(name).description(description).option("--page <page>", "页码").option("--page-size <size>", "每页条数"))
      .action(async (options: PageOptions) => runCommand(runtime, options, async () => {
        const data = await method(optionalPositiveInteger(options.page, "--page"), optionalPositiveInteger(options.pageSize, "--page-size"));
        return { data, text: JSON.stringify(data, null, 2) };
      }));
  }
  for (const [name, description, method] of [
    ["show", "查询奖种说明与等级", service.scholarship],
    ["application", "读取本人的申请详情和可填写内容", service.scholarshipApplication],
  ] as const) {
    addFormatOption(scholarship.command(name + " <id>").description(description))
      .action(async (id: string, options: FormatOptions) => runCommand(runtime, options, async () => {
        const data = await method(id);
        return { data, text: JSON.stringify(data, null, 2) };
      }));
  }
  addFormatOption(scholarship.command("form <awardId>").description("读取奖种填写模板、等级与开放批次")
    .requiredOption("--category <category>", "官网申请分类代码（1 至 6）"))
    .action(async (awardId: string, options: FormatOptions & { category: string }) => runCommand(runtime, options, async () => {
      if (!/^[1-6]$/.test(options.category)) throw new AppError("INVALID_INPUT", "分类代码须为 1 至 6");
      const data = await service.scholarshipForm(awardId, options.category);
      return { data, text: JSON.stringify(data, null, 2) };
    }));
  addFormatOption(scholarship.command("save").description("填写并保存奖学金草稿，保持未提交状态")
    .requiredOption("--input <file>", "草稿 JSON 文件")
    .option("--dry-run", "读取并核对填写内容，仅预览"))
    .action(async (options: FormatOptions & { input: string; dryRun?: boolean }) => runCommand(runtime, options, async () => {
      let value: unknown;
      try { value = JSON.parse(await readFile(options.input, "utf8")); }
      catch (error) { if (!(error instanceof SyntaxError)) throw error; throw new AppError("INVALID_INPUT", "草稿文件不是有效 JSON"); }
      const parsed = scholarshipDraftSchema.safeParse(value);
      if (!parsed.success) throw new AppError("INVALID_INPUT", parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("；"));
      const data = await service.saveScholarshipDraft(parsed.data, options.dryRun);
      return { data, text: `${data.saved ? `草稿已保存并回读确认，尚未提交\n核对链接：${data.reviewUrl}\n${data.nextStep}` : "填写预览（未保存）"}\n${JSON.stringify(data, null, 2)}` };
    }));

  addFormatOption(ehall.command("trip").description("查询研究生节假日行程登记、默认联系方式与缺失信息"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.trip();
      const status = { open: "待填报", submitted: "已登记", closed: "当前无需登记" }[data.status];
      return { data, text: [
        `${data.holiday?.name ?? "行程登记"}：${status}`,
        ...(data.holiday ? [`假期：${data.holiday.from} 至 ${data.holiday.to}；登记截止：${data.holiday.deadline}`, `假期编号：${data.holiday.id}`] : []),
        data.missing.length ? `需补充：${data.missing.join("、")}` : "联系方式可复用已有登记；填写本次行程即可。",
        ...data.records.flatMap((r) => [
          `登记 ${r.id}：${r.stayOnCampus ? "全程留校" : `${r.from} 至 ${r.to}`}`,
          ...r.stops.map((s) => `  ${s.from} 至 ${s.to}：${s.destination}，${s.address}，${s.transport}${s.serviceNumber ? ` ${s.serviceNumber}` : ""}`),
        ]),
      ].join("\n") };
    }));

  addFormatOption(ehall.command("trip-submit").description("提交研究生节假日行程并回读核对")
    .option("--stay", "假期全程留校")
    .option("--from <date>", "离校日期 YYYY-MM-DD")
    .option("--to <date>", "返校日期 YYYY-MM-DD")
    .option("--destination <place>", "目的地市或区县")
    .option("--address <address>", "目的地详细地址，具体到门牌号")
    .option("--transport <transport>", "交通方式")
    .option("--service-number <number>", "车次、航班号或班次")
    .option("--return-transport <transport>", "返校交通方式")
    .option("--phone <phone>", "更新本人手机号，默认复用已有资料")
    .option("--emergency-contact <name>", "更新紧急联系人")
    .option("--emergency-phone <phone>", "更新紧急联系电话")
    .option("--on-campus", "目前住校")
    .option("--off-campus", "目前不住校")
    .option("--residence <address>", "目前校外居住地址")
    .option("--holiday <id>", "指定假期编号，默认当前开放假期")
    .option("--input <file>", "多段复杂行程的 JSON 文件，可选")
    .option("--dry-run", "读取默认信息并检查完整行程，返回预览"))
    .action(async (options: TripOptions) => runCommand(runtime, options, async () => {
      let value: unknown;
      if (options.input) {
        if (Object.entries(options).some(([key, v]) => !["input", "dryRun", "format"].includes(key) && v !== undefined)) {
          throw new AppError("INVALID_INPUT", "--input 与直接填写行程的参数不能同时使用");
        }
        try { value = JSON.parse(await readFile(options.input, "utf8")); }
        catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
          throw new AppError("INVALID_INPUT", "行程文件不是有效 JSON");
        }
      } else {
        const hasTrip = [options.from, options.to, options.destination, options.address, options.transport, options.serviceNumber, options.returnTransport].some((v) => v !== undefined);
        if (options.stay && hasTrip) throw new AppError("INVALID_INPUT", "--stay 不能与外出行程参数同时使用");
        if (!options.stay && !hasTrip) throw new AppError("INVALID_INPUT", "请说明本次行程：全程留校用 --stay；外出提供 --from、--to、--destination、--address、--transport");
        if (options.onCampus && options.offCampus) throw new AppError("INVALID_INPUT", "--on-campus 与 --off-campus 不能同时使用");
        value = {
          holidayId: options.holiday, stayOnCampus: options.stay ?? false,
          phone: options.phone, emergencyContact: options.emergencyContact, emergencyPhone: options.emergencyPhone,
          onCampus: options.onCampus ? true : options.offCampus ? false : undefined, residence: options.residence,
          trips: options.stay ? [] : [{ returnTransport: options.returnTransport, stops: [{
            from: options.from, to: options.to, destination: options.destination, address: options.address,
            transport: options.transport, serviceNumber: options.serviceNumber,
          }] }],
        };
      }
      const parsed = tripInputSchema.safeParse(value);
      if (!parsed.success) throw new AppError("INVALID_INPUT", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("；"));
      const data = await service.submitTrip(parsed.data, options.dryRun);
      return { data, text: data.submitted
        ? `${data.plan.holiday.name}行程已提交并核对，登记编号：${data.recordId}`
        : [
          `${data.plan.holiday.name}行程检查通过（预览）：${data.plan.stayOnCampus ? "全程留校" : `${data.plan.trips.length} 段离返校行程`}`,
          ...data.plan.trips.flatMap((t) => t.stops.map((s) => `${s.from} 至 ${s.to}：${s.destination.name}，${s.address}，${s.transport.name}${s.serviceNumber ? ` ${s.serviceNumber}` : ""}`)),
        ].join("\n") };
    }));

  addFormatOption(ehall.command("services [query]").description("搜索可用服务入口"))
    .action(async (query: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.services(query);
      return { data, text: ehallServicesText(data) };
    }));

  addFormatOption(ehall.command("tasks").description("查询待办、已办或我发起的任务")
    .option("--kind <kind>", "任务类型：todo、done 或 started", "todo")
    .option("--page <page>", "页码")
    .option("--page-size <size>", "每页条数"))
    .action(async (options: PageOptions & { kind: string }) => runCommand(runtime, options, async () => {
      const data = await service.tasks(
        taskKind(options.kind),
        optionalPositiveInteger(options.page, "--page"),
        optionalPositiveInteger(options.pageSize, "--page-size"),
      );
      return { data, text: ehallTasksText(data) };
    }));

  addFormatOption(ehall.command("applications").description("查询我发起的办件")
    .option("--state <state>", "办件状态：active、completed 或 cancelled", "active")
    .option("--page <page>", "页码")
    .option("--page-size <size>", "每页条数"))
    .action(async (options: PageOptions & { state: string }) => runCommand(runtime, options, async () => {
      const data = await service.applications(
        applicationState(options.state),
        optionalPositiveInteger(options.page, "--page"),
        optionalPositiveInteger(options.pageSize, "--page-size"),
      );
      return { data, text: ehallApplicationsText(data) };
    }));

  addFormatOption(ehall.command("link <app-id>").description("返回官方应用入口"))
    .action(async (appId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.serviceLink(appId);
      return { data, text: ehallServiceLinkText(data) };
    }));

  addFormatOption(ehall.command("grades").description("查询我的成绩").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.grades(options.term);
      return { data, text: graduateGradesText(data) };
    }));

  addFormatOption(ehall.command("exams").description("查询考试与考查安排").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.exams(options.term);
      return { data, text: graduateExamsText(data) };
    }));

  addFormatOption(ehall.command("graduate-schedule").description("查询研究生课表").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.graduateSchedule(options.term);
      return { data, text: graduateScheduleText(data) };
    }));

  addFormatOption(ehall.command("plan").description("查询我的培养方案"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.plan();
      return { data, text: graduatePlanText(data) };
    }));

  addFormatOption(ehall.command("terms").description("列出学期"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.terms();
      return { data, text: termsText(data) };
    }));

  addFormatOption(ehall.command("current-term").description("显示当前学期"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.currentTerm();
      return { data, text: termText(data) };
    }));

  addFormatOption(ehall.command("available [query]").description("查询仍有名额的研究生课程")
    .option("--kind <kind>", "课程范围：plan 或 public", "public")
    .option("--page <page>", "页码")
    .option("--page-size <size>", "每页条数"))
    .action(async (query: string | undefined, options: SelectionOptions) => runCommand(runtime, options, async () => {
      const data = await service.available(
        selectionKind(options.kind),
        query,
        optionalPositiveInteger(options.page, "--page"),
        optionalPositiveInteger(options.pageSize, "--page-size"),
      );
      return { data, text: courseOfferingsText(data) };
    }));

  addFormatOption(ehall.command("selected").description("查询已选研究生课程"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.selected();
      return { data, text: selectedCoursesText(data) };
    }));

  addFormatOption(ehall.command("select <class-id>").description("提交一次研究生选课")
    .option("--kind <kind>", "课程范围：plan 或 public", "public"))
    .action(async (classId: string, options: SelectionOptions) => runCommand(runtime, options, async () => {
      const data = await service.select(classId, selectionKind(options.kind));
      return { data, text: selectedCoursesText([data]) };
    }));

  addFormatOption(ehall.command("withdraw <class-id>").description("提交一次研究生退课"))
    .action(async (classId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.withdraw(classId);
      return { data, text: `已退课：${data.name}\t${data.classId}` };
    }));

  addFormatOption(ehall.command("schedule").description("读取完整课表").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.schedule(options.term);
      return { data, text: scheduleText(data) };
    }));

  addFormatOption(ehall.command("today [date]").description("查询某日课程").option("--term <term>", "学期 ID"))
    .action(async (date: string | undefined, options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.today(date, options.term);
      return { data, text: occurrencesText(data) };
    }));

  addFormatOption(ehall.command("week [date]").description("查询日期所在周的课程").option("--term <term>", "学期 ID"))
    .action(async (date: string | undefined, options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.week(date, options.term);
      return { data, text: occurrencesText(data) };
    }));

  addFormatOption(ehall.command("next").description("查询下一节课").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.next(options.term);
      return { data, text: occurrenceText(data) };
    }));

  addFormatOption(ehall.command("export <path>").description("导出 ICS 课表").option("--term <term>", "学期 ID"))
    .action(async (path: string, options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.export(path, options.term);
      return {
        data,
        text: `已导出 ${data.eventCount} 个日程到 ${data.path}`,
      };
    }));

  return ehall;
}

function profileKind(value: string): ProfileKind {
  if (!PROFILE_KINDS.includes(value as ProfileKind)) throw new AppError("INVALID_INPUT", `资料类别应为 ${PROFILE_KINDS.join("、")}`);
  return value as ProfileKind;
}

function taskKind(value: string): EHallTaskKind {
  if (EHALL_TASK_KINDS.includes(value as EHallTaskKind)) return value as EHallTaskKind;
  throw new AppError("INVALID_INPUT", `不支持的任务类型：${value}`);
}

function applicationState(value: string): EHallApplicationState {
  if (EHALL_APPLICATION_STATES.includes(value as EHallApplicationState)) return value as EHallApplicationState;
  throw new AppError("INVALID_INPUT", `不支持的办件状态：${value}`);
}

function selectionKind(value: string): CourseSelectionKind {
  if (COURSE_SELECTION_KINDS.includes(value as CourseSelectionKind)) return value as CourseSelectionKind;
  throw new AppError("INVALID_INPUT", `不支持的课程范围：${value}`, {
    hint: `使用 ${COURSE_SELECTION_KINDS.join(" 或 ")}`,
  });
}
