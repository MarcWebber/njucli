import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { errorEnvelope } from '../core/output.js';
import { redact } from '../core/redaction.js';

const OUTPUT = {
  outputSchema: {
    data: z.unknown().describe("The result returned by the corresponding NjuCLI service"),
  },
} as const;

type WriteAnnotations = { destructiveHint: boolean; idempotentHint?: boolean };

export type McpTool = <S extends z.ZodRawShape>(name: string, description: string, inputSchema: S, operation: (args: z.output<z.ZodObject<S>>) => Promise<unknown>, write?: WriteAnnotations) => void;

export function createMcpServer(name: string, register: (tool: McpTool) => void): McpServer {
  const server = new McpServer({ name, version: '0.1.0' });
  const tool: McpTool = (name, description, inputSchema, operation, write) => {
    const schema = z.object(inputSchema);
    const annotations = write
      ? { readOnlyHint: false, destructiveHint: write.destructiveHint, idempotentHint: write.idempotentHint ?? false, openWorldHint: true }
      : { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
    server.registerTool<typeof OUTPUT.outputSchema, typeof schema>(name, { description, inputSchema: schema, ...OUTPUT, annotations }, args => mcpResult(() => operation(args)));
  };
  register(tool);
  return server;
}

export async function startMcp(name: string, register: (tool: McpTool) => void): Promise<McpServer> {
  const server = createMcpServer(name, register);
  await server.connect(new StdioServerTransport());
  return server;
}

async function mcpResult<T>(operation: () => Promise<T>) {
  try {
    const data = redact(await operation());
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true, data }, null, 2) }],
      structuredContent: { data },
    };
  }
  catch (error) {
    const payload = errorEnvelope(error);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      isError: true as const,
    };
  }
}
