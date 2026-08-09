// ECCTA use case: check identity-verification state across a portfolio of
// companies ahead of the 18 November 2026 enforcement date.
//
//   node examples/eccta-compliance-check.mjs 00445790 03824658
//
// get_compliance is Pro-plan-gated on a personal API key; the hosted anonymous
// endpoint's shared demo key clears that gate, subject to its own daily cap.
import { connect } from "./_client.mjs";

const companyNumbers = process.argv.slice(2);
if (!companyNumbers.length) {
  console.error("Usage: node examples/eccta-compliance-check.mjs <company_number> [...]");
  process.exit(1);
}

const { call, close } = await connect();

// The distinction that matters, and the one most integrations get wrong:
//
//   pending  -> this person's verification deadline has NOT passed yet.
//               It is a normal state during the transition, not a failure,
//               and reporting it as one will alarm people for no reason.
//   overdue  -> a deadline was actually missed. This is the actionable set.
//
// Collapsing the two into a single "unverified" flag is why a lot of ECCTA
// dashboards currently overstate risk by a wide margin.
const rows = [];

for (const companyNumber of companyNumbers) {
  let c;
  try {
    c = await call("get_compliance", { company_number: companyNumber });
  } catch (e) {
    console.error(`${companyNumber}: ${e.message}`);
    continue;
  }

  // Note: /compliance returns counts keyed by company_number and does not
  // echo the company name -- call get_company if you need it for display.
  rows.push({
    company: companyNumber,
    verified: c.directors_verified + c.pscs_verified,
    pending: c.directors_pending + c.pscs_pending,
    overdue: c.directors_overdue + c.pscs_overdue,
    rate: c.verification_rate,
    risk: c.verification_risk,
  });
}

console.log("Company".padEnd(46), "verified", "pending", "overdue", " rate  risk");
for (const r of rows) {
  console.log(
    r.company.slice(0, 45).padEnd(46),
    String(r.verified).padStart(8),
    String(r.pending).padStart(7),
    String(r.overdue).padStart(7),
    `${(r.rate * 100).toFixed(0)}%`.padStart(6),
    r.risk
  );
}

// Act on `overdue` first -- those are real, missed deadlines. `pending`
// is a watch list with time still on the clock, so sort it by each
// person's own deadline rather than treating the company as one bucket.
const actionable = rows.filter((r) => r.overdue > 0);
console.log(
  actionable.length
    ? `\n${actionable.length} of ${rows.length} companies have at least one OVERDUE person.`
    : `\nNo overdue people across ${rows.length} companies. Pending counts are not failures.`
);

await close();
