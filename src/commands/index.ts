import { registerYouthCommands } from '../../skills/njucli-youth/scripts/commands.js';
import { registerTableCommands } from '../../skills/njucli-table/scripts/commands.js';
import { registerTodayCommand } from '../../skills/njucli-today/scripts/commands.js';
import { registerDoctorCommand } from '../../skills/njucli-doctor/scripts/commands.js';
import type { Command } from "commander";

import type { NjuServices } from "../app/production.js";
import { addHelpActions, createProgram, type CommandRuntime } from "../core/command.js";
import { startMcpServer } from "../mcp/server.js";
import { registerAccountCommands } from "../account/commands.js";
import { registerAcademicCommands } from "../../skills/njucli-academic/scripts/commands.js";
import { registerAuthCommands } from "../auth/commands.js";
import { registerBoxCommands } from "../../skills/njucli-box/scripts/commands.js";
import { registerCampusCommands } from "../../skills/njucli-campus/scripts/commands.js";
import { registerCourseCommands } from "../../skills/njucli-course/scripts/commands.js";
import { registerEHallCommands } from "../../skills/njucli-ehall/scripts/commands.js";
import { registerLibraryCommands } from "../../skills/njucli-library/scripts/commands.js";
import { registerMailCommands } from "../../skills/njucli-mail/scripts/commands.js";
import { registerSoftwareCommands } from "../../skills/njucli-software/scripts/commands.js";
import { registerSportsCommands } from "../../skills/njucli-sports/scripts/commands.js";
import { registerSoftSeCommands } from "../../skills/njucli-softse/scripts/commands.js";
import { registerTexCommands } from "../../skills/njucli-tex/scripts/commands.js";
import { registerUpgradeCommand } from "./upgrade.js";

export function createCli(services: NjuServices, runtime: CommandRuntime): Command {
  const program = createProgram("njucli").description("南京大学校园服务命令行工具");

  registerAccountCommands(program, services.account, runtime);
  registerAcademicCommands(program, services.academic, runtime);
  registerAuthCommands(program, services.auth, runtime);
  registerBoxCommands(program, services.box, runtime);
  registerYouthCommands(program, services.youth, runtime);
  registerTableCommands(program, services.table, runtime);
  registerCampusCommands(program, services.campus, runtime);
  registerCourseCommands(program, services.course, runtime);
  registerEHallCommands(program, services.ehall, runtime);
  registerLibraryCommands(program, services.library, runtime);
  registerMailCommands(program, services.mail, runtime);
  registerSoftwareCommands(program, services.software, runtime);
  registerSportsCommands(program, services.sports, runtime);
  registerSoftSeCommands(program, services.softse, runtime);
  registerTexCommands(program, services.tex, runtime);

  registerTodayCommand(program, services.today, runtime);
  registerDoctorCommand(program, services.doctor, runtime);
  registerUpgradeCommand(program, runtime);
  program.command("mcp")
    .description("启动只读 MCP stdio 服务")
    .action(async () => {
      await startMcpServer(services);
    });
  return addHelpActions(program);
}
