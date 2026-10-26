import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, relative, extname } from 'node:path'

// Print paths/categories only, never matching credential text.
const root = resolve('.')
const failures = []
const secrets = []
for (const name of ['.env.local', '.env.development.local']) {
  try {
    for (const line of readFileSync(name, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (!match || match[1].startsWith('VITE_')) continue
      const value = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
      if (value.length >= 20) secrets.push(value)
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
}
function scan(path, buffer) {
  const text = buffer.toString('utf8')
  if (secrets.some(value => text.includes(value))) failures.push([path, 'local-secret-value'])
  for (const [label, pattern] of [
    ['google-key', /AIza[\w-]{30,}/], ['openai-key', /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/],
    ['supabase-secret', /sb_secret_[A-Za-z0-9_-]{20,}/], ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ]) if (pattern.test(text)) failures.push([path,label])
  for (const token of text.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try { if (JSON.parse(Buffer.from(token[0].split('.')[1], 'base64url')).role === 'service_role') failures.push([path,'service-role-jwt']) } catch { /* Not a decodable JWT. */ }
  }
}
if (process.argv.includes('--staged')) {
  const paths = execFileSync('git',['diff','--cached','--name-only','--diff-filter=ACMR','-z']).toString().split('\0').filter(Boolean)
  for (const path of paths) {
    if (/^(?:reports|outputs|\.vercel|\.agents|\.codex|\.release-check)\//.test(path) || /(?:^|\/)\.env/.test(path) && path !== '.env.example' || /\.(?:pem|key|pdf|docx|base64)$/i.test(path)) failures.push([path,'forbidden-source-artifact'])
    scan(path, execFileSync('git',['show',`:${path}`],{maxBuffer:8*1024*1024}))
  }
  console.log(`Reviewed ${paths.length} staged files; local secret values were not printed.`)
} else {
  const files = []
  function walk(dir) { for (const item of readdirSync(dir,{withFileTypes:true})) {const path=resolve(dir,item.name);if(item.isDirectory())walk(path);else files.push(path)} }
  walk(resolve('dist'))
  const entries = new Set(['index.html','push-admin.html','auth-callback.html','support.html','privacy-policy.html','.well-known/apple-app-site-association','.well-known/assetlinks.json'])
  for (const path of files) {
    const rel=relative(resolve('dist'),path).replaceAll('\\','/')
    if (!entries.has(rel) && !/^assets\/[A-Za-z0-9_-]+\.(?:js|css|png)$/.test(rel)) failures.push([rel,'unexpected-output-artifact'])
    if (['.js','.css','.html','.json'].includes(extname(path))) scan(rel,readFileSync(path))
  }
  console.log(`Reviewed ${files.length} build artifacts; source maps, evidence and documents are excluded.`)
}
if (failures.length) { console.error(JSON.stringify({failures}));process.exit(1) }
console.log('Release boundary scan passed.')
