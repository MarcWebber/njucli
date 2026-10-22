import { z } from "zod";

const text = z.string().trim().min(1);
const id = z.number().int().positive();
export const libraryRequestInput = z.object({
  recordId: text, callNo: text, campusId: id, locationId: id, libCode: text,
  takeCampusId: id, takeLocationId: id, takeLibCode: text, phone: z.string(), email: z.string(),
  vol: z.string().optional(),
});
export type LibraryRequestInput = z.infer<typeof libraryRequestInput>;
export const libraryPhone = z.string().trim().regex(/^1\d{10}$/, "填写本人手机号");
export const libraryPhoneCode = z.string().trim().regex(/^(?:\d{4}|\d{6})$/, "填写本次官方短信验证码");
