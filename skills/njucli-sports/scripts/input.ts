import { z } from "zod";

const remoteId = z.union([z.string().trim().min(1), z.number().int().positive()]);
export const reservationInput = z.object({
  venueSiteId: remoteId,
  date: z.string().min(1),
  weekStartDate: z.string().min(1),
  slots: z.array(z.object({
    spaceId: remoteId, timeId: remoteId, venueSpaceGroupId: remoteId.optional(),
  }).strict()).min(1),
  reservationType: z.number().int().nullable().optional(),
  token: z.string().min(1).optional().describe("可选官方短期参数；省略时从同一场地日期读取"),
}).strict();

export const reserveInput = reservationInput.extend({
  totalAmt: z.number().nonnegative(),
  orderPrice: z.number().nonnegative().nullable(),
  orderPin: z.string().min(1).describe("官方预约页生成的 orderPin"),
  phone: z.string().optional(),
  addBuddyType: z.number().int().optional(),
  buddyIds: z.array(remoteId).optional(), buddyUids: z.array(z.string().min(1)).optional(),
  manNum: z.number().int().nonnegative().optional(), childNum: z.number().int().nonnegative().optional(),
  sportType: remoteId.optional(),
  captchaVerification: z.string().min(1).optional(), captchaToken: z.string().min(1).optional(),
}).strict();

export type ReservationInput = z.infer<typeof reservationInput>;
export type ReserveInput = z.infer<typeof reserveInput>;
