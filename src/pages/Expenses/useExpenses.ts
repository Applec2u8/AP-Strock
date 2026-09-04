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

            if (supabaseError) {
                throw supabaseError
            }

            if (data) {
                setExpenses(data as Expense[])
            }
            if (typeof count === 'number') {
                setTotalCount(count)
            }
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
        try {
            setLoading(true)
            setError(null)
            const { error: delError } = await supabase.from('Expenses').delete().eq('id', id)
            if (delError) throw delError
            setExpenses((prev) => prev.filter((e) => e.id !== id))
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete expense'
            setError(errorMessage)
            console.error('Error deleting expense:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdate = async (expense: Expense) => {
        const newDescription = prompt('ລາຍລະອຽດການໃຊ້ຈ່າຍ', expense.description)
        if (newDescription === null) return
        const trimmed = newDescription.trim()
        if (!trimmed) return

        let amount: number
        while (true) {
            const newAmount = prompt('ຈຳນວນເງິນ (ກົດໄດ້ແຕ່ຕົວເລກເທົ່ານັ້ນ)', String(expense.amount))
            if (newAmount === null) return

            amount = parseFloat(newAmount)
            if (!isNaN(amount) && amount >= 0) {
                break
            }
            alert('ກະລຸນາປ້ອນຈຳນວນເງິນທີ່ຖືກຕ້ອງ (ຕົວເລກເທົ່ານັ້ນ)')
        }

        // ເລືອກຜູ້ຮັບບໍລິການ
        let selectedPayeeId = typeof expense.payee_id === 'object' && expense.payee_id?.id ? expense.payee_id.id : undefined
        if (payees.length > 0) {
            const payeeOptions = payees.map((p, idx) => `${idx + 1}: ${p.name}`).join('\n')
            const currentPayeeName = typeof expense.payee_id === 'object' && expense.payee_id?.name ? expense.payee_id.name : 'ບໍ່ມີ'
            const payeeChoice = prompt(`ເລືອກຜູ້ຮັບບໍລິການ (ປະຈຸບັນ: ${currentPayeeName}):\n${payeeOptions}\n\nພິມຫມາຍເລກ (1-${payees.length}) ຫຼືຝາກໄວ້ວ່າງ:`, '')
            if (payeeChoice && payeeChoice.trim()) {
                const choice = parseInt(payeeChoice.trim())
                if (!isNaN(choice) && choice >= 1 && choice <= payees.length) {
                    selectedPayeeId = payees[choice - 1].id
                }
            }
        }
        // ຕັ້ງຄ່າ: ຖ້າຜູ້ຮັບບໍລິການທີດືງຄນ෣ກັ້ງຄໍາຮ້ອງ ແຫນບຸຸຮິໃຫ່ມ (ຜູ້ຮັບບໍລິການດອອກ)
        if (!selectedPayeeId && payees.length > 0) {
            alert('ກະລຸນາເລືອກຜູ້ຮັບບໍລິການກ່ອນບັນທືກ')
            return
        }
        try {
            setLoading(true)
            setError(null)
            const updateData: any = { description: trimmed, amount, user_id: user?.id }

            if (selectedPayeeId) {
                updateData.payee_id = selectedPayeeId
            }

            const { data, error: upError } = await supabase
                .from('Expenses')
                .update(updateData)
                .eq('id', expense.id)
                .select('id, description, amount, payee_id(id, name), created_at')
                .single()

            if (upError) throw upError
            if (data) setExpenses((prev) => prev.map((e) => (e.id === expense.id ? (data as unknown as Expense) : e)))
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update expense'
            setError(errorMessage)
            console.error('Error updating expense:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = async (payeeId?: number) => {
        const description = prompt('ລາຍລະອຽດການໃຊ້ຈ່າຍ')
        if (description === null || !description.trim()) return

        let amount: number
        while (true) {
            const amountStr = prompt('ຈຳນວນເງິນ (ກົດໄດ້ແຕ່ຕົວເລກເທົ່ານັ້ນ)')
            if (amountStr === null) return

            amount = parseFloat(amountStr)
            if (!isNaN(amount) && amount >= 0) {
                break
            }
            alert('ກະລຸນາປ້ອນຈຳນວນເງິນທີ່ຖືກຕ້ອງ (ຕົວເລກເທົ່ານັ້ນ)')
        }

        // ເລືອກຜູ້ຮັບບໍລິການ
        let selectedPayeeId = payeeId
        if (!selectedPayeeId && payees.length > 0) {
            const payeeOptions = payees.map((p, idx) => `${idx + 1}: ${p.name}`).join('\n')
            const payeeChoice = prompt(`ເລືອກຜູ້ຮັບບໍລິການ:\n${payeeOptions}\n\nພິມຫມາຍເລກ (1-${payees.length}) ຫຼືຝາກໄວ້ວ່າງ:`, '')
            if (payeeChoice && payeeChoice.trim()) {
                const choice = parseInt(payeeChoice.trim())
                if (!isNaN(choice) && choice >= 1 && choice <= payees.length) {
                    selectedPayeeId = payees[choice - 1].id
                }
            }
        }

        // ຕັ້ງຄ່າ: ຖ້າບໍ່ມີຜູ້ຮັບບໍລິການໄດ້ຖືກເລືອກ ແລະ ມີຜູ້ຮັບບໍລິການອື່ນໆ ໃຫ້ກະກັ້ງຄໍາຮ້ອງແລະບໍ່ບັນທືກ
        if (!selectedPayeeId && payees.length > 0) {
            alert('ກະລຸນາເລືອກຜູ້ຮັບບໍລິການກ່ອນບັນທືກ')
            return
        }

        try {
            setLoading(true)
            setError(null)

            // attach current active phase id
            const { data: activePhase } = await supabase
                .from('Phase')
                .select('id')
                .eq('status', 'active')
                .single()

            const expenseData: any = {
                description: description.trim(),
                amount,
                user_id: user?.id,
                phase_id: activePhase?.id || null,
            }

            if (selectedPayeeId) {
                expenseData.payee_id = selectedPayeeId
            }

            const { data, error: insError } = await supabase
                .from('Expenses')
                .insert(expenseData)
                .select()
                .single()

            if (insError) throw insError
            if (data) setExpenses((prev) => [data as Expense, ...prev])

            // refresh notifications
            window.dispatchEvent(new CustomEvent("refresh-notifications"));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create expense'
            setError(errorMessage)
            console.error('Error creating expense:', err)
        } finally {
            setLoading(false)
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
        handleUpdate,
        handleCreate,
    }
}
