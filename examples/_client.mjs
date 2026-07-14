// Shared helper: connect to the Registrum MCP server over stdio and
// return a ready client plus a `call()` that parses the JSON text content
// MCP tools return (they don't return native JSON -- see README gotcha #1).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function connect() {
  const apiKey = process.env.REGISTRUM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Set REGISTRUM_API_KEY first. Free key, no credit card: https://registrum.co.uk"
    );
  }

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@registrum/mcp"],
    env: { ...process.env, REGISTRUM_API_KEY: apiKey },
  });

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
