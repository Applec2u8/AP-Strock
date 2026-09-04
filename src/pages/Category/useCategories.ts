import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useUser } from '../../context/UserContext'

export interface Category {
  id: number;
  name: string;
  user_id?: number;
  created_at?: string;
}

export function useCategories() {
  const { user } = useUser()
  const [categories, setCategories] = useState<Category[]>([])
  const [totalCount, setTotalCount] = useState<number>(3)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: supabaseError, count } = await supabase
        .from('Category')
        .select('*', { count: 'exact' })
        .order('id', { ascending: false })

      if (supabaseError) {
        throw supabaseError
      }

      if (data) {
        setCategories(data as Category[])
      }
      if (typeof count === 'number') {
        setTotalCount(count)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories'
      setError(errorMessage)
      console.error('Error fetching categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ທ່ານແນ່ໃຈບໍ່ວ່າທ່ານຕ້ອງການລຶບໝວດໝູ່ນີ້?')) return
    try {
      setLoading(true)
      setError(null)
      const { error: delError } = await supabase.from('Category').delete().eq('id', id)
      if (delError) throw delError
      setCategories((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete category'
      setError(errorMessage)
      console.error('Error deleting category:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (category: Category) => {
    const newName = prompt('Enter new category name', category.name)
    if (newName === null) return
    const trimmed = newName.trim()
    if (!trimmed) return
    try {
      setLoading(true)
      setError(null)
      const { data, error: upError } = await supabase
        .from('Category')
        .update({ name: trimmed })
        .eq('id', category.id)
        .select()
        .single()

      if (upError) throw upError
      if (data) setCategories((prev) => prev.map((c) => (c.id === category.id ? (data as Category) : c)))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update category'
      setError(errorMessage)
      console.error('Error updating category:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    const name = prompt('ເພີມລາຍການໝວດໝູ່ໃໝ່')
    if (name === null) return
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      setLoading(true)
      setError(null)
      const { data, error: insError } = await supabase
        .from('Category')
        .insert({ name: trimmed, user_id: user?.id ?? null })
        .select()
        .single()

      if (insError) throw insError
      if (data) setCategories((prev) => [data as Category, ...prev])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create category'
      setError(errorMessage)
      console.error('Error creating category:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  return {
    categories,
    totalCount,
    loading,
    error,
    fetchCategories,
    handleDelete,
    handleUpdate,
    handleCreate,
  }
}
