import { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import type { CommandRuntime } from "../core/command.js";
import { startMcpServer } from "../mcp/server.js";
import { registerAccountCommands } from "./account.js";
import { registerAcademicCommands } from "./academic.js";
import { registerAggregateCommands } from "./aggregate.js";
import { registerAuthCommands } from "./auth.js";
import { registerCampusCommands } from "./campus.js";
import { registerCourseCommands } from "./course.js";
import { registerEHallCommands } from "./ehall.js";
import { registerLibraryCommands } from "./library.js";
import { registerMailCommands } from "./mail.js";
import { registerSoftwareCommands } from "./software.js";
import { registerSportsCommands } from "./sports.js";
import { registerSoftSeCommands } from "./softse.js";
import { registerTexCommands } from "./tex.js";
import { registerUpgradeCommand } from "./upgrade.js";
import { registerYouthCommands } from "./youth.js";

export function createCli(services: NjuServices, runtime: CommandRuntime): Command {
  const program = new Command()
    .name("njucli")
    .enablePositionalOptions()
    .description("南京大学校园服务命令行工具")
    .version("0.1.0")
    .showHelpAfterError()
    .showSuggestionAfterError();

  const groups = [
    registerAccountCommands(program, services.account, runtime),
    registerAcademicCommands(program, services.academic, runtime),
    registerAuthCommands(program, services.auth, runtime),
    registerCampusCommands(program, services.campus, runtime),
    registerCourseCommands(program, services.course, runtime),
    registerEHallCommands(program, services.ehall, runtime),
    registerLibraryCommands(program, services.library, runtime),
    registerMailCommands(program, services.mail, runtime),
    registerSoftwareCommands(program, services.software, runtime),
    registerSportsCommands(program, services.sports, runtime),
    registerSoftSeCommands(program, services.softse, runtime),
    registerTexCommands(program, services.tex, runtime),
    registerYouthCommands(program, services.youth, runtime),
  ];
  for (const group of groups) group.action(() => group.outputHelp());

  registerAggregateCommands(program, services, runtime);
  registerUpgradeCommand(program, runtime);
  program.command("mcp")
    .description("启动只读 MCP stdio 服务")
    .action(async () => {
      await startMcpServer(services);
    });
  program.action(() => program.outputHelp());
  return program;
}
