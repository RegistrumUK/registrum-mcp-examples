// The "hello world" of driving an MCP server programmatically instead of
// through a chat client: connect over stdio, list what it exposes.
//
//   REGISTRUM_API_KEY=reg_live_... node examples/list-tools.mjs
import { connect } from "./_client.mjs";

const { client, close } = await connect();

const { tools } = await client.listTools();
for (const tool of tools) {
  console.log(`${tool.name} -- ${tool.description.split(".")[0]}.`);
}

await close();
