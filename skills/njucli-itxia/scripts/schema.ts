import { z } from "zod";

export const orderId = z.string().trim().min(1);
export const identityInput = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
});

export const orderInput = z.strictObject({
  name: identityInput.shape.name,
  phone: z.string().trim().regex(/^1(3\d|4[5-9]|5[0-35-9]|6[567]|7[0-8]|8\d|9[0-35-9])\d{8}$/, "请填写官网支持的手机号"),
  email: z.email(),
  campus: z.enum(["XIANLIN", "GULOU", "SUZHOU"]),
  brandModel: z.string().trim().min(1),
  os: z.string().trim().min(1),
  freeTime: z.string().trim().min(1),
  description: z.string().trim().min(1),
  qq: z.string().trim().regex(/^[1-9][0-9]{4,10}$/).nullable().default(null),
  warranty: z.string().trim().min(1).nullable().default(null),
  acceptEmailNotification: z.boolean().default(true),
});

export type OrderInput = z.output<typeof orderInput>;
