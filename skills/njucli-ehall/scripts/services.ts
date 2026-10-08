import { type SkillRuntime } from "../../../src/app/runtime.js";
import { EHallPortalClient, serviceLink } from "./client.js";
import { EHallTripClient } from "./trip.js";

export type EHallServices = Pick<EHallPortalClient, "services" | "tasks" | "applications"> & Pick<EHallTripClient, "trip" | "submitTrip"> & { serviceLink: typeof serviceLink };

export function createEHallServices(runtime: SkillRuntime): EHallServices {
  const { withBrowser } = runtime;
  const withEHall = <T>(operation: (client: EHallPortalClient) => Promise<T>): Promise<T> => withBrowser("ehall", (session) => operation(new EHallPortalClient(session.request)));
  return {
    trip: () => withBrowser("ehall", (session, account) => new EHallTripClient(session.request, account.configDir).trip()),
    submitTrip: (input, dryRun) => withBrowser("ehall", (session, account) => new EHallTripClient(session.request, account.configDir).submitTrip(input, dryRun)),
    services: (query) => withEHall((client) => client.services(query)),
    tasks: (kind, page, pageSize) => withEHall((client) => client.tasks(kind, page, pageSize)),
    applications: (state, page, pageSize) => withEHall((client) => client.applications(state, page, pageSize)),
    serviceLink,
  };
}
