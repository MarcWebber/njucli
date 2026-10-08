export const RESERVATION_STATES = { 1: "available", 2: "unavailable", 3: "unpaid", 4: "occupied" } as const;
export const BOOKING_STATES = { 1: "active", 2: "cancelled" } as const;

export interface SportsVenueSiteSummary {
  siteId: string;
  campus: string;
  venue: string;
  name: string;
  sportId: string | null;
  sport: string | null;
  openStart: string | null;
  openEnd: string | null;
}

export interface SportsSlotSchedule {
  date: string;
  slots: Array<{
    startAt: string;
    endAt: string;
    spaces: Array<{
      name: string;
      state: typeof RESERVATION_STATES[keyof typeof RESERVATION_STATES];
    }>;
  }>;
}

export interface SportsBookingSummary {
  bookingId: string;
  campus: string | null;
  venue: string | null;
  site: string | null;
  reservationDate: string;
  reservationDetail: string | null;
  status: typeof BOOKING_STATES[keyof typeof BOOKING_STATES];
}

export interface SportsReservationLink {
  url: string;
  venueSiteId: string;
  date: string;
}
