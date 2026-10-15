import type { Command } from "commander";
import { createRuntime } from "./runtime.js";
import { addHelpActions, createProgram, type CommandRuntime } from "../core/command.js";
import { registerAccountCommands } from "../account/commands.js";
import { createAccountServices } from "../account/service.js";
import { registerAuthCommands } from "../auth/commands.js";
import { createAuthServices } from "../auth/service.js";
import { registerUpgradeCommand } from "../commands/upgrade.js";
import { startReadMcp, type ReadTool } from "../mcp/read.js";
import { InstitutionClient } from "../../skills/njucli-institution/scripts/client.js";
import { registerInstitutionCommands } from "../../skills/njucli-institution/scripts/commands.js";
import { registerInstitutionTools } from "../../skills/njucli-institution/scripts/mcp.js";
import { createBoxServices } from "../../skills/njucli-box/scripts/services.js";
import { registerBoxCommands } from "../../skills/njucli-box/scripts/commands.js";
import { registerBoxTools } from "../../skills/njucli-box/scripts/mcp.js";
import { createYouthServices } from "../../skills/njucli-youth/scripts/services.js";
import { registerYouthCommands } from "../../skills/njucli-youth/scripts/commands.js";
import { registerYouthTools } from "../../skills/njucli-youth/scripts/mcp.js";
import { ItxiaClient } from "../../skills/njucli-itxia/scripts/client.js";
import { registerItxiaCommands } from "../../skills/njucli-itxia/scripts/commands.js";
import { registerItxiaTools } from "../../skills/njucli-itxia/scripts/mcp.js";
import { createTableServices } from "../../skills/njucli-table/scripts/services.js";
import { registerTableCommands } from "../../skills/njucli-table/scripts/commands.js";
import { registerTableTools } from "../../skills/njucli-table/scripts/mcp.js";
import { createCampusServices } from "../../skills/njucli-campus/scripts/services.js";
import { registerCampusCommands } from "../../skills/njucli-campus/scripts/commands.js";
import { registerCampusTools } from "../../skills/njucli-campus/scripts/mcp.js";
import { createEHallServices } from "../../skills/njucli-ehall/scripts/services.js";
import { registerEHallCommands } from "../../skills/njucli-ehall/scripts/commands.js";
import { registerEHallTools } from "../../skills/njucli-ehall/scripts/mcp.js";
import { createLibraryServices } from "../../skills/njucli-library/scripts/services.js";
import { registerLibraryCommands } from "../../skills/njucli-library/scripts/commands.js";
import { registerLibraryTools } from "../../skills/njucli-library/scripts/mcp.js";
import { createMailServices } from "../../skills/njucli-mail/scripts/services.js";
import { registerMailCommands } from "../../skills/njucli-mail/scripts/commands.js";
import { registerMailTools } from "../../skills/njucli-mail/scripts/mcp.js";
import { SoftwareClient } from "../../skills/njucli-software/scripts/client.js";
import { registerSoftwareCommands } from "../../skills/njucli-software/scripts/commands.js";
import { registerSoftwareTools } from "../../skills/njucli-software/scripts/mcp.js";
import { createSportsServices } from "../../skills/njucli-sports/scripts/services.js";
import { registerSportsCommands } from "../../skills/njucli-sports/scripts/commands.js";
import { registerSportsTools } from "../../skills/njucli-sports/scripts/mcp.js";
import { createSeServices } from "../../skills/njucli-se/scripts/services.js";
import { registerSeCommands } from "../../skills/njucli-se/scripts/commands.js";
import { registerSeTools } from "../../skills/njucli-se/scripts/mcp.js";
import { createLmsServices } from "../../skills/njucli-lms/scripts/client.js";
import { registerLmsCommands, registerLmsTools } from "../../skills/njucli-lms/scripts/commands.js";
import { createTexServices } from "../../skills/njucli-tex/scripts/services.js";
import { registerTexCommands } from "../../skills/njucli-tex/scripts/commands.js";
import { registerTexTools } from "../../skills/njucli-tex/scripts/mcp.js";

export function createCli(runtime: CommandRuntime): Command {
  const context = createRuntime();
  const program = createProgram("njucli").description("南京大学校园服务命令行工具");
  const readTools: Array<(read: ReadTool) => void> = [];
  const ehall = createEHallServices(context);
  const library = createLibraryServices(context);
  const sports = createSportsServices(context);

  function mount<T>(
    service: T,
    commands: (program: Command, service: T, runtime: CommandRuntime) => Command,
    tools: (read: ReadTool, service: T) => void,
  ): void {
    commands(program, service, runtime);
    readTools.push(read => tools(read, service));
  }

  mount(new InstitutionClient(), registerInstitutionCommands, registerInstitutionTools);
  registerAccountCommands(program, createAccountServices(context), runtime);
  registerAuthCommands(program, createAuthServices(context), runtime);
  mount(createBoxServices(context), registerBoxCommands, registerBoxTools);
  mount(createYouthServices(context), registerYouthCommands, registerYouthTools);
  mount(new ItxiaClient(), registerItxiaCommands, registerItxiaTools);
  mount(createTableServices(context), registerTableCommands, registerTableTools);
  mount(createCampusServices({ ehall, library, sports }), registerCampusCommands, registerCampusTools);
  mount(ehall, registerEHallCommands, registerEHallTools);
  mount(library, registerLibraryCommands, registerLibraryTools);
  mount(createMailServices(context), registerMailCommands, registerMailTools);
  mount(new SoftwareClient(), registerSoftwareCommands, registerSoftwareTools);
  mount(sports, registerSportsCommands, registerSportsTools);
  mount(createSeServices(context), registerSeCommands, registerSeTools);
  mount(createLmsServices(context), registerLmsCommands, registerLmsTools);
  mount(createTexServices(context), registerTexCommands, registerTexTools);

  registerUpgradeCommand(program, runtime);
  program.command("mcp").description("启动只读 MCP stdio 服务")
    .action(async () => {
      await startReadMcp("njucli", read => {
        for (const register of readTools) register(read);
      });
    });
  return addHelpActions(program);
}
