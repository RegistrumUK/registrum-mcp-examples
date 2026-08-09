// The "hello world" of driving an MCP server programmatically instead of
// through a chat client: connect to the hosted endpoint, list what it exposes.
//
//   node examples/list-tools.mjs
import { connect } from "./_client.mjs";

const { client, close } = await connect();

const { tools } = await client.listTools();
for (const tool of tools) {
  console.log(`${tool.name} -- ${tool.description.split(".")[0]}.`);
}

await close();
