import pg from 'pg'

type Callback = (err: Error | undefined, ...rest: unknown[]) => void
type ScopedClient = pg.Client & { release: (err?: Error | boolean) => void }

/**
 * A `pg.Pool` that does not pool. Payload is given it on Workers in place of
 * pg's own (`postgresAdapter({ pg: requestScopedPg })`).
 *
 * workerd binds every socket to the request that opened it. Payload keeps one
 * pool for the life of the isolate (payloadcms/payload#17335), and pg-pool
 * hands a waiting request whichever client comes free — including a client
 * whose socket belongs to a request that has already ended. That request then
 * hangs until `connectionTimeoutMillis`, the slot never frees, and the isolate
 * stops answering: tuning `max`, `maxUses` or the idle timeout only changes how
 * soon.
 *
 * Hyperdrive already pools the connections to Postgres, so the Worker does not
 * need to: every query, and every transaction, opens its own client from the
 * caller's own request and closes it as soon as it is released.
 */
export class RequestScopedPool extends pg.Pool {
  // Overloaded like pg-pool's: a promise without a callback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override connect(callback?: any): any {
    const opened = this.openClient()
    if (typeof callback !== 'function') return opened
    opened.then(
      (client) => (callback as Callback)(undefined, client, client.release),
      (err: Error) => (callback as Callback)(err),
    )
    return undefined
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override query(...args: any[]): any {
    const callback = typeof args[args.length - 1] === 'function' ? (args.pop() as Callback) : undefined
    const result = this.openClient().then(async (client) => {
      try {
        return await client.query(...(args as [string]))
      } finally {
        client.release()
      }
    })
    if (!callback) return result
    result.then(
      (res) => callback(undefined, res),
      (err: Error) => callback(err),
    )
    return undefined
  }

  private async openClient(): Promise<ScopedClient> {
    // `this.Client` and `this.options` are pg-pool's: the Client class it was
    // built with and the options it was given (connection string, timeouts).
    const self = this as unknown as { Client: typeof pg.Client; options: pg.PoolConfig }
    const client = new self.Client(self.options) as ScopedClient
    let released = false
    // Errors still arrive as 'error' events (an EventEmitter with no listener
    // would throw them at the isolate). Once released, workerd cancelling the
    // closed socket is expected; only an error on a client in use is news.
    client.on('error', (err: Error) => {
      if (released) return
      console.warn(JSON.stringify({ level: 'warn', msg: 'postgres client error', err: err.message }))
    })
    client.release = () => {
      if (released) return
      released = true
      client.end().catch((): void => undefined)
    }
    try {
      await client.connect()
    } catch (err) {
      released = true
      client.end().catch((): void => undefined)
      throw err
    }
    return client
  }
}

/** pg, with RequestScopedPool as its Pool. */
export const requestScopedPg = { ...pg, Pool: RequestScopedPool } as unknown as typeof pg
