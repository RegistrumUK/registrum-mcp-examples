// Corporate group / related-party discovery: find every company that
// shares a current director with the target company.
//
//   node examples/director-network-map.mjs 00445790 --depth=2
import { connect } from "./_client.mjs";

const companyNumber = process.argv[2];
if (!companyNumber) {
  console.error("Usage: node examples/director-network-map.mjs <company_number> [--depth=1|2]");
  process.exit(1);
}
const depthArg = process.argv.find((a) => a.startsWith("--depth="));
const depth = depthArg ? Number(depthArg.split("=")[1]) : 1;

const { call, close } = await connect();

// depth=2 needs a Pro/Enterprise Registrum key -- Free/Web keys get a 403
// from the underlying API with an upgrade_url. depth=1 works on every plan.
const network = await call("get_network", { company_number: companyNumber, depth });

console.log(
  `${network.total_connections} connected companies, ${network.total_shared_directors} shared directorships (depth ${network.depth}).`
);
if (network.truncated) {
  console.log(`Truncated at ${network.truncated_at} companies -- more connections exist at this depth.`);
}

for (const conn of network.connections) {
  console.log(
    `  ${conn.company_name || conn.company_number} (${conn.company_number}) [${conn.company_status}] -- shared: ${conn.shared_directors.join(", ")}`
  );
}

await close();
