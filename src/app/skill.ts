import type { Command } from 'commander';
import { addHelpActions, createProgram, createCommandRuntime, type CommandRuntime } from '../core/command.js';
import { registerAuthCommands } from '../auth/commands.js';
import { createAuthServices } from '../auth/service.js';
import { registerAccountCommands } from '../account/commands.js';
import { createAccountServices } from '../account/service.js';
import { startReadMcp, type ReadTool } from '../mcp/read.js';
import type { SkillRuntime } from './runtime.js';

export async function runSkill(name: string, context: SkillRuntime, register: (program: Command, runtime: CommandRuntime) => void, tools?: (read: ReadTool) => void): Promise<void> {
  const program = createProgram(name);
  const runtime = createCommandRuntime();
  registerAccountCommands(program, createAccountServices(context), runtime);
  registerAuthCommands(program, createAuthServices(context), runtime);
  register(program, runtime);
  if (tools) program.command("mcp").description("启动本 Skill 的只读 MCP 服务")
    .action(async () => { await startReadMcp(name, tools); });
  await addHelpActions(program).parseAsync(process.argv);
}
