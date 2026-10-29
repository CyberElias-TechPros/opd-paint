/**
 * Read/write backend for the content-override files the admin layer edits.
 *
 * This is the one piece of the admin that depends on *where* the service
 * runs, and it is kept to this one file on purpose:
 *
 *   - `fs` (default): read and write the JSON file on local disk. Correct for
 *     a self-hosted Node process, a container or a VM with a persistent
 *     filesystem — exactly how this service's own enquiry log already works.
 *     Wrong for a stock serverless deployment: a write there can vanish the
 *     moment the function's container is recycled, and never reaches the
 *     next deployment at all.
 *   - `github`: read and write the same file in the Git repository itself,
 *     through the GitHub Contents API. A save becomes a real commit, which is
 *     what a static-site build actually needs — the typed data files already
 *     treat `sitemap.xml` as "generated and committed", and this is the same
 *     idea applied to content an editor changes from a browser instead of a
 *     build script. Enable it with `OPD_CMS_BACKEND=github`,
 *     `OPD_CMS_GITHUB_TOKEN` (a fine-grained PAT with Contents: Read & write
 *     on this repository only) and `OPD_CMS_GITHUB_REPO` (`owner/name`).
 *
 * Neither backend is reached unless the admin's own Basic Auth
 * (`OPD_ADMIN_USER` / `OPD_ADMIN_PASSWORD`) already passed.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const GITHUB_TOKEN = process.env.OPD_CMS_GITHUB_TOKEN ?? ''
const GITHUB_REPO = process.env.OPD_CMS_GITHUB_REPO ?? ''
const GITHUB_BRANCH = process.env.OPD_CMS_GITHUB_BRANCH ?? 'main'

export function cmsBackend() {
  if (process.env.OPD_CMS_BACKEND === 'github' && GITHUB_TOKEN && GITHUB_REPO) return 'github'
  return 'fs'
}

async function githubRequest(path, options = {}) {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'opudas-paint-admin',
      ...(options.headers ?? {}),
    },
  })
}

async function readGithub(repoPath) {
  const res = await githubRequest(`${repoPath}?ref=${encodeURIComponent(GITHUB_BRANCH)}`)
  if (res.status === 404) return { data: null, sha: null }
  if (!res.ok) throw new Error(`GitHub read failed (${res.status})`)
  const body = await res.json()
  return { data: JSON.parse(Buffer.from(body.content, 'base64').toString('utf8')), sha: body.sha }
}

async function writeGithub(repoPath, data, message) {
  const { sha } = await readGithub(repoPath)
  const content = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8').toString('base64')
  const res = await githubRequest(repoPath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content, branch: GITHUB_BRANCH, sha: sha ?? undefined }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`GitHub write failed (${res.status}): ${detail.slice(0, 300)}`)
  }
}

async function readFs(localPath) {
  try {
    return JSON.parse(await readFile(localPath, 'utf8'))
  } catch {
    return null
  }
}

async function writeFs(localPath, data) {
  await mkdir(dirname(localPath), { recursive: true })
  await writeFile(localPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

/** `file` is `{ localPath, repoPath }` — see OVERRIDE_FILES in admin-content.mjs. */
export async function readOverride(file, fallback) {
  const data = cmsBackend() === 'github' ? (await readGithub(file.repoPath)).data : await readFs(file.localPath)
  return data ?? fallback
}

export async function writeOverride(file, data, message) {
  if (cmsBackend() === 'github') {
    await writeGithub(file.repoPath, data, message)
    return
  }
  await writeFs(file.localPath, data)
}
