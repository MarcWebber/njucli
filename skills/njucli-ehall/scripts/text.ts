import type { EHallApplicationPage, EHallService, EHallServiceLink, EHallTaskPage } from "./types.js";

const NONE = "无";

export function ehallServicesText(services: EHallService[]): string {
  if (services.length === 0)
    return NONE;
  return services.map((service) => `${service.available ? "可用" : "无权限"}\t${service.name}\t${service.appId}`).join("\n");
}

export function ehallTasksText(page: EHallTaskPage): string {
  if (page.items.length === 0)
    return NONE;
  return page.items.map((task) => `${task.subject}\t${task.node ?? task.status ?? ""}\t${task.author ?? ""}\t${task.time ?? ""}`).join("\n");
}

export function ehallApplicationsText(page: EHallApplicationPage): string {
  if (page.items.length === 0)
    return NONE;
  return page.items.map((item) => `${item.subject}\t${item.node ?? ""}\t${item.startedAt ?? ""}`).join("\n");
}

export function ehallServiceLinkText(link: EHallServiceLink): string {
  return `应用 ID：${link.appId}\n官方入口：${link.url}`;
}
