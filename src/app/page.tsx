import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const cookieStore = await cookies()
  const sessionUser = cookieStore.get('session_user')

  if (sessionUser?.value) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}