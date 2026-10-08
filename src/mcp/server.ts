import { registerYouthTools } from '../../skills/njucli-youth/scripts/mcp.js';
import { registerTableTools } from '../../skills/njucli-table/scripts/mcp.js';
import type { NjuServices } from '../app/production.js';
import { startReadMcp } from './read.js';
import { registerBoxTools } from '../../skills/njucli-box/scripts/mcp.js';
import { registerSoftwareTools } from '../../skills/njucli-software/scripts/mcp.js';
import { registerMailTools } from '../../skills/njucli-mail/scripts/mcp.js';
import { registerCampusTools } from '../../skills/njucli-campus/scripts/mcp.js';
import { registerEHallTools } from '../../skills/njucli-ehall/scripts/mcp.js';
import { registerSeTools } from '../../skills/njucli-se/scripts/mcp.js';
import { registerTexTools } from '../../skills/njucli-tex/scripts/mcp.js';
import { registerLibraryTools } from '../../skills/njucli-library/scripts/mcp.js';
import { registerSportsTools } from '../../skills/njucli-sports/scripts/mcp.js';

export function startMcpServer(services: NjuServices) {
  return startReadMcp('njucli', read => {
    registerBoxTools(read, services.box);
    registerYouthTools(read, services.youth);
    registerTableTools(read, services.table);
    registerSoftwareTools(read, services.software);
    registerMailTools(read, services.mail);
    registerCampusTools(read, services.campus);
    registerEHallTools(read, services.ehall);
    registerSeTools(read, services.se);
    registerTexTools(read, services.tex);
    registerLibraryTools(read, services.library);
    registerSportsTools(read, services.sports);
  });
}
