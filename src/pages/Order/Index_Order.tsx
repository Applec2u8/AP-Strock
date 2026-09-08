import { useEffect, useState } from 'react'
import { useOrders } from './useOrders'
import { supabase } from '../../lib/supabase'
import Badge from '../../components/ui/badge/Badge'
import Button from '../../components/ui/button/Button'
import { useNavigate } from 'react-router'
import { InvoiceContent } from './showInvoice'
import { toggleDelivery } from './deliveryActions'
import { deleteOrder } from './deleteActions'
import { useModal } from '../../hooks/useModal'
import PaymentModal from './PaymentModal'
import { FormDrawer } from '../../components/ui/drawer/FormDrawer'

export default function Index_Order() {
    const navigate = useNavigate()
    const [searchVal, setSearchVal] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const { orders, setOrders, loading, error, fetchOrders, page, perPage, totalCount } = useOrders() as any
    const { isOpen, openModal, closeModal } = useModal()
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [totalAllOrdersRevenue, setTotalAllOrdersRevenue] = useState(0)
    const [loadingTotal, setLoadingTotal] = useState(true)
    const [totalAllPayeeTotals, setTotalAllPayeeTotals] = useState<Record<string, number>>({})
    const [paymentOrderId, setPaymentOrderId] = useState<number | null>(null)
    const paymentOrder = orders.find((o: any) => o.id === paymentOrderId) || null;
    const [showPaymentModal, setShowPaymentModal] = useState(false)

    // Close invoice drawer on ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) closeModal()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [isOpen, closeModal])

    // Fetch grand total revenue on mount
    useEffect(() => {
        const fetchGrandTotal = async () => {
            try {
                setLoadingTotal(true)
                const { data: allOrders } = await supabase
                    .from('Order')
                    .select('phase_id!inner(status), OrderPayment(amount, payee)')
                    .eq('phase_id.status', 'active')
                let total = 0
                const payeeMap: Record<string, number> = {}
                if (allOrders) {
                    allOrders.forEach((o: any) => {
                        o.OrderPayment?.forEach((p: any) => {
                            const paid = Number(p.amount) || 0
                            total += paid
                            const name = p.payee || 'N/A'
                            payeeMap[name] = (payeeMap[name] || 0) + paid
                        })
                    })
                }
                setTotalAllOrdersRevenue(total)
                setTotalAllPayeeTotals(payeeMap)
            } catch (err) {
                console.error('Failed to fetch grand total:', err)
            } finally {
                setLoadingTotal(false)
            }
        }
        fetchGrandTotal()
    }, [])

    useEffect(() => {
        fetchOrders()
    }, [fetchOrders])

    if (error) return <div className="p-4 text-red-600">{error}</div>

    const handlePaymentMethod = (order: any) => {
        setPaymentOrderId(order.id)
        setShowPaymentModal(true)
    }

    const getPaymentStatus = (o: any) => {
        const salePrice = o.sale_price || 0
        const payments = o.OrderPayment || []
        const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
        if (o.pm_type === 'ນຳໃຊ້ເອງ') return { status: 'self_use', totalPaid, remaining: 0 }
        if (salePrice === 0) return { status: 'free', totalPaid, remaining: 0 }
        if (totalPaid >= salePrice) return { status: 'paid', totalPaid, remaining: 0 }
        if (totalPaid > 0) return { status: 'partial', totalPaid, remaining: salePrice - totalPaid }
        return { status: 'unpaid', totalPaid: 0, remaining: salePrice }
    }

    const ordersCount = orders?.length || 0
    const ordersTotalQty = orders.reduce((s: number, o: any) => s + (o.total_qty || 0), 0)
    const ordersTotalRevenue = orders.reduce((s: number, o: any) => {
        const ps = getPaymentStatus(o)
        return s + ps.totalPaid
    }, 0)

    const onExport = async () => {
        if (!orders || orders.length === 0) { alert('No orders to export'); return }
        const headers = ['#ເຟສ', 'ເວລາ', 'ການຈ່າຍ', 'ສະຖານະການຈ່າຍ', 'ຈ່າຍແລ້ວ', 'ຄ້າງຈ່າຍ', 'ຈຳນວນລວມ', 'ເງີນລວມ', 'ຜູ້ຮັບເງີນ', 'ລາຍການ', 'ຜູ້ອອກບີນ', 'ຈັດສົ່ງ']
        const rows = orders.map((o: any) => {
            const items = (o.OrderItem || []).map((it: any) => {
                const name = it.pro_id?.pro_name || it.pro_id || ''
                return `${name} x ${it.qty} @ ${it.price?.toLocaleString('en-US')} ₭`
            }).join(' | ')
            const addressStr = o.address ? `${o.address.name || ''} | ${o.address.phone || ''} | ${o.address.branch || ''} | ${o.address.address || ''}` : ''
            const ps = getPaymentStatus(o)
            const paymentStatusText = ps.status === 'self_use' ? 'ນຳໃຊ້ເອງ' : ps.status === 'paid' ? 'ຈ່າຍຄົບ' : 'ຍັງຕິດຄ້າງ'
            return [
                o.phase_id?.phase_name,
                o.created_at ? new Date(o.created_at).toLocaleString() : '',
                o.pm_type || '', paymentStatusText,
                ps.totalPaid, ps.remaining,
                o.total_qty ?? '',
                o.sale_price != null ? o.sale_price.toLocaleString('en-US') + ' ₭' : '-',
                o.payee ?? '', items, o.user_id?.fullname || '', addressStr,
            ]
        })

        try {
            const XLSX = await import('xlsx')
            const wb = XLSX.utils.book_new()
            const aoa = [headers, ...rows]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            XLSX.utils.book_append_sheet(wb, ws, 'Orders')
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            XLSX.writeFile(wb, `ອໍເດີ້ຂາຍ-${ts}.xlsx`)
            return
        } catch (xlsxErr) {
            console.warn('SheetJS not available, falling back to CSV export', xlsxErr)
        }

        try {
            const bom = '\uFEFF'
            const csvLines = ['Order', '', headers.join(','), ...rows.map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(','))]
            const csv = bom + csvLines.join('\r\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            a.href = url; a.download = `ອໍເດີ້ລາຍການ-${ts}.csv`
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Export failed', err); alert('Export failed')
        }
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 w-full items-center justify-between mb-2">
                <h1 className="text-2xl font-bold text-gray-600 dark:text-gray-200 mb-2 md:mb-0">ລາຍການສັ່ງຊື້</h1>
                <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-2 w-full md:w-auto mt-2 md:mt-0">
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64 md:flex-none">
                            <input
                                type="text"
                                placeholder="ຄົ້ນຫາ Order#, ຜູ້ຮັບ, ຜູ້โอน..."
                                value={searchVal}
                                onChange={(e) => setSearchVal(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') fetchOrders(1, searchVal, statusFilter) }}
                                className="h-8 pl-3 pr-8 w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
                            />
                            <button className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" onClick={() => fetchOrders(1, searchVal, statusFilter)}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </button>
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); fetchOrders(1, searchVal, e.target.value) }}
                            className="h-8 px-2 w-[130px] md:w-36 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-700 dark:text-gray-200"
                        >
                            <option value="all">ສະຖານะທັງໝົດ</option>
                            <option value="paid">ຈ່າຍຄົບ</option>
                            <option value="unpaid">ຍັງຕິດຄ້າງ</option>
                            <option value="self_use">ນຳໃຊ້ເອງ</option>
                        </select>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button size="sm" className='hidden sm:inline-flex h-8 shadow-sm font-medium flex-none whitespace-nowrap text-sm px-2' variant="primary" onClick={() => navigate('/order/create')}>
                            + ເພີ່ມລາຍການ
                        </Button>
                        <Button size="sm" className='h-8 flex-1 md:flex-none whitespace-nowrap text-xs md:text-sm px-2' variant="outline" onClick={() => onExport()}>Export Excel</Button>
                        <Button size="sm" className='h-8 flex-1 md:flex-none whitespace-nowrap text-xs md:text-sm px-2' variant="outline" onClick={() => fetchOrders(page, searchVal, statusFilter)}>Refresh</Button>
                    </div>
                </div>
            </div>

            {/* Card Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
                {loading ? (
                    Array(3).fill(null).map((_, idx) => (
                        <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 h-40 animate-pulse" />
                    ))
                ) : orders.length === 0 ? (
                    <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-gray-500">ບໍ່ມີລາຍການ</div>
                ) : (
                    orders.map((o: any) => (
                        <div key={o.id} className={`${getPaymentStatus(o).status === 'self_use' ? 'bg-green-100 dark:bg-blue-900/20' : getPaymentStatus(o).status === 'paid' ? 'bg-blue-100 dark:bg-green-900/20' : getPaymentStatus(o).status === 'unpaid' ? 'bg-red-100 dark:bg-red-500/10' : 'bg-white dark:bg-gray-800'} rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/20 p-4 transition hover:shadow-md`}>
                            {/* Header */}
                            <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-700 pb-3 mb-3 cursor-pointer" onClick={() => { setSelectedOrder(o); openModal() }}>
                                <div>
                                    <div className="font-bold text-gray-900 dark:text-gray-100 text-base">#{o.order || '#'}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{o.created_at ? new Date(o.created_at).toLocaleString() : ''}</div>
                                </div>
                                <div className="text-right">
                                    <div className="font-semibold text-blue-600 dark:text-blue-400">{o.sale_price?.toLocaleString('en-US')} ₭</div>
                                    <div className="text-xs text-gray-500 mt-0.5">ຈຳນວນ: {o.total_qty}</div>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="mb-3 text-sm text-gray-800 dark:text-gray-200 cursor-pointer" onClick={() => { setSelectedOrder(o); openModal() }}>
                                <span className="font-medium text-gray-500 dark:text-gray-400">ຜູ້ຮັບ:</span> {o.address?.name || 'N/A'} {o.address?.phone ? `| ໂທ: ${o.address.phone}` : ''} {o.address?.branch ? `| ສາຂາ: ${o.address.branch}` : ''} {o.address?.address ? `| ທີ່ຢູ່: ${o.address.address}` : ''}
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg mb-3 max-h-32 overflow-y-auto cursor-pointer" onClick={() => { setSelectedOrder(o); openModal() }}>
                                {o.OrderItem?.map((it: any) => (
                                    <div key={it.id} className="text-xs text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 last:border-0 pb-1.5 mb-1.5 last:pb-0 last:mb-0 flex justify-between">
                                        <span className="truncate pr-2">👉 {it.pro_id?.pro_name} (x{it.qty})</span>
                                        <div className="flex flex-col items-end">
                                            <span className="font-medium flex-shrink-0 text-gray-500">{(it.price * it.qty)?.toLocaleString('en-US')} ₭</span>
                                            {o.promotion ? <span className="text-red-500 font-medium mt-0.5">-{(o.promotion * it.qty)?.toLocaleString('en-US')} ₭</span> : null}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center mb-4 text-xs text-gray-500 cursor-pointer" onClick={() => { setSelectedOrder(o); openModal() }}>
                                <div className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Payee: <span className="font-medium text-gray-700 dark:text-gray-300">{o.payee || 'N/A'}</span></div>
                                <div className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">Admin: <span className="font-medium text-gray-700 dark:text-gray-300">{o.user_id?.fullname || 'N/A'}</span></div>
                            </div>

                            {/* Payment Status */}
                            {(() => {
                                const ps = getPaymentStatus(o)
                                return (
                                    <div className="mb-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <div className="flex justify-between items-center text-xs mb-1">
                                            <span className="text-gray-500">ສະຖານະຊຳລະ</span>
                                            {ps.status === 'self_use' && <Badge variant="light" color="info" size="sm">ນຳໃຊ້ເອງ</Badge>}
                                            {ps.status === 'paid' && <Badge variant="light" color="success" size="sm">ຈ່າຍຄົບ</Badge>}
                                            {ps.status === 'partial' && <Badge variant="light" color="warning" size="sm">ຍັງຕິດຄ້າງ</Badge>}
                                            {ps.status === 'unpaid' && <Badge variant="light" color="error" size="sm">ຍັງຕິດຄ້າງ</Badge>}
                                        </div>
                                        {ps.status === 'partial' && (
                                            <div className="flex justify-between text-xs text-gray-500">
                                                <span>ຈ່າຍແລ້ວ: <span className="text-green-500 font-medium">{ps.totalPaid.toLocaleString('en-US')} ₭</span></span>
                                                <span>ຄ້າງ: <span className="text-red-500 font-medium">{ps.remaining.toLocaleString('en-US')} ₭</span></span>
                                            </div>
                                        )}
                                        {o.OrderPayment?.length > 0 && (
                                            <div className="mt-1 space-y-0.5">
                                                {o.OrderPayment.map((p: any) => (
                                                    <div key={p.id} className="flex justify-between text-xs text-gray-500">
                                                        <span>👤 {p.payee} ({p.pm_type})</span>
                                                        <span className="text-green-600">{Number(p.amount).toLocaleString('en-US')} ₭</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}

                            {/* Actions */}
                            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                                <button type="button" onClick={() => handlePaymentMethod(o)} disabled={getPaymentStatus(o).status === 'self_use'}>
                                    {(() => {
                                        const ps = getPaymentStatus(o)
                                        if (ps.status === 'self_use') return <Badge variant="light" color="info" size="sm">ນຳໃຊ້ເອງ</Badge>
                                        if (ps.status === 'paid') return <Badge variant="light" color="success" size="sm">ຈ່າຍຄົບ</Badge>
                                        if (ps.status === 'partial') return <Badge variant="light" color="warning" size="sm">ຍັງຕິດຄ້າງ ( <span className="text-yellow-500 font-medium">{ps.remaining.toLocaleString('en-US')} ₭</span> )</Badge>
                                        return <Badge variant="light" color="error" size="sm">ຍັງຕິດຄ້າງ ( <span className="text-yellow-500 font-medium">{ps.remaining.toLocaleString('en-US')} ₭</span> )</Badge>
                                    })()}
                                </button>
                                <button type="button" onClick={() => toggleDelivery(o.id, o.delivery_confirmed, setOrders, orders)}>
                                    {o.delivery_confirmed === 'true'
                                        ? <Badge variant="light" color="success" size="sm">ຈັດສົງແລ້ວ</Badge>
                                        : <Badge variant="light" color="warning" size="sm">ຍັງບໍ່ທັນສົງ</Badge>}
                                </button>
                                <button type="button" className="ml-auto" onClick={() => deleteOrder(o.id, setOrders, orders)}>
                                    <Badge variant="solid" color="error" size="sm">ຍົກເລີກ</Badge>
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Aggregates */}
            <div className="flex items-center justify-end gap-4 mt-4 text-sm text-gray-700 dark:text-gray-300">
                <div>ຈຳນວນລາຍການ ( ຫນ້າ {page} ): <span className="font-medium">{ordersCount}</span></div>
                <div>ຈຳນວນສິນຄ້າທັງໝົດ (ຫນ້າ {page} ): <span className="font-medium">{ordersTotalQty}</span></div>
                <div>ເງີນລວມ (ຫນ້າ {page} ): <span className="font-medium">{ordersTotalRevenue.toLocaleString('en-US')} ₭</span></div>
            </div>

            <div className="flex items-center justify-end gap-4 mt-2 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">ຈຳນວນເງິນຕາມ ຜູ້ຈ່າຍ:</p>
                    <ul className="space-y-1">
                        {Object.entries(totalAllPayeeTotals).length === 0 ? (
                            <li className="text-gray-500">No payees</li>
                        ) : (
                            Object.entries(totalAllPayeeTotals).map(([name, total]) => (
                                <li key={name} className="text-gray-700 dark:text-gray-200">{name}: <span className="font-medium text-blue-600 dark:text-blue-400">{(total || 0).toLocaleString('en-US')} ₭</span></li>
                            ))
                        )}
                    </ul>
                </div>
            </div>

            <div className="flex items-center justify-end gap-4 col-span-1 mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div>ເງີນລວມທັງໝົດ: <span className="text-lg text-blue-600 dark:text-blue-400">{loadingTotal ? '...' : totalAllOrdersRevenue.toLocaleString('en-US')} ₭</span></div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button size="sm" className="h-6" variant="outline" disabled={page <= 1} onClick={() => fetchOrders(page - 1, searchVal, statusFilter)}>Prev</Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {Math.ceil(totalCount / perPage) || 1}</span>
                <Button size="sm" className="h-6" variant="outline" disabled={page >= Math.ceil(totalCount / perPage)} onClick={() => fetchOrders(page + 1, searchVal, statusFilter)}>Next</Button>
            </div>

            {/* ── Invoice Drawer (replaces old inline modal) ────────── */}
            <FormDrawer
                isOpen={isOpen && !!selectedOrder}
                onClose={closeModal}
                title={`ໃບສໍາລັບການສັ່ງ #${selectedOrder?.order || ''}`}
                size="lg"
            >
                {selectedOrder && <InvoiceContent order={selectedOrder} />}
            </FormDrawer>

            {/* ── Payment Drawer ────────────────────────────────────── */}
            <PaymentModal
                order={paymentOrder}
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                setOrders={setOrders}
                ordersSnapshot={orders}
            />
            {/* Mobile FAB - Create Order */}
            <button
                onClick={() => navigate('/order/create')}
                className="md:hidden fixed bottom-6 right-5 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-2xl font-semibold text-white text-sm"
                style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
                    boxShadow: '0 8px 32px rgba(99, 102, 241, 0.5), 0 2px 8px rgba(0,0,0,0.3)'
                }}
            >
                <span style={{ fontSize: '20px', lineHeight: 1 }}>✚</span>
                <span>ເພີ່ມລາຍການ</span>
            </button>
        </div>
    )
}
