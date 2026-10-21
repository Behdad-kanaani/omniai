import fs from 'node:fs/promises'
import path from 'node:path'

const MAX_FILE_BYTES = 512 * 1024
const MAX_OUTPUT = 24000
const HIDDEN = new Set(['.git','.next','.omniai-backups','node_modules','.env','.env.local','.env.production','.env.development','.ssh','.aws','.npmrc','.git-credentials','id_rsa','id_ed25519','credentials.json','secrets.json','package-lock.json','pnpm-lock.yaml','yarn.lock'])
const DENIED_EXT = new Set(['.pem','.key','.p12','.pfx','.sqlite','.db','.exe','.dll','.so','.dylib','.zip','.gz','.png','.jpg','.jpeg','.pdf','.wasm'])
const deny = (name: string) => HIDDEN.has(name.toLowerCase()) || name.toLowerCase().startsWith('.env.') || DENIED_EXT.has(path.extname(name).toLowerCase())

export async function resolveWorkspace(rootInput: string): Promise<string> {
  if (!rootInput || !path.isAbsolute(rootInput)) throw new Error('Enter an absolute folder path on the machine running OmniAI.')
  const root = await fs.realpath(rootInput)
  if (!(await fs.stat(root)).isDirectory()) throw new Error('Workspace must be a directory')
  const relative = path.relative(path.parse(root).root, root)
  if (!relative || relative.split(path.sep).length < 2) throw new Error('Choose a project folder, not a drive or system root')
  return root
}

async function scoped(root: string, requested: string, forWrite = false): Promise<string> {
  if (!requested || path.isAbsolute(requested) || requested.includes('\0')) throw new Error('Only relative workspace paths are permitted')
  const pieces = requested.split(/[\\/]+/)
  if (pieces.some(s => !s || s === '..' || s === '.' || deny(s))) throw new Error('Protected or invalid path')
  const candidate = path.resolve(root, ...pieces)
  const rel = path.relative(root, candidate)
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Path escapes workspace')
  // Reject symlinks so paths stay inside the selected workspace.
  let current = root
  for (const part of pieces) {
    current = path.join(current, part)
    try {
      const st = await fs.lstat(current)
      if (st.isSymbolicLink()) throw new Error('Symlinks are not permitted in agent paths')
      if (!st.isDirectory() && current !== candidate) throw new Error('Invalid parent component')
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      if (!forWrite) throw new Error('Path does not exist')
    }
  }
  return candidate
}

export type WorkspaceAction = 'list_files' | 'read_file' | 'search_files' | 'write_file' | 'replace_text'
export async function executeWorkspaceTool(rootInput: string, action: WorkspaceAction, input: Record<string, unknown>): Promise<string> {
  const root = await resolveWorkspace(rootInput)
  const relative = typeof input.path === 'string' ? input.path : '.'
  if (action === 'list_files') {
    const entries: string[] = []
    const walk = async (dir: string, depth: number) => {
      if (entries.length >= 240 || depth > 5) return
      for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
        if (deny(ent.name) || ent.isSymbolicLink()) continue
        const sub = path.join(dir, ent.name)
        const name = path.relative(root, sub).replaceAll('\\','/')
        if (ent.isDirectory()) { entries.push(name + '/'); await walk(sub, depth + 1) }
        else if (ent.isFile()) entries.push(name)
        if (entries.length >= 240) break
      }
    }
    await walk(root, 0)
    return entries.join('\n').slice(0, MAX_OUTPUT) || '(empty project)'
  }
  if (action === 'read_file') {
    const file = await scoped(root, relative)
    const st = await fs.stat(file)
    if (!st.isFile() || st.size > MAX_FILE_BYTES) throw new Error('Not a readable text file or file too large')
    const content = await fs.readFile(file, 'utf8')
    if (content.includes('\0')) throw new Error('Binary file rejected')
    return content.slice(0, MAX_OUTPUT) + (content.length > MAX_OUTPUT ? '\n[truncated]' : '')
  }
  if (action === 'search_files') {
    const needle = typeof input.query === 'string' ? input.query : ''
    if (!needle || needle.length > 120) throw new Error('Provide a query up to 120 characters')
    const results: string[] = []
    const walk = async (dir: string, depth: number) => {
      if (depth > 5 || results.length >= 80) return
      for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
        if (deny(ent.name) || ent.isSymbolicLink()) continue
        const file = path.join(dir, ent.name)
        if (ent.isDirectory()) { await walk(file, depth+1); continue }
        if (!ent.isFile() || (await fs.stat(file)).size > MAX_FILE_BYTES) continue
        const body = await fs.readFile(file, 'utf8')
        if (body.includes('\0')) continue
        body.split('\n').forEach((line, i) => {
          if (results.length < 80 && line.toLowerCase().includes(needle.toLowerCase())) results.push(`${path.relative(root,file)}:${i+1}: ${line.slice(0,180)}`)
        })
      }
    }
    await walk(root, 0)
    return results.join('\n').slice(0,MAX_OUTPUT) || 'No matches'
  }
  if (action === 'write_file' || action === 'replace_text') {
    const file = await scoped(root, relative, true)
    const st = await fs.stat(file).catch((e: NodeJS.ErrnoException) => { if(e.code === 'ENOENT') return null; throw e })
    if (st && (!st.isFile() || st.size > MAX_FILE_BYTES)) throw new Error('Invalid or oversized file')
    if (action === 'write_file') {
      const content = input.content
      if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error('Invalid or oversized content')
      if (st) throw new Error('File exists; use replace_text to edit existing files')
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, content, { flag: 'wx', encoding: 'utf8' })
      return `Created ${relative} (${Buffer.byteLength(content)} bytes)`
    }
    if (!st) throw new Error('File does not exist')
    const oldText = input.old_text, newText = input.new_text
    if (typeof oldText !== 'string' || !oldText || typeof newText !== 'string') throw new Error('Specify old_text and new_text')
    const body = await fs.readFile(file, 'utf8')
    if (body.includes('\0')) throw new Error('Binary file rejected')
    const index = body.indexOf(oldText)
    if (index < 0 || body.indexOf(oldText, index + oldText.length) >= 0) throw new Error('old_text must occur exactly once; read file again')
    const replacement = body.slice(0,index) + newText + body.slice(index+oldText.length)
    if (Buffer.byteLength(replacement) > MAX_FILE_BYTES) throw new Error('Result exceeds size limit')
    // Keep a timestamped backup before every edit.
    const backupDir = path.join(root, '.omniai-backups')
    await fs.mkdir(backupDir, { recursive: true })
    const backup = path.join(backupDir, `${Date.now()}-${Math.random().toString(36).slice(2)}.bak`)
    await fs.copyFile(file, backup)
    await fs.writeFile(file, replacement, 'utf8')
    return `Updated ${relative}. Backup: ${path.relative(root,backup)}`
  }
  throw new Error('Unknown tool')
}
