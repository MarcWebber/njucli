import { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import type { CommandRuntime } from "../core/command.js";
import { startMcpServer } from "../mcp/server.js";
import { registerAccountCommands } from "./account.js";
import { registerAggregateCommands } from "./aggregate.js";
import { registerAuthCommands } from "./auth.js";
import { registerCampusCommands } from "./campus.js";
import { registerCourseCommands } from "./course.js";
import { registerLibraryCommands } from "./library.js";
import { registerSportsCommands } from "./sports.js";

export function createCli(services: NjuServices, runtime: CommandRuntime): Command {
  const program = new Command()
    .name("njucli")
    .description("南京大学校园服务命令行工具")
    .version("0.1.0")
    .showHelpAfterError()
    .showSuggestionAfterError();

  const groups = [
    registerAccountCommands(program, services.account, runtime),
    registerAuthCommands(program, services.auth, runtime),
    registerCampusCommands(program, services.campus, runtime),
    registerCourseCommands(program, services.course, runtime),
    registerLibraryCommands(program, services.library, runtime),
    registerSportsCommands(program, services.sports, runtime),
  ];
  for (const group of groups) group.action(() => group.outputHelp());

  registerAggregateCommands(program, services, runtime);
  program.command("mcp")
    .description("启动只读 MCP stdio 服务")
    .action(async () => {
      await startMcpServer(services);
    });
  program.action(() => program.outputHelp());
  return program;
}
