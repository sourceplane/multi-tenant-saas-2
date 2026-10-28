import { signIn } from '../actions'
import { AuthForm } from '../AuthForm'

export const metadata = { title: 'Sign in' }

const safe = (next?: string) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/me')

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <div data-page="login">
      <h1>Sign in</h1>
      <p className="lede">
        New here? <a href={`/register?next=${encodeURIComponent(safe(next))}`}>Create an account</a>.
      </p>
      <AuthForm
        action={signIn}
        next={safe(next)}
        submit="Sign in"
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
        ]}
      />
    </div>
  )
}
