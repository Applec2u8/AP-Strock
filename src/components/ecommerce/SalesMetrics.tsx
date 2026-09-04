import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Chart from 'react-apexcharts'

interface SalesMetric {
    date: string
    count: number
    total: number
}

interface SalesMetricsProps {
    refreshTrigger?: number
}

export default function SalesMetrics({ refreshTrigger }: SalesMetricsProps = {}) {
    const [todaySales, setTodaySales] = useState(0)
    const [todayCount, setTodayCount] = useState(0)
    const [monthSales, setMonthSales] = useState(0)
    const [monthCount, setMonthCount] = useState(0)
    const [totalSales, setTotalSales] = useState(0) // all-time total
    const [totalCount, setTotalCount] = useState(0) // all-time order count
    const [totalExpenses, setTotalExpenses] = useState(0) // all-time total expenses
    const [expenseCount, setExpenseCount] = useState(0) // total expense count
    const [topHourInfo, setTopHourInfo] = useState<{ hour: number, count: number } | null>(null) // most popular hour
    const [hourlySales, setHourlySales] = useState<number[]>(Array(24).fill(0)) // 24 hours of sales data
    const [dailyMetrics, setDailyMetrics] = useState<SalesMetric[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchSalesMetrics = async () => {
            try {
                setLoading(true)
                setError(null)

                const now = new Date()
                // compute dates using the local timezone so "today" matches what the user expects
                const pad = (n: number) => n.toString().padStart(2, '0')
                const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
                const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
                const monthEnd = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`
                // monthStart/monthEnd now represent the full current month in local timezone

                // Fetch all orders for metrics
                const { data: allSales, error: fetchErr } = await supabase
                    .from('Order')
                    .select('*, phase_id!inner(status), OrderPayment(amount)')
                    .eq('phase_id.status', 'active')
                    .gte('created_at', monthStart)
                    .lte('created_at', monthEnd)

                if (fetchErr) throw fetchErr

                let tCount = 0
                let tTotal = 0
                let mCount = 0
                let mTotal = 0
                const dailyMap: Record<string, { count: number; total: number }> = {}
                const hourlyCounts: Record<number, number> = {}
                const hTotals = Array(24).fill(0)

                if (allSales) {
                    allSales.forEach((item: any) => {
                        const itemTotal = item.OrderPayment?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
                        // normalize the order timestamp to a local date string (YYYY-MM-DD)
                        const created = item.created_at ? new Date(item.created_at) : null
                        const dateStr = created
                            ? `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())}`
                            : ''

                        // Month totals
                        mCount++
                        mTotal += itemTotal

                        // Daily breakdown
                        if (!dailyMap[dateStr]) {
                            dailyMap[dateStr] = { count: 0, total: 0 }
                        }
                        dailyMap[dateStr].count++
                        dailyMap[dateStr].total += itemTotal

                        // Today check
                        if (dateStr === today) {
                            tCount++
                            tTotal += itemTotal

                            if (created) {
                                const hour = created.getHours()
                                hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1
                                hTotals[hour] += itemTotal
                            }
                        }
                    })
                }

                setTodayCount(tCount)
                setTodaySales(tTotal)
                setMonthCount(mCount)
                setMonthSales(mTotal)

                // fetch all-time sales total and count
                const { data: allOrders } = await supabase
                    .from('Order')
                    .select('sale_price, created_at, phase_id!inner(status), OrderPayment(amount)')
                    .eq('phase_id.status', 'active')
                let grandTotal = 0
                const countAll = allOrders?.length || 0

                // For the "all-time" 24H hourly distribution chart
                for (let h = 0; h < 24; h++) {
                    hourlyCounts[h] = 0
                }

                if (allOrders) {
                    allOrders.forEach((o: any) => {
                        const itemTotal = o.OrderPayment?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
                        grandTotal += itemTotal

                        if (o.created_at) {
                            const created = new Date(o.created_at)
                            const hour = created.getHours()
                            hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1
                            hTotals[hour] += itemTotal
                        }
                    })
                }
                setTotalSales(grandTotal)
                setTotalCount(countAll)
                setHourlySales(hTotals)

                // Keep top hour logic (all-time)
                let bestHour = -1
                let maxOrders = 0
                for (let h = 0; h < 24; h++) {
                    if (hourlyCounts[h] && hourlyCounts[h] > maxOrders) {
                        maxOrders = hourlyCounts[h]
                        bestHour = h
                    }
                }
                if (bestHour >= 0) {
                    setTopHourInfo({ hour: bestHour, count: maxOrders })
                } else {
                    setTopHourInfo(null)
                }

                // fetch all expenses total and count
                const { data: allExpenses } = await supabase
                    .from('Expenses')
                    .select('amount, phase_id!inner(status)')
                    .eq('phase_id.status', 'active')
                let expensesTotal = 0
                const countExpenses = allExpenses?.length || 0
                if (allExpenses) {
                    allExpenses.forEach((e: any) => {
                        expensesTotal += e.amount || 0
                    })
                }
                setTotalExpenses(expensesTotal)
                setExpenseCount(countExpenses)

                // Build last 7 days
                const days: SalesMetric[] = []
                for (let i = 6; i >= 0; i--) {
                    const d = new Date(now)
                    d.setDate(d.getDate() - i)
                    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
                    days.push({
                        date: dateStr,
                        count: dailyMap[dateStr]?.count || 0,
                        total: dailyMap[dateStr]?.total || 0,
                    })
                }
                setDailyMetrics(days)
            } catch (e) {
                setError((e as Error).message || 'Failed to load sales metrics')
                console.error('Sales metrics error:', e)
            } finally {
                setLoading(false)
            }
        }

        fetchSalesMetrics()
    }, [refreshTrigger])

    if (error) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <p className="text-sm text-red-600">{error}</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Key metrics cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border col-span-1 border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ຍອດຂາຍວັນນີ້</p>
                    <p className="text-[18px] font-bold text-gray-900 dark:text-white">
                        {loading ? '...' : todaySales.toLocaleString('en-US')} ₭
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{todayCount} ລາຍການ</p>
                </div>

                <div className="rounded-xl border col-span-1 border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ຍອດຂາຍເດືອນນີ້</p>
                    <p className="text-[18px] font-bold text-gray-900 dark:text-white">
                        {loading ? '...' : monthSales.toLocaleString('en-US')} ₭
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{monthCount} ລາຍການ</p>
                </div>
                <div className="rounded-xl border col-span-1 lg:col-span-1 border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ຍອດຂາຍທັງໝົດ</p>
                    <p className="text-[18px] font-bold text-gray-900 dark:text-white">
                        {loading ? '...' : totalSales.toLocaleString('en-US')} ₭
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{loading ? '...' : totalCount} ລາຍການ</p>
                </div>
                <div className="rounded-xl border col-span-1 lg:col-span-1 border-red-400 bg-white p-4 dark:border-red-400 dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ລາຍຈ່າຍທັງໝົດ</p>
                    <p className="text-[18px] font-bold text-red-400 dark:text-red-400">
                        - {loading ? '...' : totalExpenses.toLocaleString('en-US')} ₭
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{loading ? '...' : expenseCount} ລາຍການ</p>
                </div>
                <div className="rounded-xl border col-span-2 lg:col-span-1 border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ຍອດເງິນຄົງເຫຼືອ / ທັ້ງໝົດ</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {loading ? '...' : (totalSales - totalExpenses).toLocaleString('en-US')} ₭
                    </p>
                </div>
                <div className="rounded-xl border col-span-2 lg:col-span-1 border-gray-200 bg-white p-4 dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">ຊ່ວງເວລາຂາຍດີທີ່ສຸດ (ທັງໝົດ)</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {loading ? '...' : topHourInfo ? `${String(topHourInfo.hour).padStart(2, '0')}:00 - ${String(topHourInfo.hour + 1).padStart(2, '0')}:00` : '-'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{loading ? '...' : topHourInfo ? `${topHourInfo.count} ລາຍການ` : 'ຍັງບໍ່ມີອໍເດີ'}</p>
                </div>
            </div>

            {/* Daily breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">ຍອດຂາຍ 7 ວັນລ່າສຸດ</h3>
                <div className="space-y-2">
                    {loading ? (
                        <div className="space-y-2">
                            {Array(7).fill(null).map((_, i) => (
                                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                            ))}
                        </div>
                    ) : (
                        dailyMetrics.map((metric) => {
                            const maxTotal = Math.max(...dailyMetrics.map(m => m.total), 1)
                            const barWidth = (metric.total / maxTotal) * 100
                            const dateObj = new Date(metric.date + 'T00:00:00')
                            const dateLabel = dateObj.toLocaleDateString('lo-LA', { month: 'short', day: 'numeric' })

                            return (
                                <div key={metric.date}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{dateLabel}</span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                            {metric.total.toLocaleString('en-US')} ₭
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-blue-600 h-full rounded-full transition-all"
                                            style={{ width: `${barWidth}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">{metric.count} ລາຍການ</p>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {/* 24H Hourly breakdown */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/[0.05] dark:bg-white/[0.03]">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">ຍອດຂາຍແຕ່ລະຊົ່ວໂມງ (ທັງໝົດ)</h3>
                <div className="h-[300px] w-full">
                    {loading ? (
                        <div className="flex h-full items-center justify-center">
                            <span className="text-gray-500">ກຳລັງໂຫລດ...</span>
                        </div>
                    ) : (
                        <Chart
                            options={{
                                chart: {
                                    type: 'bar',
                                    toolbar: { show: false },
                                    fontFamily: 'inherit'
                                },
                                plotOptions: {
                                    bar: { borderRadius: 4, columnWidth: '60%' }
                                },
                                xaxis: {
                                    categories: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                                    labels: {
                                        formatter: (val: string) => {
                                            if (!val) return '';
                                            const hour = parseInt(val.split(':')[0], 10);
                                            return hour % 3 === 0 ? val : '';
                                        },
                                        style: { colors: '#9ca3af', fontSize: '11px' },
                                        rotate: -45,
                                        rotateAlways: false,
                                        hideOverlappingLabels: true,
                                    },
                                    axisBorder: { show: false },
                                    axisTicks: { show: false }
                                },
                                yaxis: {
                                    labels: {
                                        formatter: (val: number) => val.toLocaleString() + ' ₭',
                                        style: { colors: '#9ca3af' }
                                    }
                                },
                                dataLabels: { enabled: false },
                                tooltip: {
                                    theme: 'dark',
                                    y: { formatter: (val: number) => val.toLocaleString() + ' ₭' }
                                },
                                colors: ['#3b82f6'],
                                grid: {
                                    borderColor: '#f3f4f6',
                                    strokeDashArray: 4,
                                    xaxis: { lines: { show: false } },
                                    yaxis: { lines: { show: true } }
                                }
                            }}
                            series={[{ name: 'ຍອດຂາຍ', data: hourlySales }]}
                            type="bar"
                            height="100%"
                        />
                    )}
                </div>
            </div>
        </div>
    )
}
