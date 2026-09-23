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
      state: "available" | "unavailable" | "unpaid" | "occupied";
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
  status: "active" | "cancelled";
}

export interface SportsReservationLink {
  url: string;
  venueSiteId: string;
  date: string;
}
