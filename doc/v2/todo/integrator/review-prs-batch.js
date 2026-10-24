export const meta = {
  name: 'review-prs-batch',
  description: 'Read-only review of several PRs (one reviewer per PR dimension), then adversarial verification of each finding set',
  phases: [
    { title: 'Review', detail: 'one reviewer per PR dimension' },
    { title: 'Verify', detail: 'one skeptic per dimension tries to refute each finding' },
  ],
}

const RULES = `Rules: do NOT modify any file, do NOT run npm, build, tests, lint or the app (the owner asked that build/test verification not be done by these agents; another process runs the gate). Reading files and read-only git commands are fine (git -C <checkout> ...). Report only real, specific problems in this PR's own changes, anchored to file:line. "blocking" = wrong behaviour a user would see, a broken contract that a dependent task cannot build on without rewriting this one, a listener/resource leak on destroy, data loss, or a crash. "important" = should be fixed soon. "minor" = polish. Prefer fewer, solid findings. English.`

const FINDINGS = {
  type: 'object',
  properties: { findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['blocking', 'important', 'minor'] }, title: { type: 'string' }, file: { type: 'string' },
    line: { type: 'integer' }, detail: { type: 'string' }, scenario: { type: 'string' } },
    required: ['severity', 'title', 'file', 'line', 'detail', 'scenario'] } } },
  required: ['findings'],
}
const VERDICTS = {
  type: 'object',
  properties: { verdicts: { type: 'array', items: { type: 'object', properties: {
    index: { type: 'integer' }, real: { type: 'boolean' }, severity: { type: 'string', enum: ['blocking', 'important', 'minor'] }, reason: { type: 'string' } },
    required: ['index', 'real', 'severity', 'reason'] } } },
  required: ['verdicts'],
}

const ITEMS = []
for (const t of args.targets) for (const d of t.dims) ITEMS.push({ t, d })

const results = await pipeline(
  ITEMS,
  ({ t, d }) => agent(`${t.intro}\n\n${RULES}\n\n${d.prompt}`, { label: `review:#${t.pr}:${d.key}`, phase: 'Review', schema: FINDINGS, effort: 'high' }),
  (review, { t, d }) => {
    const findings = (review && review.findings) || []
    if (findings.length === 0) return { pr: t.pr, key: d.key, findings: [], verdicts: [] }
    const list = findings.map((f, i) => `[${i}] (${f.severity}) ${f.title}\n  at ${f.file}:${f.line}\n  ${f.detail}\n  scenario: ${f.scenario}`).join('\n\n')
    return agent(`${t.intro}\n\n${RULES}\n\nYou are a skeptical verifier. Another reviewer reported the findings below for the ${d.key} dimension of PR #${t.pr}. For EACH one, read the actual code and try to REFUTE it: is the scenario reachable, is the behaviour actually wrong, is it introduced by this PR, is the severity right? Default to real=false when evidence is unclear. Re-grade severity.\n\n${list}`,
      { label: `verify:#${t.pr}:${d.key}`, phase: 'Verify', schema: VERDICTS, effort: 'high' })
      .then(v => ({ pr: t.pr, key: d.key, findings, verdicts: (v && v.verdicts) || [] }))
  },
)

const byPr = {}
for (const t of args.targets) byPr[t.pr] = { confirmed: [], refuted: 0, reviewed: 0 }
results.forEach((r, i) => {
  const pr = ITEMS[i].t.pr
  if (!r) { log(`review of #${pr}:${ITEMS[i].d.key} returned nothing`); return }
  byPr[pr].reviewed++
  let real = 0
  for (const v of r.verdicts) {
    const f = r.findings[v.index]
    if (f && v.real) { real++; byPr[pr].confirmed.push({ dimension: r.key, ...f, severity: v.severity, verifierReason: v.reason }) }
  }
  byPr[pr].refuted += r.findings.length - real
})
return byPr