import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { errorEnvelope } from '../core/output.js';
import { redact } from '../core/redaction.js';

const READ_ONLY_TOOL = {
  outputSchema: {
    data: z.unknown().describe("The result returned by the corresponding NjuCLI service"),
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
} as const;

export type ReadTool = <S extends z.ZodRawShape>(name: string, description: string, inputSchema: S, operation: (args: z.output<z.ZodObject<S>>) => Promise<unknown>) => void;

export async function startReadMcp(name: string, register: (read: ReadTool) => void): Promise<McpServer> {
  const server = new McpServer({ name, version: '0.1.0' });
  const read: ReadTool = (name, description, inputSchema, operation) => {
    const schema = z.object(inputSchema);
    server.registerTool<typeof READ_ONLY_TOOL.outputSchema, typeof schema>(name, { description, inputSchema: schema, ...READ_ONLY_TOOL }, args => mcpRead(() => operation(args)));
  };
  register(read);
  await server.connect(new StdioServerTransport());
  return server;
}

async function mcpRead<T>(operation: () => Promise<T>) {
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
