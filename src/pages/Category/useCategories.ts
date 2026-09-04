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

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const openCreateDrawer = () => { setEditingCategory(null); setDrawerMode('create') }
  const openEditDrawer = (category: Category) => { setEditingCategory(category); setDrawerMode('edit') }
  const closeDrawer = () => { setDrawerMode(null); setEditingCategory(null) }
  // ─────────────────────────────────────────────────────────────────────────

  const fetchCategories = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: supabaseError, count } = await supabase
        .from('Category')
        .select('*', { count: 'exact' })
        .order('id', { ascending: false })
      if (supabaseError) throw supabaseError
      if (data) setCategories(data as Category[])
      if (typeof count === 'number') setTotalCount(count)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch categories'
      setError(errorMessage)
      console.error('Error fetching categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ທ່ານແນ່ໃຈບໍ່ວ່າທ່ານຕ້ອງການລູບຫມວດຫມນນີ້?')) return
    const snapshot = categories
    setCategories(prev => prev.filter(c => c.id !== id))
    try {
      setError(null)
      const { error: delError } = await supabase.from('Category').delete().eq('id', id)
      if (delError) throw delError
    } catch (err) {
      setCategories(snapshot)
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete category'
      setError(errorMessage)
      console.error('Error deleting category:', err)
    }
  }

  /**
   * Submit handler for CategoryForm (both create & edit).
   * Called with the category name string.
   */
  const handleSubmitForm = async (name: string) => {
    if (drawerMode === 'create') {
      await _createCategory(name)
    } else if (drawerMode === 'edit' && editingCategory) {
      await _updateCategory(editingCategory.id, name)
    }
    closeDrawer()
  }

  const _createCategory = async (name: string) => {
    const tempId = Date.now() * -1
    const tempItem: Category = { id: tempId, name }
    setCategories(prev => [tempItem, ...prev])
    setTotalCount(prev => prev + 1)
    try {
      setError(null)
      const { data, error: insError } = await supabase
        .from('Category')
        .insert({ name, user_id: user?.id ?? null })
        .select()
        .single()
      if (insError) throw insError
      if (data) setCategories(prev => prev.map(c => c.id === tempId ? (data as Category) : c))
    } catch (err) {
      setCategories(prev => prev.filter(c => c.id !== tempId))
      setTotalCount(prev => prev - 1)
      throw err
    }
  }

  const _updateCategory = async (id: number, name: string) => {
    const snapshot = categories
    setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    try {
      setError(null)
      const { data, error: upError } = await supabase
        .from('Category')
        .update({ name })
        .eq('id', id)
        .select()
        .single()
      if (upError) throw upError
      if (data) setCategories(prev => prev.map(c => c.id === id ? (data as Category) : c))
    } catch (err) {
      setCategories(snapshot)
      throw err
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
    handleSubmitForm,
    // drawer state
    drawerMode,
    editingCategory,
    openCreateDrawer,
    openEditDrawer,
    closeDrawer,
  }
}
