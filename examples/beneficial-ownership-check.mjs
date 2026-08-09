// KYB/AML use case: given a company name, resolve it to a number, then
// walk the PSC chain to find who ultimately controls it -- natural
// persons, foreign entities, or a reason the chain terminated early.
//
//   node examples/beneficial-ownership-check.mjs "Tesco PLC"
import { connect } from "./_client.mjs";

const companyName = process.argv[2];
if (!companyName) {
  console.error('Usage: node examples/beneficial-ownership-check.mjs "Company Name"');
  process.exit(1);
}

const { call, close } = await connect();

const { items } = await call("search_company", { query: companyName });
if (!items?.length) {
  console.error(`No company found matching "${companyName}"`);
  await close();
  process.exit(1);
}

const { company_number, company_name } = items[0];
console.log(`${company_name} (${company_number})\n`);

// max_depth defaults to 5 -- each level costs 1 upstream call per corporate
// entity found, so cap it explicitly if you're screening in bulk.
const chain = await call("get_psc_chain", { company_number, max_depth: 5 });

// get_psc_chain returns a tree, not a flat list: each node has a `pscs`
// array, and any PSC that's a corporate entity you can keep following has
// a nested `children` node. Walk it to collect where every branch ends.
function collectTerminalNodes(node, path = []) {
  const label = node.company_name ?? node.company_number;
  const trail = [...path, label];
  const terminals = [];
  for (const psc of node.pscs ?? []) {
    if (psc.terminal) {
      terminals.push({ name: psc.name ?? psc.description ?? "(unnamed)", reason: psc.terminal_reason, via: trail });
    } else if (psc.children) {
      terminals.push(...collectTerminalNodes(psc.children, trail));
    }
  }
  return terminals;
}

const { chain_metadata } = chain;
console.log(`Resolved ${chain_metadata.companies_resolved} companies (depth used: ${chain_metadata.depth_used}).`);
if (chain_metadata.max_depth_reached) {
  console.log("Chain was cut off by max_depth -- raise it for a fuller picture.");
}

console.log("\nWho ultimately controls this company:");
for (const terminal of collectTerminalNodes(chain)) {
  console.log(`  - ${terminal.name}  [${terminal.reason}]`);
}

await close();
