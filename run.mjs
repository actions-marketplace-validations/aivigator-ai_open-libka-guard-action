// LibKa Guard as a GitHub Action (action.yml): builds each document with the LibKa command line, which checks every
// output and signs those that pass, or checks finished pages; writes the results to the job summary, marks each
// problem on its line (an annotation), and fails the job when anything fails. Plain Node, so it runs on Linux,
// Windows and macOS runners alike.
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, globSync } from 'node:fs';

const lines = (name) => (process.env[name] ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
const documents = expand(lines('INPUT_DOCUMENTS'));
const pages = expand(lines('INPUT_PAGES'));
const outputs = (process.env.INPUT_OUTPUTS ?? '').trim();

/** This action's version, written in when it is exported (a commit-pinned action has no tag to read it from). */
const VERSION = '2.0.1';

/** The command line to run: the given one, or @libka/cli at this action's version (its tag, or the one written in). */
export function cliSpec(input, ref, own = VERSION) {
  if (input) return input;
  const version = /^v(\d+\.\d+\.\d+)$/.exec(ref ?? '')?.[1] ?? (/^\d+\.\d+\.\d+$/.test(own) ? own : undefined);
  return version ? `@libka/cli@${version}` : '@libka/cli';
}

/** Paths and globs to files, each once, in order. */
function expand(patterns) {
  const found = [];
  for (const p of patterns) {
    const matches = /[*?[{]/.test(p) ? globSync(p).sort() : existsSync(p) ? [p] : [];
    if (!matches.length) fail(`nothing matches ${p}`);
    for (const m of matches) if (!found.includes(m)) found.push(m.split('\\').join('/'));
  }
  return found;
}

function fail(message) {
  console.log(`::error::LibKa Guard: ${message}`);
  process.exit(1);
}

/** A problem line ("guide.md:12: message" or "guide.md: guard ...") as a GitHub annotation on its file and line. */
export function annotation(line) {
  const m = /^([^:\s][^:]*\.(?:md|html)):(?:(\d+):)?\s*(.+)$/.exec(line.trim());
  if (!m) return null;
  const esc = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  return `::error file=${esc(m[1])}${m[2] ? `,line=${m[2]}` : ''}::${esc(m[3])}`;
}

if (process.env.GITHUB_ACTIONS && import.meta.url.endsWith('/run.mjs') && process.argv[1]?.replace(/\\/g, '/').endsWith('/run.mjs')) {
  if (!documents.length && !pages.length) fail('give documents or pages to check');
  const spec = cliSpec(process.env.INPUT_CLI, process.env.ACTION_REF);
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const results = [];
  const run = (args) => spawnSync(npx, ['--yes', `--package=${spec}`, 'libka', ...args], { encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
  for (const [kind, file] of [...documents.map((f) => ['build', f]), ...pages.map((f) => ['check', f])]) {
    const args = kind === 'build' ? ['build', file, ...(outputs ? ['--outputs', outputs] : [])] : ['check', file];
    console.log(`::group::libka ${args.join(' ')}`);
    const r = run(args);
    process.stdout.write(r.stdout ?? '');
    process.stdout.write(r.stderr ?? '');
    console.log('::endgroup::');
    const problems = (r.stderr ?? '').split('\n').filter((l) => l.trim() && !/^libka: /.test(l));
    for (const p of problems) { const a = annotation(p); if (a) console.log(a); }
    results.push({ kind, file, ok: r.status === 0, problems, error: r.error?.message });
  }
  const failed = results.filter((r) => !r.ok);
  const summary = [
    '## LibKa Guard', '',
    `${results.length - failed.length} of ${results.length} passed${failed.length ? `; ${failed.length} failed` : ''}. Command line: \`${spec}\`.`, '',
    '| File | What ran | Result |', '|---|---|---|',
    ...results.map((r) => `| \`${r.file}\` | ${r.kind === 'build' ? 'built and checked' : 'checked'} | ${r.ok ? 'passed' : `**failed**: ${r.problems.length || 1} problem(s)`} |`),
    ...failed.flatMap((r) => ['', `### ${r.file}`, '', '```text', ...(r.problems.length ? r.problems.slice(0, 50) : [r.error ?? 'the command failed']), '```']),
    '',
  ].join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `checked=${results.length}\nfailed=${failed.length}\n`);
  console.log(summary);
  process.exit(failed.length ? 1 : 0);
}
