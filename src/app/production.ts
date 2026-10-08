import { createYouthServices } from '../../skills/njucli-youth/scripts/services.js';
import { createTableServices } from '../../skills/njucli-table/scripts/services.js';
import { createRuntime } from './runtime.js';
import { createAuthServices } from '../auth/service.js';
import { createAccountServices } from '../account/service.js';
import { createBoxServices } from '../../skills/njucli-box/scripts/services.js';
import { SoftwareClient } from '../../skills/njucli-software/scripts/client.js';
import { createMailServices } from '../../skills/njucli-mail/scripts/services.js';
import { createCampusServices } from '../../skills/njucli-campus/scripts/services.js';
import { createEHallServices } from '../../skills/njucli-ehall/scripts/services.js';
import { createSeServices } from '../../skills/njucli-se/scripts/services.js';
import { createTexServices } from '../../skills/njucli-tex/scripts/services.js';
import { createLibraryServices } from '../../skills/njucli-library/scripts/services.js';
import { createSportsServices } from '../../skills/njucli-sports/scripts/services.js';

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
    ehall: createEHallServices(runtime),
    se: createSeServices(runtime),
    tex: createTexServices(runtime),
    library: createLibraryServices(runtime),
    sports: createSportsServices(runtime),
  };
  return { ...services, campus: createCampusServices(services) };
}

export type NjuServices = ReturnType<typeof createProductionServices>;
