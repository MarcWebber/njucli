import { type SkillRuntime } from "../../../src/app/runtime.js";
import { type SportsReservationLink } from "./types.js";
import { exchangeSportsAccessToken, type SportsIdentity } from "../../../src/auth/sports-token.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import { SportsClient } from "./client.js";

export type SportsServices = {
  venues: SportsClient["listVenues"];
  venue: SportsClient["getVenue"];
  slots: SportsClient["listSlots"];
  bookings: SportsClient["listBookings"];
  booking: SportsClient["getBooking"];
  finance: SportsClient["finance"];
  reservationLink(venueSiteId: string, date: string): Promise<SportsReservationLink>;
  cancellationLink(bookingId: string): Promise<{
    url: string;
    bookingId: string;
  }>;
};

export function createSportsServices(runtime: SkillRuntime): SportsServices {
  const { withBrowser } = runtime;
  const withSports = <T>(operation: (client: SportsClient) => Promise<T>): Promise<T> => {
    let client: SportsClient;
    return withBrowser("sports", () => operation(client), async (session) => {
      let identity: SportsIdentity | undefined;
      const token = await exchangeSportsAccessToken(session.request, { onIdentity: value => { identity = value; } });
      client = new SportsClient(session.request, token, identity);
      return true;
    });
  };
  return {
    venues: (sportTypeId) => withSports((client) => client.listVenues(sportTypeId)),
    venue: (venueSiteId) => withSports((client) => client.getVenue(venueSiteId)),
    slots: (venueSiteId, date) => withSports((client) => client.listSlots(venueSiteId, date)),
    bookings: (page, size) => withSports((client) => client.listBookings(page, size)),
    booking: (bookingId) => withSports((client) => client.getBooking(bookingId)),
    finance: (tradeNo) => withSports((client) => client.finance(tradeNo)),
    reservationLink: async (venueSiteId, date) => ({
      url: `https://ggtypt.nju.edu.cn/venue/venue-reservation/${encodeURIComponent(venueSiteId)}`,
      venueSiteId,
      date: parseCampusDate(date),
    }),
    cancellationLink: async (bookingId) => ({
      url: "https://ggtypt.nju.edu.cn/venue/orders",
      bookingId,
    }),
  };
}
