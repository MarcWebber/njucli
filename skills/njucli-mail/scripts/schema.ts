import { z } from "zod";

export const mailSendInput = z.strictObject({
  to: z.array(z.email()).min(1).describe("收件人邮箱地址"),
  cc: z.array(z.email()).optional(),
  bcc: z.array(z.email()).optional(),
  subject: z.string().trim().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  attachments: z.array(z.string().min(1)).optional().describe("本地附件路径"),
  inReplyTo: z.string().min(1).optional().describe("回复原邮件的 Message-ID"),
  references: z.array(z.string().min(1)).optional(),
}).refine(input => Boolean(input.text?.trim() || input.html?.trim()), {
  message: "请提供 text 或 html 正文",
});

export type MailSendInput = z.output<typeof mailSendInput>;
