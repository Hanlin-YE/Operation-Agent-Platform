import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createContentOperationsMcpServer } from "./contentOperationsServer";

async function main() {
  const server = createContentOperationsMcpServer();
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "content operations MCP server failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
