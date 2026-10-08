import { parseCampusDate } from "../../../src/core/dates.js";
import type { EHallServices } from "../../njucli-ehall/scripts/services.js";
import type { LibraryServices } from "../../njucli-library/scripts/services.js";
import type { SportsServices } from "../../njucli-sports/scripts/services.js";
import { CampusClient } from "./client.js";

export type CampusServices = ReturnType<typeof createCampusServices>;

export function createCampusServices(services: {
  ehall: EHallServices;
  library: LibraryServices;
  sports: SportsServices;
}) {
  const client = new CampusClient(fetch);
  return {
    sources: client.sources.bind(client),
    canteens: client.canteens.bind(client),
    articles: client.articles.bind(client),
    article: client.article.bind(client),
    today: async (date?: string) => {
      const targetDate = parseCampusDate(date);
      const course = await services.ehall.today(targetDate);
      const library = await services.library.loans();
      const bookings = await services.sports.bookings(0, 20);
      return {
        date: targetDate,
        course,
        library,
        sports: bookings.filter((booking) => booking.reservationDate === targetDate),
      };
    },
  };
}
