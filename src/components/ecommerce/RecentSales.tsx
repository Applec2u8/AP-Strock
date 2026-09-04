import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface SaleItemDashboard {
    id: number
    pro_id?: any
    qty?: number
    price?: number
    order_id?: any
    created_at?: string
}

export default function RecentSales() {
    const [sales, setSales] = useState<SaleItemDashboard[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchRecentSales = async () => {
            try {
                setLoading(true)
                setError(null)

                // Fetch the 5 most recent order items
                const { data, error: err } = await supabase
                    .from('OrderItem')
                    .select(`*, pro_id(*), order_id!inner(phase_id!inner(status))`)
                    .eq('order_id.phase_id.status', 'active')
                    .order('id', { ascending: false })
                    .limit(5)

                if (err) throw err

                const items: SaleItemDashboard[] = []
                if (data) {
                    data.forEach((item: any) => {
                        items.push({
                            id: item.id,
                            pro_id: item.pro_id,
                            qty: item.qty,
                            price: item.price,
                            order_id: item.order_id,
                            created_at: item.order_id?.created_at || item.created_at,
                        })
                    })
                }

                setSales(items)
            } catch (e) {
                setError((e as Error).message || 'Failed to load sales')
            } finally {
                setLoading(false)
            }
        }

        fetchRecentSales()
    }, [])

    if (loading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">ລາຍການຂາຍລ່າສຸດ</h3>
                <div className="space-y-3">
                    {Array(3).fill(null).map((_, i) => (
                        <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">ລາຍການຂາຍລ່າສຸດ</h3>
                <p className="text-sm text-red-600">{error}</p>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">ລາຍການຂາຍລ່າສຸດ</h3>
            <div className="space-y-4">
                {sales.length === 0 ? (
                    <p className="text-sm text-gray-500">ບໍ່ມີລາຍການຂາຍ</p>
                ) : (
                    sales.map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between border-b border-gray-100 dark:border-white/[0.05] pb-4 last:border-0">
                            <div className="flex items-center gap-3 flex-1">
                                {sale.pro_id?.pro_img ? (
                                    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                                        <img
                                            src={sale.pro_id.pro_img}
                                            alt={sale.pro_id.pro_name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {sale.pro_id?.pro_name || 'Product'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {sale.created_at ? new Date(sale.created_at).toLocaleString() : '—'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {sale.qty} × {(sale.price || 0).toLocaleString('en-US')} ₭
                                </p>
                                <p className="text-xs text-green-600 font-medium">
                                    {sale.order_id?.promotion
                                        ? (sale.order_id.promotion * (sale.qty || 0)).toLocaleString('en-US')
                                        : ((sale.price || 0) * (sale.qty || 0)).toLocaleString('en-US')
                                    } ₭
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
