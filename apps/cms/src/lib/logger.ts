// Workers Logs index JSON lines; Payload's default pino logger writes
// pretty-printed text. Same shape as Payload's own Cloudflare template.
type Fn = (...args: unknown[]) => void
const line =
  (level: string, fn: Fn) =>
  (objOrMsg: object | string, msg?: string): void => {
    if (typeof objOrMsg === 'string') fn(JSON.stringify({ level, msg: objOrMsg }))
    else fn(JSON.stringify({ level, ...objOrMsg, msg: msg ?? (objOrMsg as { msg?: string }).msg }))
  }

export const cloudflareLogger = {
  level: process.env.PAYLOAD_LOG_LEVEL || 'info',
  trace: line('trace', console.debug),
  debug: line('debug', console.debug),
  info: line('info', console.log),
  warn: line('warn', console.warn),
  error: line('error', console.error),
  fatal: line('fatal', console.error),
  silent: () => {},
  // Payload's logger type is pino's; it is not exported in a form a plain
  // object can satisfy, so the template casts here as well.
} as never
