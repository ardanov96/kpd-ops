import { redirect } from 'next/navigation'

export default function AnalitikPage() {
  redirect('/dashboard?tab=periode')
}