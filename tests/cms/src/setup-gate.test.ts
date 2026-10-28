import {
  constantTimeEqual,
  MIN_SETUP_TOKEN_LENGTH,
  presentedSetupToken,
  SETUP_COOKIE,
  SETUP_HEADER,
  setupIsOpen,
} from '@cms/lib/setup-gate'

const TOKEN = 'a-long-owner-token-0123456789'

describe('setup gate (design §4)', () => {
  it('is closed when the owner set no token', () => {
    expect(setupIsOpen(undefined, TOKEN)).toBe(false)
    expect(setupIsOpen('', TOKEN)).toBe(false)
    expect(setupIsOpen(null, TOKEN)).toBe(false)
  })

  it('is closed for a token shorter than the minimum, even when it matches', () => {
    const short = 'x'.repeat(MIN_SETUP_TOKEN_LENGTH - 1)
    expect(setupIsOpen(short, short)).toBe(false)
    const exact = 'x'.repeat(MIN_SETUP_TOKEN_LENGTH)
    expect(setupIsOpen(exact, exact)).toBe(true)
  })

  it('is closed when the request presents nothing or the wrong token', () => {
    expect(setupIsOpen(TOKEN, null)).toBe(false)
    expect(setupIsOpen(TOKEN, '')).toBe(false)
    expect(setupIsOpen(TOKEN, `${TOKEN}x`)).toBe(false)
    expect(setupIsOpen(TOKEN, TOKEN.slice(0, -1))).toBe(false)
  })

  it('opens for exactly the owner token', () => {
    expect(setupIsOpen(TOKEN, TOKEN)).toBe(true)
  })

  it('compares byte for byte, including length and multi-byte text', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
    expect(constantTimeEqual('é', 'e')).toBe(false)
    expect(constantTimeEqual('é', 'é')).toBe(true)
  })

  it('reads the header before the cookie', () => {
    const headers = new Headers({ [SETUP_HEADER]: ' from-header ', cookie: `${SETUP_COOKIE}=from-cookie` })
    expect(presentedSetupToken(headers)).toBe('from-header')
  })

  it('reads its own cookie among others, URL-decoded', () => {
    const headers = new Headers({ cookie: `a=1; ${SETUP_COOKIE}=tok%2Fen; payload-token=x` })
    expect(presentedSetupToken(headers)).toBe('tok/en')
  })

  it('ignores look-alike cookie names and malformed encodings', () => {
    expect(presentedSetupToken(new Headers({ cookie: `x${SETUP_COOKIE}=nope` }))).toBeNull()
    expect(presentedSetupToken(new Headers({ cookie: `${SETUP_COOKIE}=%E0%A4%A` }))).toBeNull()
    expect(presentedSetupToken(new Headers())).toBeNull()
  })
})
