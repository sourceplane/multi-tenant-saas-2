import { OAuthCallback } from './OAuthCallback'

export const dynamic = 'force-dynamic'

// Where identity-worker sends a GitHub or Google sign-in back to, with the
// token in the URL fragment (#token=…), which never reaches a server.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { redirect } = await searchParams
  return <OAuthCallback redirect={typeof redirect === 'string' ? redirect : '/admin'} />
}
