import EntryManager from '@/components/task-entries/EntryManager'

export default async function TaskEntriesPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams
  const initialSubject = subject === 'chinese' || subject === 'english' || subject === 'life' ? subject : 'math'
  return <EntryManager key={initialSubject} initialSubject={initialSubject} />
}
