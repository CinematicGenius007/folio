// Minimal assertion helper: prints PASS/FAIL per check and sets a failing exit code if any fail.
const results = [];

/** Records one named check. */
export function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

/** Prints the summary and sets `process.exitCode`. Call once at the end. */
export function finish() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) process.exitCode = 1;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
