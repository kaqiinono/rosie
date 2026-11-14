import { supabase } from '@rosie/core'

export async function readAll<T>(table: string, columns: string, order: string): Promise<T[]> {
  const result: T[] = []
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from(table).select(columns)
    for (const column of order.split(',')) query = query.order(column)
    const { data, error } = await query.range(offset, offset + 499)
    if (error) throw error
    result.push(...(data as unknown as T[]))
    if (data.length < 500) return result
  }
}
