// Shared helper: connect to the hosted, keyless Registrum MCP endpoint over
// streamable HTTP and return a ready client plus a `call()` that parses the
// JSON text content MCP tools return (they don't return native JSON -- see
// README gotcha #1).
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const HOSTED_URL = "https://registrum.co.uk/api/mcp";

export async function connect() {
  const transport = new StreamableHTTPClientTransport(new URL(HOSTED_URL));

  const client = new Client({ name: "registrum-mcp-examples", version: "1.0.0" });
  await client.connect(transport);

  async function call(name, args) {
    const result = await client.callTool({ name, arguments: args });
    if (result.isError) {
      throw new Error(result.content[0].text);
    }
    // Tool results come back as { content: [{ type: "text", text: "<json string>" }] },
    // not as structured JSON -- you always parse it yourself.
    const parsed = JSON.parse(result.content[0].text);
    // Every Registrum API response is wrapped in a standard envelope --
    // { status, data, cached, cache_age_seconds, data_source } -- and the
    // MCP tools pass that envelope through unchanged. The payload you
    // actually want is always under `.data`.
    return parsed.data;
  }

  return { client, call, close: () => client.close() };
}
