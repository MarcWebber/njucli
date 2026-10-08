import { type CourseServices } from "../../njucli-course/scripts/services.js";
import { type LibraryServices } from "../../njucli-library/scripts/services.js";
import { type SportsServices } from "../../njucli-sports/scripts/services.js";
import { parseCampusDate } from "../../../src/core/dates.js";

export type TodayServices = ReturnType<typeof createTodayServices>;

export function createTodayServices(services: {
  course: CourseServices;
  library: LibraryServices;
  sports: SportsServices;
}) {
  return async (date?: string) => {
    const targetDate = parseCampusDate(date);
    const course = await services.course.today(targetDate);
    const library = await services.library.loans();
    const bookings = await services.sports.bookings(0, 20);
    return {
      date: targetDate,
      course,
      library,
      sports: bookings.filter((booking) => booking.reservationDate === targetDate),
    };
  };
}
