import { z } from "zod";
import type { SkillRuntime } from "../../../src/app/runtime.js";
import type { FetchLike } from "../../../src/core/types.js";
import { AppError } from "../../../src/core/errors.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import { readJsonFile } from "../../../src/core/fs.js";
import { join } from "node:path";
import { createCampusVpnFetch, campusVpnUrl } from "../../../src/auth/webvpn.js";

const ROOT = "https://ytj.nju.edu.cn";
type Row = Record<string, any>;
type Page = { total: number; pages: number; current: number; size: number; records: Row[] };
const time = z.string().regex(/^\d{2}:\d{2}$/);
export const roomBookingInput = z.strictObject({
  roomId: z.number().int().positive(), date: z.string().min(1), startTime: time, endTime: time,
  purposeId: z.number().int().positive(), mobile: z.string().min(1), description: z.string().min(1),
  members: z.array(z.string().min(1)).default([]),
});
type BookingInput = z.output<typeof roomBookingInput>;

function studyRooms(fetch: FetchLike, token: string, userId: string) {
  function dates(): Promise<string[]> { return api("v1/room/reservationDate"); }

  async function rooms(date: string, type?: number) {
    const groups = await api<Row[]>("v1/room/mRooms", { date: parseCampusDate(date), roomType: type ?? "" });
    return groups.flatMap(group => group.rooms.map((room: Row) => ({
      id: room.id, name: room.name, area: group.name, roomType: room.roomType,
      minimumPeople: room.minReservationNum, capacity: room.maxNum, status: room.status,
      opensAt: room.startTime, closesAt: room.endTime,
      minimumMinutes: room.reservationMinTime, maximumMinutes: room.reservationMaxTime, availableMinutes: room.spaceTime,
    })));
  }

  async function slots(roomId: number, date: string) {
    const room = await api<Row>("v1/room/reservation", { roomId, date: parseCampusDate(date) });
    return {
      id: room.id, name: room.name, date, minimumPeople: room.minReservationNum, capacity: room.maxNum,
      opensAt: room.startTime, closesAt: room.endTime, minimumMinutes: room.reservationMinTime, maximumMinutes: room.reservationMaxTime,
      slots: (room.dateTimeSlicesList ?? []).flat().map((slot: Row) => ({ startTime: slot.startTime, endTime: slot.endTime, status: slot.reservationStatus })),
    };
  }

  async function purposes() {
    const result = await api<Page>("v1/dict/type", { type: "RESERVATION_USE" });
    return result.records.map(row => ({ id: row.id, name: row.label }));
  }

  function bookings(page = 1, size = 10): Promise<Page> {
    return api("v1/reservation/pageByUserId", {}, "POST", { userId: userId, page, size });
  }

  async function ownBookings(): Promise<Row[]> {
    const first = await bookings();
    const rows = [...first.records];
    for (let page = 2; page <= first.pages; page++) rows.push(...(await bookings(page)).records);
    return rows;
  }

  async function book(input: BookingInput) {
    const date = parseCampusDate(input.date);
    const startTime = `${date} ${input.startTime}:00`;
    const endTime = `${date} ${input.endTime}:00`;
    const before = new Set((await ownBookings()).map(row => String(row.id)));
    await api("v1/room/verifyRoomPloy", { userId: userId, roomId: input.roomId });
    const memberIds = input.members.join(",");
    await api("v1/reservation/reservationUserJudge", { userId: userId, memberIds, startTime });
    await api("v1.1/reservation/reservation", {
      userId: userId, memberIds, roomId: input.roomId, startTime, endTime,
      dictId: input.purposeId, behaviorMode: "4", mobile: input.mobile,
      remark: input.description, filePath: "",
    }, "POST", undefined, false);
    const expectedStart = Date.parse(`${date}T${input.startTime}:00+08:00`);
    const expectedEnd = Date.parse(`${date}T${input.endTime}:00+08:00`);
    const added = (await ownBookings()).filter(row => !before.has(String(row.id))
      && row.roomId === input.roomId && row.startTime === expectedStart && row.endTime === expectedEnd);
    if (added.length !== 1) throw new AppError("REMOTE_UNAVAILABLE", "预约请求已提交，但未唯一回读到新增预约，请先查询本人预约，勿重复提交");
    return added[0];
  }

  async function cancel(id: string) {
    const before = (await ownBookings()).find(row => String(row.id) === id);
    if (!before) throw new AppError("NOT_FOUND", "本人预约中没有该记录");
    if (before.reservationStatus === 61) return { id, cancelled: true, reservation: before };
    await api("v1/reservation/cancelReservation", { reservationId: id, cancelType: 1 }, "POST");
    const after = (await ownBookings()).find(row => String(row.id) === id);
    if (after && after.reservationStatus !== 61)
      throw new AppError("REMOTE_UNAVAILABLE", "取消请求已提交，回读尚未确认状态变化，请查询本人预约");
    return { id, cancelled: true, reservation: after ?? null };
  }

  async function api<T>(path: string, query: Record<string, string | number> = {}, method = "GET", body?: unknown, expectJson = true): Promise<T> {
    const url = new URL(`/api/studyroom/${path}`, ROOT);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    const response = await fetch(url, {
      method, headers: { Authorization: token, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (response.ok && (!expectJson || !text.trim())) return undefined as T;
    let data: any;
    try { data = JSON.parse(text); } catch {
      const host = new URL(response.url).hostname;
      if (host === "vpn.nju.edu.cn") throw new AppError("VPN_REQUIRED", "请完成南大 VPN 登录", { details: { url: "https://vpn.nju.edu.cn/" } });
      throw new AppError("REMOTE_SCHEMA_CHANGED", `研修间接口未返回 JSON：${path}，HTTP ${response.status}`, { details: { path, status: response.status, bytes: text.length, host } });
    }
    if (response.status === 401 || response.status === 403 || data?.code === 2002 || data?.code === 2003)
      throw new AppError("AUTH_EXPIRED", "研修间登录已失效，请重新打开官方研修间入口");
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", data?.msg || data?.message || `研修间返回 HTTP ${response.status}`, { details: { path, code: data?.code } });
    return data as T;
  }
  return { dates, rooms, slots, purposes, bookings, book, cancel };
}

export function createLibraryRoomServices(runtime: SkillRuntime) {
  return <T>(operation: (client: ReturnType<typeof studyRooms>) => Promise<T>): Promise<T> => runtime.withBrowser("sso", async (session, account) => {
    const page = await session.page(true);
    await session.login(campusVpnUrl(ROOT).href, url => url.hostname === "ytj-nju-edu-cn-s.atrust.nju.edu.cn");
    await page.waitForFunction(() => Boolean(localStorage.getItem("accessToken") && localStorage.getItem("userId")), undefined, { timeout: 30000 });
    const state = await page.evaluate(() => ({ token: localStorage.getItem("accessToken")!, userId: localStorage.getItem("userId")!, studentId: JSON.parse(localStorage.getItem("userData") || "{}").sysNumber }));
    const credentials = await readJsonFile<{ username: string }>(join(account.configDir, "auth.json"));
    if (credentials && state.studentId !== credentials.username)
      throw new AppError("AUTH_REJECTED", "研修间会话与当前统一认证账号不一致");
    return operation(studyRooms(createCampusVpnFetch(session.request, ["ytj.nju.edu.cn"]), state.token, state.userId));
  });
}
export type LibraryRoomServices = ReturnType<typeof createLibraryRoomServices>;
