#!/usr/bin/env node
/**
 * Secret scan that never needs a download.
 *
 * gitleaks is the right tool and CI runs it too, but a gate that depends on
 * fetching a 20 MB binary from a release page is a gate that occasionally does
 * not run — and "the scanner did not run" and "there are no secrets" look
 * identical on a dashboard. This script has no dependencies and scans two
 * things:
 *
 *   1. every file in the working tree that git tracks (and the untracked ones
 *      a developer is about to commit), and
 *   2. every line ever added in the repository's history, via `git log -p`.
 *
 * It is deliberately *not* a general-purpose entropy scanner: those drown in
 * false positives on a codebase full of hex colour codes and content hashes.
 * The rules are the credential shapes this project could plausibly leak — an
 * API key pasted into the enquiry service, a webhook URL in a script, a private
 * key in a fixture.
 *
 *   node tools/scan-secrets.mjs            # scan repo + history
 *   node tools/scan-secrets.mjs --staged   # only what is staged for commit
 *
 * Exit code 1 means a finding. The fix is to rotate the credential and remove
 * it — never to add it to the allowlist below.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAX_FILE_BYTES = 2 * 1024 * 1024
const staged = process.argv.includes('--staged')

/* ------------------------------------------------------------------- rules */

const RULES = [
  {
    id: 'private-key',
    what: 'a private key block',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/,
  },
  {
    id: 'aws-access-key',
    what: 'an AWS access key id',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    id: 'github-token',
    what: 'a GitHub token',
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/,
  },
  {
    id: 'github-pat-fine-grained',
    what: 'a fine-grained GitHub token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/,
  },
  {
    id: 'slack-webhook',
    what: 'a Slack incoming webhook',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{6,}\/B[0-9A-Z]{6,}\/[A-Za-z0-9]{20,}/,
  },
  {
    id: 'slack-token',
    what: 'a Slack token',
    pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/,
  },
  {
    id: 'google-api-key',
    what: 'a Google API key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    id: 'stripe-key',
    what: 'a Stripe secret key',
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: 'resend-key',
    what: 'a Resend API key',
    pattern: /\bre_[A-Za-z0-9]{20,}\b/,
  },
  {
    id: 'sentry-dsn',
    what: 'a Sentry DSN with an embedded key',
    pattern: /https:\/\/[0-9a-f]{32}@[a-z0-9.-]+\/\d+/,
  },
  {
    id: 'jwt',
    what: 'a JSON Web Token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    id: 'assigned-secret',
    what: 'a password or token assigned a literal value',
    pattern:
      /\b(?:password|passwd|pass|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*['"`]([^'"`\s]{12,})['"`]/i,
    // A literal that is obviously a placeholder, a variable reference or an
    // example is not a leak. This is a narrow, documented exception.
    ignore: (value) =>
      /^(?:x{4,}|\*{4,}|\.{3,}|<.*>|\$\{.*\}|process\.env|import\.meta|your[-_]?|change[-_]?me|replace[-_]?|example|placeholder|test|dummy|hunter2|correct horse battery)/i.test(
        value,
      ),
  },
]

/**
 * Paths where a match is expected and harmless. Kept short and explicit: a
 * long allowlist is how a scanner becomes decoration.
 */
const ALLOWED_PATHS = [
  /^\.gitleaks\.toml$/,
  /^tools\/scan-secrets\.mjs$/,
  /^tools\/verify-restore\.sh$/,
  /\.test\.mjs$/,
  /^app\/scripts\/.*\.test\.tsx$/,
  /^docs\//,
  /^README\.md$/,
  /^server\/data\//,
  /^package-lock\.json$/,
  /^app\/package-lock\.json$/,
]

const BINARY = /\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf|otf|mp4|webm|pdf|zip|gz|tar|so|dylib|dll|exe|bin)$/i

const allowed = (path) => ALLOWED_PATHS.some((rule) => rule.test(path))

/* --------------------------------------------------------------- scanning */

const findings = []

function inspect(path, text, where) {
  if (allowed(path)) return
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.length > 2000) continue // minified bundles are not hand-written secrets
    for (const rule of RULES) {
      const match = rule.pattern.exec(line)
      if (!match) continue
      if (rule.ignore?.(match[1] ?? '')) continue
      findings.push({
        path,
        line: index + 1,
        rule: rule.id,
        what: rule.what,
        // Never print the secret itself. Location and rule are enough to fix it.
        excerpt: line
          .replace(match[0], '[redacted]')
          .trim()
          .slice(0, 120),
        where,
      })
    }
  }
}

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options })
}

function scanWorkingTree() {
  const files = staged
    ? git(['diff', '--cached', '--name-only', '--diff-filter=ACM']).split('\n').filter(Boolean)
    : [...new Set([...git(['ls-files']).split('\n'), ...git(['ls-files', '--others', '--exclude-standard']).split('\n')])].filter(
        Boolean,
      )

  let scanned = 0
  for (const path of files) {
    if (BINARY.test(path)) continue
    try {
      if (statSync(join(process.cwd(), path)).size > MAX_FILE_BYTES) continue
      inspect(path, readFileSync(join(process.cwd(), path), 'utf8'), staged ? 'staged' : 'working tree')
      scanned += 1
    } catch {
      // A file listed by git but absent from the working tree (deleted, or a
      // sparse checkout) is not a finding.
    }
  }
  return scanned
}

function scanHistory() {
  let scanned = 0
  try {
    // `-p` on the whole history is one process; parsing added lines only keeps
    // the noise down and makes every finding a line that once existed.
    const log = git(['log', '-p', '--all', '--no-color', '--no-renames', '-U0', '--pretty=format:commit %H'])
    let path = ''
    for (const line of log.split('\n')) {
      if (line.startsWith('+++ b/')) {
        path = line.slice(6)
        continue
      }
      if (line.startsWith('+++') || line.startsWith('---') || !line.startsWith('+')) continue
      if (!path || BINARY.test(path)) continue
      inspect(path, line.slice(1), 'history')
      scanned += 1
    }
  } catch (error) {
    console.error(`warning: could not read git history — ${error.message}`)
  }
  return scanned
}

/* ------------------------------------------------------------------ report */

const filesScanned = scanWorkingTree()
const historyLines = staged ? 0 : scanHistory()

if (findings.length) {
  const unique = new Map()
  for (const finding of findings) {
    const key = `${finding.path}:${finding.rule}`
    if (!unique.has(key)) unique.set(key, finding)
  }
  console.error(`\nFound ${unique.size} possible secret(s):\n`)
  for (const finding of unique.values()) {
    console.error(`  ${finding.path}:${finding.line}  [${finding.where}]`)
    console.error(`    ${finding.what}`)
    console.error(`    ${finding.excerpt}`)
  }
  console.error(
    '\nRotate the credential, remove it from the file, and rewrite the history if it ' +
      'was ever pushed. Do not add it to an allowlist.',
  )
  process.exit(1)
}

console.log(
  `No secrets found. Scanned ${filesScanned} file(s)` +
    (staged ? ' staged for commit.' : ` and ${historyLines} added history line(s).`),
)
