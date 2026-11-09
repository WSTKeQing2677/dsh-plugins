/**
 * Refresh the market index from each plugin repo's latest GitHub Release.
 *
 * Why this exists: format 1 requires a 40-hex commit for a Git source, so every published
 * version is pinned by design. The cost of pinning is manual re-generation — this script
 * removes that cost by resolving the pin from the release tag itself.
 *
 * Run locally to preview: node scripts/update-index.mjs --check
 * Run in CI: node scripts/update-index.mjs          (writes index.json when it changed)
 */
import { readFileSync, writeFileSync } from 'node:fs'

const check = process.argv.includes('--check')
const API = 'https://api.github.com'
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN

const headers = {
  accept: 'application/vnd.github+json',
  'user-agent': 'dsh-plugin-market-index-updater',
  ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
}

async function get(path) {
  const response = await fetch(`${API}${path}`, { headers })
  if (!response.ok) throw new Error(`${path} -> HTTP ${response.status} ${response.statusText}`)
  return response.json()
}

/** owner/repo from a repository URL like https://github.com/owner/repo */
function slugOf(url) {
  const match = /^https?:\/\/[^/]+\/([^/]+)\/([^/#]+?)(?:\.git)?\/?$/.exec(url)
  if (match === null) throw new Error(`cannot read owner/repo from ${url}`)
  return { owner: match[1], repo: match[2] }
}

/** "v1.0.2" -> "1.0.2"; refuses anything that is not a SemVer tag. */
function versionOf(tag) {
  const version = tag.replace(/^v/u, '')
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u.test(version)) {
    throw new Error(`tag ${tag} is not a SemVer release tag`)
  }
  return version
}

const index = JSON.parse(readFileSync('index.json', 'utf8'))
const changes = []

for (const plugin of index.plugins) {
  const { owner, repo } = slugOf(plugin.repository?.url ?? plugin.homepage ?? '')
  const release = await get(`/repos/${owner}/${repo}/releases/latest`)
  if (release.draft === true || release.prerelease === true) {
    console.log(`${plugin.name}: latest release is draft/prerelease, skipped`)
    continue
  }

  const version = versionOf(release.tag_name)
  const ref = await get(`/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(release.tag_name)}`)
  const commit = ref.object?.sha
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/u.test(commit)) {
    throw new Error(`${plugin.name}: tag ${release.tag_name} does not resolve to a commit sha`)
  }
  const publishTimestamp = Math.floor(new Date(release.published_at).getTime() / 1000)

  const current = plugin.versions[0]
  const next = { version, publishTimestamp, commit }
  const same = current?.version === version &&
    current?.publishTimestamp === publishTimestamp &&
    current?.source?.commit === commit
  if (same) {
    console.log(`${plugin.name}: up to date (${version})`)
    continue
  }

  console.log(`${plugin.name}: ${current?.version ?? '(none)'} -> ${version} @ ${commit.slice(0, 8)}`)
  changes.push({ plugin, next })
}

if (changes.length === 0) {
  console.log('no changes')
  process.exit(0)
}

for (const { plugin, next } of changes) {
  plugin.versions = [{
    version: next.version,
    publishTimestamp: next.publishTimestamp,
    source: { ...plugin.versions[0].source, commit: next.commit },
    ...(plugin.versions[0].engines === undefined ? {} : { engines: plugin.versions[0].engines }),
  }]
}

if (check) {
  console.log(`would update ${changes.length} plugin(s) (--check, not writing)`)
  process.exit(0)
}

writeFileSync('index.json', `${JSON.stringify(index, null, 2)}\n`, 'utf8')
console.log(`wrote index.json (${changes.length} plugin(s) updated)`)
