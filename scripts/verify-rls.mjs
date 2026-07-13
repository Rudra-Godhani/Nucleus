/**
 * Runs every SQL proof in supabase/tests/ against the linked Supabase project.
 *
 * Each proof is a self-contained transaction that rolls back, so this is safe to
 * run against a live database as often as you like.
 *
 * A proof fails by RAISEing, which the CLI surfaces as a non-zero exit — so a
 * broken RLS policy breaks this command rather than quietly passing.
 *
 * Usage: npm run db:verify
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const TESTS_DIR = join(import.meta.dirname, "..", "supabase", "tests");
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const proofs = readdirSync(TESTS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (proofs.length === 0) {
  console.error("No SQL proofs found in supabase/tests/");
  process.exit(1);
}

let failed = 0;

for (const proof of proofs) {
  process.stdout.write(`\n▸ ${proof}\n`);

  // Pass the file rather than the SQL text: a leading `-- comment` on stdin gets
  // parsed as a CLI flag.
  const result = spawnSync(
    npx,
    ["supabase", "db", "query", "--linked", "-f", join(TESTS_DIR, proof)],
    { encoding: "utf8", shell: process.platform === "win32" },
  );

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();

  if (result.status === 0) {
    // The RAISE NOTICE from a passing proof is the evidence it actually ran.
    const notice = output.match(/PASS:.*/)?.[0];
    console.log(`  ✓ ${notice ?? "passed"}`);
  } else {
    failed += 1;
    console.error(`  ✗ FAILED\n${output.replace(/^/gm, "    ")}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${proofs.length} RLS proof(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${proofs.length} RLS proof(s) passed.`);
