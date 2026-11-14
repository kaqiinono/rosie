import { AdminExamEditorPage } from '@rosie/exams'
import { notFound } from 'next/navigation'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeId } = await params
  let id: string
  try {
    // Page params can retain URL escapes; the editor encodes the API segment itself.
    id = decodeURIComponent(routeId)
  } catch {
    notFound()
  }
  return <AdminExamEditorPage id={id} />
}
