// How a lesson's video URL is shown. Only https URLs are used at all;
// YouTube and Vimeo become their embed players (YouTube's privacy-enhanced
// domain), a direct .mp4/.webm file plays in <video>, and anything else is a
// plain link. Pure: tests/cms exercises it.

export type VideoEmbed = { kind: 'iframe'; src: string } | { kind: 'file'; src: string } | { kind: 'link'; href: string } | undefined

export function videoEmbed(raw: string | null | undefined): VideoEmbed {
  if (!raw) return undefined
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:') return undefined
  const host = url.hostname.replace(/^www\./, '')
  const id = (s: string | null | undefined) => (s && /^[A-Za-z0-9_-]{6,20}$/.test(s) ? s : undefined)
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = id(url.searchParams.get('v')) ?? id(url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1])
    if (v) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${v}` }
  }
  if (host === 'youtu.be') {
    const v = id(url.pathname.slice(1))
    if (v) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${v}` }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const v = url.pathname.match(/(\d{6,12})/)?.[1]
    if (v) return { kind: 'iframe', src: `https://player.vimeo.com/video/${v}` }
  }
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: 'file', src: url.toString() }
  return { kind: 'link', href: url.toString() }
}
