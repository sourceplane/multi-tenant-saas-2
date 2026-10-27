import { register } from '../actions'
import { AuthForm } from '../AuthForm'

export const metadata = { title: 'Create an account' }

const safe = (next?: string) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/')

export default async function Register({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <div data-page="register">
      <h1>Create an account</h1>
      <p className="lede">
        Already have one? <a href={`/login?next=${encodeURIComponent(safe(next))}`}>Sign in</a>.
      </p>
      <AuthForm
        action={register}
        next={safe(next)}
        submit="Create account"
        fields={[
          { name: 'name', label: 'Your name', type: 'text', autoComplete: 'name', hint: 'As it should appear on your certificates.' },
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', hint: 'At least 10 characters.' },
        ]}
      />
    </div>
  )
}
