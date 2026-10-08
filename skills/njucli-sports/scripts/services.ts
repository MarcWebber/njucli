import { type SkillRuntime } from "../../../src/app/runtime.js";
import { type SportsReservationLink } from "./types.js";
import { exchangeSportsAccessToken } from "../../../src/auth/sports-token.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import { SportsClient } from "./client.js";

export type SportsServices = {
  venues: SportsClient["listVenues"];
  venue: SportsClient["getVenue"];
  slots: SportsClient["listSlots"];
  bookings: SportsClient["listBookings"];
  booking: SportsClient["getBooking"];
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
      client = new SportsClient(session.request, await exchangeSportsAccessToken(session.request));
      return true;
    });
  };
  return {
    venues: (sportTypeId) => withSports((client) => client.listVenues(sportTypeId)),
    venue: (venueSiteId) => withSports((client) => client.getVenue(venueSiteId)),
    slots: (venueSiteId, date) => withSports((client) => client.listSlots(venueSiteId, date)),
    bookings: (page, size) => withSports((client) => client.listBookings(page, size)),
    booking: (bookingId) => withSports((client) => client.getBooking(bookingId)),
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
