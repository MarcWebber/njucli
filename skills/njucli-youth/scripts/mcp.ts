import { z } from "zod";
import type { ReadTool } from "../../../src/mcp/read.js";
import type { YouthServices } from "./services.js";
import { ACTIVITY_STATES, AWARD_KINDS } from "./client.js";

export function registerYouthTools(read: ReadTool, service: YouthServices): void {
  const youthPage = { page: z.number().int().min(1).optional(), size: z.number().int().min(1).optional() };
  read("youth_profile", "查询青年平台本人身份与志愿者资料。", {}, () => service.profile());
  read("youth_menus", "列出青年平台当前账号的功能入口。", {}, () => service.menus());
  read("youth_years", "列出志愿服务学年筛选 ID。", {}, () => service.years());
  read("youth_hours", "查询已认定志愿服务总时长和活动次数；省略 year 查询全部学年。", { year: z.string().optional() }, ({ year }) => service.hours(year));
  read("youth_activities", "分页查询志愿活动；mine 查询自己的报名记录与认定时长。", {
    ...youthPage, query: z.string().optional(), year: z.string().optional(), mine: z.boolean().optional(), state: z.enum(ACTIVITY_STATES).optional(),
  }, (options) => service.activities(options));

  for (const [name, description, operation] of [
    ["teams", "志愿服务组织", service.teams],
    ["trainings", "志愿者培训和报名状态", service.trainings],
    ["transcript", "本人第二课堂成绩单明细", service.transcript],
    ["practice_teams", "社会实践团队招募", service.practiceTeams],
    ["practice_resources", "社会实践资料库", service.practiceResources],
  ] as const) {
    read(`youth_${name}`, `分页查询${description}。`, { ...youthPage, query: z.string().optional(), year: z.string().optional() }, operation);
  }
  for (const [name, description, operation] of [
    ["categories", "第二课堂申报类别、填报说明及开放时间", service.categories],
    ["applications", "我的第二课堂申请", service.applications],
    ["courses", "青马课程报名中心", service.courses],
    ["course_grades", "我的青马课程成绩", service.courseGrades],
    ["practices", "我的社会实践", service.practices],
    ["practice_journals", "我的社会实践行程记录", service.practiceJournals],
    ["projects", "科创作品申报记录", service.projects],
    ["complaints", "我的志愿服务投诉记录", service.complaints],
  ] as const) {
    read(`youth_${name}`, `分页查询${description}。`, youthPage, operation);
  }
  for (const [name, description, operation] of [
    ["activity", "志愿活动详情", service.activity],
    ["team", "志愿服务组织介绍", service.team],
    ["application", "第二课堂申请详情", service.application],
    ["course", "青马课程说明", service.course],
    ["practice", "本人社会实践详情", service.practice],
    ["practice_team", "社会实践团队介绍", service.practiceTeam],
    ["practice_resource", "社会实践资料详情", service.practiceResource],
    ["club", "社团介绍与入社要求", service.club],
  ] as const) {
    read(`youth_${name}`, `读取${description}。`, { id: z.string().min(1) }, ({ id }) => operation(id));
  }
  read("youth_clubs", "分页查询全校社团；mine 查询已加入的社团。", {
    ...youthPage, mine: z.boolean().optional(), category: z.string().optional(), stars: z.string().optional(), department: z.string().optional(),
  }, (options) => service.clubs(options));
  for (const [name, description, operation] of [
    ["jobs", "实习岗位", service.jobs],
    ["tickets", "票务活动", service.tickets],
  ] as const) {
    read(`youth_${name}`, `分页查询${description}；mine 查询本人记录。`, { ...youthPage, query: z.string().optional(), mine: z.boolean().optional() }, operation);
  }
  read("youth_recruitments", "分页查询学生骨干招募；mine 查询本人报名。", { ...youthPage, mine: z.boolean().optional() }, service.recruitments);
  read("youth_awards", "查询社会实践或志愿者评选记录。", { ...youthPage, kind: z.enum(AWARD_KINDS).default("student") }, ({ kind, ...options }) => service.awards(kind, options));
}
