import fs from 'fs'
import path from 'path'

// True only inside the deployed Worker. `next build` and the payload CLI run
// with NODE_ENV=production too, so production alone is not enough: the CLI
// entrypoints are recognised by the script being run, and Next's build-time
// page-data workers — whose argv is not the `next` binary — by NEXT_PHASE.
export function isWorkersRuntime(): boolean {
  if (process.env.NODE_ENV !== 'production') return false
  if (process.env.NEXT_PHASE === 'phase-production-build') return false
  const cliEntrypoints = [path.join('payload', 'bin.js'), path.join('next', 'dist', 'bin', 'next')]
  const isCLI = process.argv.some((arg) => {
    try {
      const resolved = fs.existsSync(arg) ? fs.realpathSync(arg) : arg
      return cliEntrypoints.some((entry) => resolved.endsWith(entry))
    } catch {
      return false
    }
  })
  return !isCLI
}
