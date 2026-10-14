---
name: njucli-self-service
description: 使用南京大学自助服务申请电子成绩单、在校证明等文件，查询费用额度、申请记录和打印机位置，向绑定邮箱发放电子文件。涉及正式成绩单导出或自助打印时使用。
---

# 自助服务

以下命令需在当前 Skill 目录运行（若使用统一 CLI，可将 `node scripts/run.mjs` 替换为 `njucli`）。业务命令会自动恢复 SSO 与自助服务登录。官方办理入口为[自助服务](https://zzfwx.nju.edu.cn/wec-self-print-app-console/mobile.html#/mobile/itemList)。

## 电子成绩单

**1. 查询当前身份、默认邮箱与可用项目**

```bash
node scripts/run.mjs self-service profile --format json
node scripts/run.mjs self-service items 成绩单 --format json
node scripts/run.mjs self-service show ITEM_ID --format json
node scripts/run.mjs self-service quote ITEM_ID --format json
```

*   **动态读取 ID**：`ITEM_ID` 必须从当前查询中获取。页面参数 `orderDetail?id=` 指的是项目而非申请号。
*   **项目属性**：`pickupType` 分为 1 纸质、2 电子、3 两者均可；`hasChildren=true` 代表该项为分类，使用官方页面展开办理。
*   **配置来源**：用户、学校、邮箱和申请号等信息均从当前账号与响应中提取，切勿将分享链接中的临时 ticket 作为固定配置。

**2. 申请导出文件**

当用户要求导出时，申请对应的免费电子文件并发至绑定邮箱：

```bash
node scripts/run.mjs self-service create ITEM_ID --format json
```

*   **参数与规则**：默认采用电子方式，每次 1 份。
*   **默认绑定邮箱**：优先使用自助服务平台绑定的邮箱；若未绑定且平台允许更改，则使用同一本地账号的 `njucli` 当前绑定邮箱。仅在用户明确指定时才使用 `--email ADDRESS`。若均无邮箱地址，请先通过邮件 Skill 绑定，或直接询问用户。
*   **例外限制**：遇到收费、超出额度或需填写表单的项目，请引导用户通过 `show` 命令返回的官方页面办理。

**3. 发放确认与下载**

*   **状态反馈**：向用户说明申请号与收件邮箱。响应中的 `emailSent=true` 仅代表平台确认发送，实际送达状态需通过邮件 Skill 核对。
*   **下载授权**：发放完成后，**询问用户是否需要下载到本地**，确认后下载。用户此前已明确授权下载时，直接继续。
*   **邮件下载流程**：目前平台仍通过邮件发放电子文件（`profile.downloadEnabled` 仅显示直下渠道状态）。需通过已安装的 `njucli-mail` Skill 或统一 CLI 依次执行：
    1.  核对邮件：`mail search 成绩单 --format json`（确认收件邮箱、时间与主题）
    2.  获取附件：`mail read MESSAGE_ID --format json`（获取附件编号）
    3.  执行下载：`mail download MESSAGE_ID ATTACHMENT_ID --output /path/to/transcript.pdf --format json`
*   **完整性**：下载后需保持原 PDF 及其数字签名不变。

## 申请记录与再次发放

```bash
node scripts/run.mjs self-service orders --state completed --format json
node scripts/run.mjs self-service orders --state pending --format json
node scripts/run.mjs self-service order ORDER_ID --format json
node scripts/run.mjs self-service send ORDER_ID --format json
```

*   **防重复扣费**：若创建响应状态不明确，务必先查询申请记录（`orders`），避免重复申请导致扣减额度。
*   **异常处理**：若创建成功但后续环节失败，系统会返回申请号。请使用该号查询状态并继续发放。
*   **写操作不重试**：`send` 为触发发送邮件的写操作（用于再次发放或继续未完成的发放）。普通的网络失败**不要**自动重试写操作。

## 其他证明与纸质领取

可用项目会随账号发生变化（可能包含在校证明、纸质成绩单、志愿时长证明等），操作前务必先用 `items` 查询。

**纸质文件申请（仅限免费且无表单的项目）**：

```bash
node scripts/run.mjs self-service quote ITEM_ID --delivery paper --copies 1 --format json
node scripts/run.mjs self-service create ITEM_ID --delivery paper --copies 1 --format json
node scripts/run.mjs self-service terminals --format json
```

*   **领取方式**：纸质申请成功后会返回取件码与有效期，用户需凭码在官方设备领取。
*   **终端状态**：`terminals` 命令返回设备位置、坐标及联网状态。注意：联网正常不代表纸张或印章等耗材充足。
*   **工具边界**：MCP 仅提供只读查询功能（profile/items/show/quote/orders/order/terminals）；所有申请创建和邮件发送操作均需使用 CLI 执行。

接口参数及实网核对范围请参见 [接口与验证记录](references/interfaces.md)。
