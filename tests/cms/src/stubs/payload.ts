// The one runtime value the CMS's collections import from 'payload'. Jest maps
// 'payload' here so the suite exercises the CMS's own rules without loading
// Payload (types are erased; tsc still checks them against the real package).
export class APIError extends Error {
  status: number
  data: unknown
  isPublic: boolean
  constructor(message: string, status = 500, data: unknown = null, isPublic = false) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.data = data
    this.isPublic = isPublic
  }
}
