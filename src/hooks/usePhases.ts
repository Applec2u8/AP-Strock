import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '../context/UserContext'

export interface Phase {
    id: number;
    phase_name: string;
    status: 'active' | 'closed';
    user_id?: number;
    created_at?: string;
}

export function usePhases() {
    const { user } = useUser()
    const [phases, setPhases] = useState<Phase[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchPhases = async () => {
        try {
            setLoading(true)
            const { data, error: fetchError } = await supabase
                .from('Phase')
                .select('*')
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError
            if (data) setPhases(data as Phase[])
        } catch (err) {
            setError((err as Error).message || 'Failed to fetch phases')
            console.error('Error fetching phases:', err)
        } finally {
            setLoading(false)
        }
    }

    const createNewPhase = async () => {
        try {
            // Determine next phase number by counting existing records
            const { count: phaseCount } = await supabase
                .from('Phase')
                .select('id', { count: 'exact', head: true })
            let nextNumber = (phaseCount || 0) + 1

            const newPhaseName = `ເຟສ ${nextNumber}`

            // Show confirmation alert
            const confirmed = window.confirm(`ເຈົ້າຕ້ອງການຂື້ນ ເຟສ ໃໝ່ "${newPhaseName}" ແມ່ນ ຫຼື ບໍ່?\n\n ການດຳເນີນການນີ້ຈະເລີມສ້າງລາຍການໃໝ່ທັ້ງໝົດ "ຍືນຍັນ"`)

            if (!confirmed) {
                return null // User cancelled
            }

            if (!user?.id) {
                throw new Error("ບໍ່ພົບຂໍ້ມູນผู้ใช้ (user_id is missing). กรุณาล็อกอินใหม่");
            }

            // Set all existing phases to closed
            await supabase
                .from('Phase')
                .update({ status: 'closed' })
                .neq('status', 'closed')

            // Create new active phase
            const { data, error: insertError } = await supabase
                .from('Phase')
                .insert({
                    phase_name: newPhaseName,
                    status: 'active',
                    user_id: user?.id ?? null
                })
                .select()
                .single()

            if (insertError) throw insertError

            // Refresh phases
            await fetchPhases()
            alert(`ເຟສໃໝ່ "${newPhaseName}" ໄດ້ຖືກສ້າងແລ້ວ!`)

            return data
        } catch (err) {
            setError((err as Error).message || 'Failed to create new phase')
            console.error('Error creating new phase:', err)
            throw err
        }
    }

    // change active phase manually
    const setActivePhase = async (id: number) => {
        try {
            setLoading(true)
            // close all other phases
            await supabase
                .from('Phase')
                .update({ status: 'closed' })
                .neq('id', id)

            const { error: updErr } = await supabase
                .from('Phase')
                .update({ status: 'active' })
                .eq('id', id)

            if (updErr) throw updErr

            await fetchPhases()
        } catch (err) {
            setError((err as Error).message || 'Failed to set active phase')
            console.error('Error setting active phase:', err)
            throw err
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPhases()
    }, [])

    return {
        phases,
        loading,
        error,
        fetchPhases,
        createNewPhase,
        setActivePhase
    }
}