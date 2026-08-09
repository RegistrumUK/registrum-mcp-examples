// Portfolio screening: pull structured financials for a batch of company
// numbers and print a one-line summary each, flagging companies whose
// accounts didn't yield structured data (PDF-only filings, dormant, etc).
//
//   node examples/financial-screening.mjs 00445790 00445790 12345678
import { connect } from "./_client.mjs";

const companyNumbers = process.argv.slice(2);
if (!companyNumbers.length) {
  console.error("Usage: node examples/financial-screening.mjs <company_number> [company_number ...]");
  process.exit(1);
}

const { call, close } = await connect();

for (const companyNumber of companyNumbers) {
  const f = await call("get_financials", { company_number: companyNumber });

  if (!f.available) {
    // Common, not an error: a real share of UK companies file micro-entity
    // or dormant accounts with no P&L, or scanned-PDF accounts with no
    // structured data at all. unavailable_reason tells you which.
    console.log(`${f.company_name ?? companyNumber} (${companyNumber}): unavailable -- ${f.unavailable_reason}`);
    continue;
  }

  // Every profit_and_loss / balance_sheet field is a { current, prior }
  // pair (the two most recent filed years), or null if that field wasn't
  // present in the filing -- never a bare number.
  const fmt = (field) => {
    const v = field?.current;
    return v == null ? "n/a" : `£${v.toLocaleString()}`;
  };
  const { turnover, operating_profit, profit_after_tax } = f.profit_and_loss;
  console.log(
    `${f.company_name} (${companyNumber}) [${f.accounts_type}, FYE ${f.period_end}]: ` +
      `turnover ${fmt(turnover)}, operating profit ${fmt(operating_profit)}, net profit ${fmt(profit_after_tax)}`
  );
  if (f.data_quality.completeness < 1) {
    console.log(`  data_quality: ${Math.round(f.data_quality.completeness * 100)}% of expected fields extracted`);
  }
}

await close();
