/**
 * Membersihkan sisa proses dev server Next.js untuk project ini.
 *
 * Masalah yang diselesaikan:
 1. Proses `next dev` yatim dari sesi sebelumnya masih memegang port 3001,
    sehingga `npm run dev` gagal dengan `EADDRINUSE: address already in use`.
 2. File lock `.next/dev/lock` tertinggal sehingga Next.js melaporkan
    "Another next dev server is already running" padahal prosesnya sudah mati.
 3. Cache `.next` yang rusak memicu panic Turbopack:
    "Failed to write app endpoint /dashboard/page - Next.js package not found".
 *
 * Hanya menyentuh proses yang command line-nya menunjuk ke project ini,
 * sehingga dev server project lain tidak ikut dibunuh.
 *
 * Argumen:
 *   (kosong)     : selalu bersihkan proses yatim + lock file.
 *   --if-needed  : hanya bersihkan bila port dev sedang terisi proses
 *                   Next.js milik project ini (dipakai oleh script `predev`).
 */

import { execFileSync } from 'node:child_process'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nextDir = path.join(projectRoot, '.next')
const devLock = path.join(nextDir, 'dev', 'lock')
const DEV_PORT = 3001

/** Jalankan perintah, kembalikan stdout, atau string kosong bila gagal. */
function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    return ''
  }
}

/**
 * Daftar proses Node.js yang sedang berjalan.
 * Mengembalikan array of { pid, cmd }.
 */
function listNodeProcesses() {
  if (process.platform === 'win32') {
    // Tulis script PowerShell ke file sementara: menghindari masalah
    // escaping bertingkat antara cmd.exe, PowerShell, dan Node.
    const psFile = path.join(os.tmpdir(), `clean-dev-procs-${process.pid}.ps1`)
    writeFileSync(
      psFile,
      [
        '$ErrorActionPreference = "SilentlyContinue"',
        'Get-CimInstance Win32_Process -Filter "Name = \'node.exe\'" |',
        '  ForEach-Object { "{0}`t{1}" -f $_.ProcessId, $_.CommandLine }',
      ].join('\n'),
      'utf8'
    )

    const out = run('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      psFile,
    ])

    rmSync(psFile, { force: true })

    const result = []
    for (const line of out.split(/\r?\n/)) {
      const tab = line.indexOf('\t')
      if (tab <= 0) continue
      const pid = line.slice(0, tab).trim()
      if (!/^\d+$/.test(pid)) continue
      result.push({ pid, cmd: line.slice(tab + 1).trim() })
    }
    return result
  }

  const out = run('ps', ['-eo', 'pid=,args='])
  const result = []
  for (const line of out.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s+(.*)$/)
    if (!match) continue
    result.push({ pid: match[1], cmd: match[2].trim() })
  }
  return result
}

/** PID proses yang sedang listen di port TCP tertentu. */
function pidsOnPort(port) {
  const pids = new Set()

  if (process.platform === 'win32') {
    const out = run('netstat', ['-ano', '-p', 'TCP'])
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${port}`)) continue
      if (!/\sLISTENING\s/i.test(line)) continue
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (/^\d+$/.test(pid)) pids.add(pid)
    }
    return [...pids]
  }

  const out = run('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'])
  for (const line of out.split(/\r?\n/)) {
    const pid = line.trim()
    if (/^\d+$/.test(pid)) pids.add(pid)
  }
  return [...pids]
}

/**
 * Cari PID proses Next.js (`next dev` / `next start`) milik project ini.
 * Mengembalikan array PID (kosong jika tidak ada).
 */
function findNextProcesses() {
  const pids = new Set()
  const processes = listNodeProcesses()

  for (const { pid, cmd } of processes) {
    if (!cmd) continue
    if (!cmd.includes('next')) continue
    // Milik Next.js project ini ATAU path absolut project ini.
    if (!cmd.includes('node_modules/next') && !cmd.includes(projectRoot)) continue
    pids.add(pid)
  }

  // Fallback: proses apa pun yang sedang memegang port dev.
  for (const pid of pidsOnPort(DEV_PORT)) {
    const proc = processes.find((p) => p.pid === pid)
    if (proc && (!proc.cmd || proc.cmd.includes('node'))) pids.add(pid)
  }

  return [...pids]
}

function killPid(pid) {
  if (process.platform === 'win32') {
    run('taskkill', ['/PID', pid, '/T', '/F'])
  } else {
    try {
      process.kill(Number(pid), 'SIGKILL')
    } catch {
      /* proses sudah mati */
    }
  }
}

const pids = findNextProcesses()

if (process.argv.includes('--if-needed') && pids.length === 0) {
  console.log('[clean-dev] Port dev bebas, tidak ada yang perlu dibersihkan.')
  process.exit(0)
}

if (pids.length > 0) {
  console.log(`[clean-dev] Menghentikan ${pids.length} proses Next.js yatim: ${pids.join(', ')}`)
  for (const pid of pids) killPid(pid)
} else {
  console.log('[clean-dev] Tidak ada proses Next.js yatim.')
}

if (existsSync(devLock)) {
  rmSync(devLock, { force: true })
  console.log('[clean-dev] Lock file .next/dev/lock dihapus.')
}

console.log('[clean-dev] Selesai. Jalankan `npm run dev` untuk start ulang.')