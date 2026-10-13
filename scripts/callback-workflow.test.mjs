import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
test('use callback credentials only for OmGithub callbacks; resolve release without GitHub REST', () => {
  const workflow = read('.github/workflows/opencode-reusable.yml')
  assert.doesNotMatch(workflow, /api\.github\.com\/repos\/anomalyco\/opencode\/releases/)
  assert.match(workflow, /url_effective.*https:\/\/github.com\/anomalyco\/opencode\/releases\/latest/)
  assert.match(workflow, /name: Register Actions progress\n        continue-on-error: true/)
  for (const name of ['run-record.mjs', 'session-deploy.mjs', 'session-lifecycle.mjs']) {
    const code = read(`scripts/${name}`)
    assert.match(code, /authorization: `Bearer \$\{env.OMGITHUB_CALLBACK_TOKEN/)
    assert.doesNotMatch(code, /authorization: `Bearer \$\{env.GH_TOKEN/)
  }
})
test('grant OIDC permission and bootstrap before checkout in both jobs', () => {
  for (const name of ['opencode-prepare.yml', 'opencode-reusable.yml']) {
    const workflow = read(`.github/workflows/${name}`)
    assert.match(workflow, /id-token: write/)
    assert.ok(workflow.indexOf('name: Authenticate status callbacks') < workflow.indexOf('uses: actions/checkout'))
    assert.match(workflow, /ACTIONS_ID_TOKEN_REQUEST_URL/)
  }
})
test('report failed execution before the debug hold keeps Actions running', () => {
  const workflow = read('.github/workflows/opencode-reusable.yml')
  const early = workflow.indexOf('name: Report failed build before debug hold')
  const hold = workflow.indexOf('name: Keep temporary access available')
  const final = workflow.indexOf('name: Report terminal build status')
  assert.ok(early > 0 && early < hold && hold < final)
  const step = workflow.slice(early, hold)
  assert.match(step, /if: failure\(\)/)
  assert.match(step, /"outcome\\":\\"failure\\"/)
  assert.match(step, /issues\/\$TRIGGER_ISSUE_NUMBER\/run/)
})
