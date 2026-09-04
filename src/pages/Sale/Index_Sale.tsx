import { useSales } from './useSales'
import Button from '../../components/ui/button/Button'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
} from "../../components/ui/table"

export default function Index_Sale() {
    const { sales, loading, error, fetchSales, page, perPage, totalCount } = useSales()
    const [totalAllRevenue, setTotalAllRevenue] = useState(0)
    const [loadingTotal, setLoadingTotal] = useState(true)
    const [selectedProduct, setSelectedProduct] = useState<number | ''>('')
    const [products, setProducts] = useState<any[]>([])

    // Fetch grand total revenue on mount
    useEffect(() => {
        const fetchGrandTotal = async () => {
            try {
                setLoadingTotal(true)
                const { data: allItems } = await supabase
                    .from('OrderItem')
                    .select('qty, price, order_id!inner(promotion, phase_id!inner(status))')
                    .eq('order_id.phase_id.status', 'active')
                let total = 0
                if (allItems) {
                    allItems.forEach((item: any) => {
                        const promotion = item.order_id?.promotion
                        const qty = item.qty || 0
                        const price = item.price || 0

                        if (promotion === 0) {
                            total += 0
                        } else if (promotion == null) {
                            total += price * qty
                        } else {
                            total += promotion * qty
                        }
                    })
                }
                setTotalAllRevenue(total)
            } catch (err) {
                console.error('Failed to fetch grand total:', err)
            } finally {
                setLoadingTotal(false)
            }
        }
        fetchGrandTotal()
    }, [])

    // Fetch products for filter dropdown
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const { data } = await supabase
                    .from('Product')
                    .select('id, pro_name')
                if (data) {
                    setProducts(data as any)
                }
            } catch (err) {
                console.error('Failed to fetch products:', err)
            }
        }
        fetchProducts()
    }, [])

    // page-level aggregates for visible sales
    const filteredSales = selectedProduct === ''
        ? sales
        : sales.filter(sale => sale.pro_id?.id === selectedProduct)

    const salesCount = filteredSales?.length || 0
    const totalQuantity = filteredSales.reduce((s: number, sale: any) => s + (sale.qty || 0), 0)
    const totalRevenue = filteredSales.reduce((s: number, sale: any) => {
        const itemTotal = sale.order_id?.promotion == null ? ((sale.price || 0) * (sale.qty || 0)) : (sale.order_id.promotion * (sale.qty || 0))
        return s + (itemTotal || 0)
    }, 0)

    if (error) return <div className="p-4 text-red-600">{error}</div>

    const onExport = async () => {
        if (!sales || sales.length === 0) {
            alert('No sales data to export')
            return
        }

        const headers = ['#ເຟສ', 'IMG', 'ສິນຄ້າ', 'ຈຳນວນຂາຍ', 'ລາຄາ', 'ລາຄາໂປຣ', 'ເງີນລວມ', 'ເວລາຂາຍ']
        const rows = sales.map((sale: any) => [
            sale.order_id?.phase_id?.phase_name || '',
            sale.pro_id?.pro_img || '',
            sale.pro_id?.pro_name || '',
            sale.qty || '',
            sale.price != null ? `${sale.price.toLocaleString('en-US')} ₭` : '—',
            sale.order_id?.promotion != null ? `${sale.order_id.promotion.toLocaleString('en-US')} ₭` : '—',
            sale.order_id?.promotion === 0 ? '0' : `${(sale.order_id?.promotion == null ? (sale.price * sale.qty) : (sale.order_id?.promotion * sale.qty)).toLocaleString('en-US')} ₭`,
            sale.created_at ? new Date(sale.created_at).toLocaleString() : '',
        ])

        // Try SheetJS (.xlsx) via dynamic import
        try {
            const XLSX = await import('xlsx')
            const wb = XLSX.utils.book_new()
            const aoa = [headers, ...rows]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            XLSX.utils.book_append_sheet(wb, ws, 'Sales')
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            XLSX.writeFile(wb, `ລາຍການຂາຍ-${ts}.xlsx`)
            return
        } catch (xlsxErr) {
            console.warn('SheetJS not available, falling back to CSV export', xlsxErr)
        }

        // Fallback: CSV
        try {
            const bom = '\uFEFF'
            const titleLine = 'ລາຍການຂາຍ'
            const csvLines = [
                titleLine,
                '',
                headers.join(','),
                ...rows.map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')),
            ]

            const csv = bom + csvLines.join('\r\n')
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            a.href = url
            a.download = `ລາຍການຂາຍ-${ts}.csv`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Export failed', err)
            alert('Export failed')
        }
    }

    return (
        <div>
            <div className="grid md:grid-cols-2 items-center justify-between mb-1">
                <h1 className="text-2xl font-bold text-gray-600 dark:text-gray-200">ລາຍການຂາຍ</h1>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <select
                        value={selectedProduct}
                        onChange={(e) => setSelectedProduct(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="h-6 px-1 text-sm rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                        <option value="">ທັງໝົດລາຍການ</option>
                        {products.map(product => (
                            <option key={product.id} value={product.id}>
                                {product.pro_name}
                            </option>
                        ))}
                    </select>
                    <Button size="sm" className='h-6' variant="outline" onClick={() => onExport()}>
                        Export Excel
                    </Button>
                    <Button size="sm" className='h-6' variant="outline" onClick={() => fetchSales()}>
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                <div className="max-w-full overflow-x-auto">
                    {loading ? (
                        <Table>
                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                {Array(5)
                                    .fill(null)
                                    .map((_, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Table>
                            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                                <TableRow className={sales.length === 0 ? 'hidden' : ''}>
                                    <TableCell
                                        isHeader
                                        className="sticky left-0 z-20 px-5 w-1 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700"
                                    >
                                        Order#
                                    </TableCell>

                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        IMG
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ລາຍການ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ຈຳນວນຂາຍ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ລາຄາ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ລາຄາໂປຣ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ເງີນລວມ
                                    </TableCell>
                                    <TableCell
                                        isHeader
                                        className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                                    >
                                        ເວລາຂາຍ
                                    </TableCell>
                                </TableRow>
                            </TableHeader>

                            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                                {filteredSales.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="px-4 py-6 w-full text-center text-gray-500 dark:text-gray-400">
                                            ບໍ່ມີລາຍການຂາຍ
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredSales.map((sale: any) => (
                                        <TableRow
                                            key={sale.id}
                                            className='hover:bg-gray-100 dark:hover:bg-gray-800'
                                        >
                                            <TableCell className="sticky left-0 z-10 px-5 w-1 text-gray-500 text-theme-sm dark:text-gray-400 hover:bg-gray-100 bg-gray-50 dark:bg-gray-900/50 dark:hover:bg-gray-900/50 dark:border-gray-700">
                                                #{sale.order_id?.order}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {sale.pro_id?.pro_img ? (
                                                    <div className="w-12 h-12 overflow-hidden rounded">
                                                        <img
                                                            src={sale.pro_id?.pro_img}
                                                            alt={sale.pro_id?.pro_name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded" />
                                                )}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {sale.pro_id?.pro_name || '—'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {sale.qty || '—'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {sale.price ? `${sale.price.toLocaleString('en-US')} ₭` : '—'}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-red-500 text-start text-theme-sm">
                                                {sale.order_id?.promotion == null ? '_' : sale.order_id?.promotion === 0 ? '0' : `${sale.order_id?.promotion.toLocaleString('en-US')} ₭`}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {sale.order_id?.promotion === 0 ? '0' : `${(sale.order_id?.promotion == null ? (sale.price * sale.qty) : (sale.order_id?.promotion * sale.qty)).toLocaleString('en-US')} ₭`}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-gray-500 text-start text-theme-sm dark:text-gray-400">
                                                {new Date(sale.created_at).toLocaleString() || '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            {/* aggregates for current page */}
            <div className="flex items-center justify-end gap-4 mt-4 text-sm text-gray-700 dark:text-gray-300">
                <div>ລາຍການ: <span className="font-medium">{salesCount}</span></div>
                <div>ຈຳນວນລວມ: <span className="font-medium">{totalQuantity}</span></div>
                <div>ເງີນລວມ (ໜ້າ): <span className="font-medium">{totalRevenue.toLocaleString('en-US')} ₭</span></div>
            </div>

            {/* grand total (all pages) */}
            <div className="flex items-center justify-end gap-4 mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div>ເງີນລວມທັງໝົດ: <span className="text-lg text-blue-600 dark:text-blue-400">{loadingTotal ? '...' : totalAllRevenue.toLocaleString('en-US')} ₭</span></div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button size="sm" className="h-6" variant="outline" disabled={page <= 1} onClick={() => fetchSales(page - 1)}>
                    Prev
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {Math.ceil(totalCount / perPage) || 1}</span>
                <Button size="sm" className="h-6" variant="outline" disabled={page >= Math.ceil(totalCount / perPage)} onClick={() => fetchSales(page + 1)}>
                    Next
                </Button>
            </div>
        </div>
    )
}
