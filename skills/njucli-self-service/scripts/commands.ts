import { Option, type Command } from "commander";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import { DELIVERIES, ORDER_STATES, type Delivery, type OrderState } from "./client.js";
import type { SelfServiceServices } from "./services.js";

type RequestOptions = FormatOptions & { delivery: Delivery; copies: string; email?: string };
function copies(options: RequestOptions): number {
  const count = Number(options.copies);
  if (!Number.isSafeInteger(count) || count < 1) throw new AppError("INVALID_INPUT", "份数须为正整数");
  if (options.delivery === "electronic" && count !== 1) throw new AppError("INVALID_INPUT", "电子文件每次申请一份");
  if (options.delivery === "paper" && options.email) throw new AppError("INVALID_INPUT", "邮箱参数适用于电子文件");
  return count;
}
function requestOptions(command: Command) {
  return addFormatOption(command.addOption(new Option("--delivery <type>", "领取方式").choices(DELIVERIES).default("electronic"))
    .option("--copies <number>", "申请份数，电子文件为一份", "1"));
}
const display = (data: unknown) => ({ data, text: JSON.stringify(data, null, 2) });

export function registerSelfServiceCommands(program: Command, service: SelfServiceServices, runtime: CommandRuntime): Command {
  const group = program.command("self-service").description("证明申请、电子文件领取与云打印查询");
  addFormatOption(group.command("profile").description("查询当前身份、默认收件邮箱与领取渠道"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => display(await service((client) => client.profile()))));
  addFormatOption(group.command("items [query]").description("查询当前账号可用的证明项目").option("--parent <item-id>", "展开指定分类"))
    .action((query: string | undefined, options: FormatOptions & { parent?: string }) => runCommand(runtime, options, async () => {
      const data = await service((client) => client.items(query, options.parent));
      return { data, text: data.items.map((item) => `${item.id}\t${item.name}\t领取类型 ${item.pickupType}${item.hasChildren ? "（分类）" : ""}`).join("\n") };
    }));
  addFormatOption(group.command("show <item-id>").description("查询项目条件与官方办理入口"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => display(await service((client) => client.show(id)))));
  requestOptions(group.command("quote <item-id>").description("查询费用与剩余额度"))
    .action((id: string, options: RequestOptions) => runCommand(runtime, options, async () => {
      const count = copies(options);
      return display(await service((client) => client.quote(id, options.delivery, count)));
    }));
  requestOptions(group.command("create <item-id>").description("申请免费证明；电子文件默认发送到绑定邮箱"))
    .option("--email <address>", "按平台规则指定收件邮箱")
    .action((id: string, options: RequestOptions) => runCommand(runtime, options, async () => {
      const count = copies(options);
      const data = await service((client) => client.create(id, options.delivery, count, options.email));
      return { data, text: data.emailSent
        ? `申请 ${data.order.orderId} 已创建，平台已确认邮件发往 ${data.email}。需要将邮件附件下载到本地时，请通过 mail 查询与下载。`
        : `申请 ${data.order.orderId} 已创建；取件码 ${data.order.takeCode}，有效期 ${data.order.expireTime}。` };
    }));
  addFormatOption(group.command("orders").description("查询本人的申请记录")
    .addOption(new Option("--state <state>", "记录分类").choices(ORDER_STATES).default("completed")))
    .action((options: FormatOptions & { state: OrderState }) => runCommand(runtime, options, async () => display(await service((client) => client.orders(options.state)))));
  addFormatOption(group.command("order <order-id>").description("查询本人申请的状态与取件信息"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => display(await service((client) => client.order(id)))));
  addFormatOption(group.command("send <order-id>").description("将已有电子申请发送到绑定邮箱")
    .option("--email <address>", "按平台规则指定收件邮箱"))
    .action((id: string, options: FormatOptions & { email?: string }) => runCommand(runtime, options, async () => {
      const data = await service((client) => client.send(id, options.email));
      return { data, text: `平台已确认邮件发往 ${data.email}；申请号 ${data.orderId}。` };
    }));
  addFormatOption(group.command("terminals").description("查询自助打印机位置与联网状态"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => display(await service((client) => client.terminals()))));
  addFormatOption(group.command("cancel <order-id>").description("撤销本人未完成的免费申请"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => display(await service((client) => client.cancel(id)))));
  addFormatOption(group.command("cloud").description("查询云打印规则与本人待打印文件"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => display(await service((client) => client.cloud()))));
  return group;
}
