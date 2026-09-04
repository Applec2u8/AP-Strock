import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useUser } from '../../context/UserContext';

export interface Expense {
    id: number;
    description: string;
    amount: number;
    category?: string;
    date?: string;
    phase_id?: number;
    payee_id?: {
        id: number;
        name: string;
    };
    user_id?: {
        id: number;
        fullname: string;
    };
    created_at?: string;
}

export function useExpenses() {
    const user = useUser().user;

    const [expenses, setExpenses] = useState<Expense[]>([])
    const [totalCount, setTotalCount] = useState<number>(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [payees, setPayees] = useState<{ id: number; name: string }[]>([])
    const [loadingPayees, setLoadingPayees] = useState(true)

    // ── Drawer state ──────────────────────────────────────────────────────────
    const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | null>(null)
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

    const openCreateDrawer = () => { setEditingExpense(null); setDrawerMode('create') }
    const openEditDrawer = (expense: Expense) => { setEditingExpense(expense); setDrawerMode('edit') }
    const closeDrawer = () => { setDrawerMode(null); setEditingExpense(null) }
    // ─────────────────────────────────────────────────────────────────────────

    const fetchPayees = async () => {
        try {
            setLoadingPayees(true)
            const { data, error: payeeError } = await supabase
                .from('Payee')
                .select('id, name')
                .order('name', { ascending: true })
            if (payeeError) throw payeeError
            if (data) setPayees(data)
        } catch (err) {
            console.error('Error fetching payees:', err)
        } finally {
            setLoadingPayees(false)
        }
    }

    const fetchExpenses = async () => {
        try {
            setLoading(true)
            setError(null)
            const { data, error: supabaseError, count } = await supabase
                .from('Expenses')
                .select('*, user_id(*), payee_id(*), phase_id!inner( phase_name, status)', { count: 'exact' })
                .eq('phase_id.status', 'active')
                .order('created_at', { ascending: false })
            if (supabaseError) throw supabaseError
            if (data) setExpenses(data as Expense[])
            if (typeof count === 'number') setTotalCount(count)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch expenses'
            setError(errorMessage)
            console.error('Error fetching expenses:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('ທ່ານແນ່ໃຈບໍ່ວ່າທ່ານຕ້ອງການລຶບລາຍການນີ້?')) return
        const snapshot = expenses
        setExpenses(prev => prev.filter(e => e.id !== id))
        try {
            setError(null)
            const { error: delError } = await supabase.from('Expenses').delete().eq('id', id)
            if (delError) throw delError
        } catch (err) {
            setExpenses(snapshot)
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete expense'
            setError(errorMessage)
            console.error('Error deleting expense:', err)
        }
    }

    /**
     * Submit handler for ExpenseForm (both create & edit).
     * Called with { description, amount, payee_id } from the form.
     */
    const handleSubmitForm = async (data: {
        description: string;
        amount: number;
        payee_id: number | undefined;
    }) => {
        if (drawerMode === 'create') {
            await _createExpense(data)
        } else if (drawerMode === 'edit' && editingExpense) {
            await _updateExpense(editingExpense.id, data)
        }
        closeDrawer()
    }

    const _createExpense = async (data: { description: string; amount: number; payee_id: number | undefined }) => {
        // Optimistic update
        const tempId = Date.now() * -1
        const tempExpense: Expense = {
            id: tempId,
            description: data.description,
            amount: data.amount,
            payee_id: data.payee_id ? payees.find(p => p.id === data.payee_id) : undefined,
            user_id: user ? { id: user.id as any, fullname: user.user_metadata?.fullname || '' } : undefined,
            created_at: new Date().toISOString(),
        }
        setExpenses(prev => [tempExpense, ...prev])
        setTotalCount(prev => prev + 1)

        try {
            setError(null)
            const { data: activePhase } = await supabase.from('Phase').select('id').eq('status', 'active').single()
            const expenseData: any = {
                description: data.description,
                amount: data.amount,
                user_id: user?.id,
                phase_id: activePhase?.id || null,
            }
            if (data.payee_id) expenseData.payee_id = data.payee_id

            const { data: inserted, error: insError } = await supabase
                .from('Expenses')
                .insert(expenseData)
                .select('*, user_id(*), payee_id(*), phase_id(*)')
                .single()
            if (insError) throw insError
            if (inserted) setExpenses(prev => prev.map(e => e.id === tempId ? (inserted as unknown as Expense) : e))
            window.dispatchEvent(new CustomEvent("refresh-notifications"))
        } catch (err) {
            setExpenses(prev => prev.filter(e => e.id !== tempId))
            setTotalCount(prev => prev - 1)
            throw err
        }
    }

    const _updateExpense = async (id: number, data: { description: string; amount: number; payee_id: number | undefined }) => {
        const snapshot = expenses
        setExpenses(prev => prev.map(e => e.id === id ? {
            ...e,
            description: data.description,
            amount: data.amount,
            payee_id: data.payee_id ? payees.find(p => p.id === data.payee_id) || e.payee_id : e.payee_id,
        } : e))

        try {
            setError(null)
            const updateData: any = { description: data.description, amount: data.amount, user_id: user?.id }
            if (data.payee_id) updateData.payee_id = data.payee_id

            const { data: updated, error: upError } = await supabase
                .from('Expenses')
                .update(updateData)
                .eq('id', id)
                .select('id, description, amount, payee_id(id, name), created_at')
                .single()
            if (upError) throw upError
            if (updated) setExpenses(prev => prev.map(e => e.id === id ? (updated as unknown as Expense) : e))
        } catch (err) {
            setExpenses(snapshot)
            throw err
        }
    }

    useEffect(() => {
        fetchExpenses()
        fetchPayees()
    }, [])

    return {
        expenses,
        totalCount,
        loading,
        error,
        payees,
        loadingPayees,
        fetchExpenses,
        handleDelete,
        handleSubmitForm,
        // drawer state
        drawerMode,
        editingExpense,
        openCreateDrawer,
        openEditDrawer,
        closeDrawer,
    }
}
