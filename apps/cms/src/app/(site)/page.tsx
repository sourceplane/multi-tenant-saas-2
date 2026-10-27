export const dynamic = 'force-dynamic'

// The CMS's own front door. Products built on this baseline read content from
// /api (REST) or /api/graphql; editors work in /admin.
export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '4rem auto', padding: '0 1rem', lineHeight: 1.6 }}>
      <h1>Multi Tenant Saas 2 CMS</h1>
      <p>
        Editors sign in at <a href="/admin">/admin</a>. Published content is served from{' '}
        <code>/api/pages</code>, <code>/api/posts</code> and <code>/api/categories</code>, and over
        GraphQL at <code>/api/graphql</code>.
      </p>
    </main>
  )
}
