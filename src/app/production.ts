import { createYouthServices } from '../../skills/njucli-youth/scripts/services.js';
import { createTableServices } from '../../skills/njucli-table/scripts/services.js';
import { createRuntime } from './runtime.js';
import { createAuthServices } from '../auth/service.js';
import { createAccountServices } from '../account/service.js';
import { createBoxServices } from '../../skills/njucli-box/scripts/services.js';
import { SoftwareClient } from '../../skills/njucli-software/scripts/client.js';
import { createMailServices } from '../../skills/njucli-mail/scripts/services.js';
import { CampusClient } from '../../skills/njucli-campus/scripts/client.js';
import { createCourseServices } from '../../skills/njucli-course/scripts/services.js';
import { createAcademicServices } from '../../skills/njucli-academic/scripts/services.js';
import { createEHallServices } from '../../skills/njucli-ehall/scripts/services.js';
import { createSoftSeServices } from '../../skills/njucli-softse/scripts/services.js';
import { createTexServices } from '../../skills/njucli-tex/scripts/services.js';
import { createLibraryServices } from '../../skills/njucli-library/scripts/services.js';
import { createSportsServices } from '../../skills/njucli-sports/scripts/services.js';
import { createTodayServices } from '../../skills/njucli-today/scripts/services.js';
import { createDoctorServices } from '../../skills/njucli-doctor/scripts/services.js';

export function createProductionServices() {
  const runtime = createRuntime();
  const services = {
    auth: createAuthServices(runtime),
    account: createAccountServices(runtime),
    box: createBoxServices(runtime),
    youth: createYouthServices(runtime),
    table: createTableServices(runtime),
    software: new SoftwareClient(),
    mail: createMailServices(runtime),
    campus: new CampusClient(fetch),
    course: createCourseServices(runtime),
    academic: createAcademicServices(runtime),
    ehall: createEHallServices(runtime),
    softse: createSoftSeServices(runtime),
    tex: createTexServices(runtime),
    library: createLibraryServices(runtime),
    sports: createSportsServices(runtime),
    doctor: createDoctorServices(runtime),
  };
  return { ...services, today: createTodayServices(services) };
}

export type NjuServices = ReturnType<typeof createProductionServices>;
