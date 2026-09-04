import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface SaleItem {
    id: number
    order_id?: any
    pro_id?: any
    qty?: number
    price?: number
    created_at?: string
}

export function useSales() {
    const [sales, setSales] = useState<SaleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [page, setPage] = useState(1)
    const perPage = 10
    const [totalCount, setTotalCount] = useState(0)

    const fetchSales = useCallback(async (pageNum: number = 1) => {
        try {
            setLoading(true)
            setError(null)

            const from = (pageNum - 1) * perPage
            const to = pageNum * perPage - 1

            // Fetch order items with product and order info, paginated
            const { data, error: err, count } = await supabase
                .from('OrderItem')
                .select(`*, pro_id(*, cate_id(*)), order_id!inner(phase_id!inner(phase_name, status), order, promotion)`, { count: 'exact' })
                .eq('order_id.phase_id.status', 'active')
                .order('id', { ascending: false })
                .range(from, to)

            if (err) throw err

            // Flatten -- though data already row per item
            const flattenedSales: SaleItem[] = []
            if (data) {
                data.forEach((orderItem: any) => {
                    // include the full order object in order_id so callers can access promotion, etc.
                    const orderObj = orderItem.order_id || null
                    flattenedSales.push({
                        id: orderItem.id,
                        pro_id: orderItem.pro_id,
                        qty: orderItem.qty,
                        price: orderItem.price,
                        order_id: orderObj,
                        // prefer the parent order's created_at when available
                        created_at: orderObj?.created_at || orderItem.created_at,
                    })
                })
            }

            setSales(flattenedSales)
            if (typeof count === 'number') {
                setTotalCount(count)
            }
            setPage(pageNum)
        } catch (e) {
            setError((e as Error).message || 'Failed to load sales')
        } finally {
            setLoading(false)
        }
    }, [])
    useEffect(() => {
        fetchSales(1)
    }, [fetchSales])

    return { sales, loading, error, fetchSales, page, perPage, totalCount }
}
