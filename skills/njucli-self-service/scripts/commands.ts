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
  const group = program.command("self-service").description("自助打印、证明申请与电子成绩单邮件发放");
  addFormatOption(group.command("profile").description("查询当前身份、默认收件邮箱与领取渠道"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => display(await service.profile())));
  addFormatOption(group.command("items [query]").description("查询当前账号可用的证明项目"))
    .action((query: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.items(query);
      return { data, text: data.items.map((item) => `${item.id}\t${item.name}\t领取类型 ${item.pickupType}${item.hasChildren ? "（分类）" : ""}`).join("\n") };
    }));
  addFormatOption(group.command("show <item-id>").description("查询项目条件与官方办理入口"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => display(await service.show(id))));
  requestOptions(group.command("quote <item-id>").description("查询费用与剩余额度"))
    .action((id: string, options: RequestOptions) => runCommand(runtime, options, async () => display(await service.quote(id, options.delivery, copies(options)))));
  requestOptions(group.command("create <item-id>").description("申请免费证明；电子文件默认发送到绑定邮箱"))
    .option("--email <address>", "按平台规则指定收件邮箱")
    .action((id: string, options: RequestOptions) => runCommand(runtime, options, async () => {
      const data = await service.create(id, options.delivery, copies(options), options.email);
      return { data, text: data.emailSent
        ? `申请 ${data.order.orderId} 已创建，平台已确认邮件发往 ${data.email}。需要将邮件附件下载到本地时，请通过 mail 查询与下载。`
        : `申请 ${data.order.orderId} 已创建；取件码 ${data.order.takeCode}，有效期 ${data.order.expireTime}。` };
    }));
  addFormatOption(group.command("orders").description("查询本人的申请记录")
    .addOption(new Option("--state <state>", "记录分类").choices(ORDER_STATES).default("completed")))
    .action((options: FormatOptions & { state: OrderState }) => runCommand(runtime, options, async () => display(await service.orders(options.state))));
  addFormatOption(group.command("order <order-id>").description("查询本人申请的状态与取件信息"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => display(await service.order(id))));
  addFormatOption(group.command("send <order-id>").description("将已有电子申请发送到绑定邮箱")
    .option("--email <address>", "按平台规则指定收件邮箱"))
    .action((id: string, options: FormatOptions & { email?: string }) => runCommand(runtime, options, async () => {
      const data = await service.send(id, options.email);
      return { data, text: `平台已确认邮件发往 ${data.email}；申请号 ${data.orderId}。` };
    }));
  addFormatOption(group.command("terminals").description("查询自助打印机位置与联网状态"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => display(await service.terminals())));
  return group;
}
