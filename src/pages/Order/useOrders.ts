import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface OrderItem {
  id: number
  created_at?: string
  order_id?: number
  pro_id?: number
  qty?: number
  price?: number
  phase_id?: number
}

export interface Order {
  id: number
  created_at?: string
  user_id?: {
    fullname: string
  }
  pm_type?: string
  sale_price?: number
  address?: any
  readme?: string
  total_qty?: number
  delivery_confirmed?: string
  promotion?: number
  payee?: string
  phase_id?: number
  order?: string
  OrderItem?: OrderItem[]
  OrderPayment?: any[]
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const perPage = 10
  const [totalCount, setTotalCount] = useState(0)
  const [currentSearch, setCurrentSearch] = useState('')
  const [currentStatusFilter, setCurrentStatusFilter] = useState('all')

  const fetchOrders = useCallback(async (pageNum: number = 1, search: string = currentSearch, statusFilter: string = currentStatusFilter) => {
    try {
      setLoading(true)
      setError(null)
      if (search !== currentSearch) setCurrentSearch(search)
      if (statusFilter !== currentStatusFilter) setCurrentStatusFilter(statusFilter)
      
      // fetch all active orders for local filtering & pagination
      let query = supabase
        .from('Order')
        .select(`*, OrderPayment(*), OrderItem(*, pro_id(*, cate_id(*))), user_id(*), phase_id!inner(phase_name, status)`)
        .eq('phase_id.status', 'active')
        .order('id', { ascending: false })

      if (search) {
        if (!isNaN(Number(search)) && search.trim() !== '') {
          query = query.or(`order.eq.${Number(search)},payee.ilike.%${search}%,address->>name.ilike.%${search}%`)
        } else {
          query = query.or(`payee.ilike.%${search}%,address->>name.ilike.%${search}%`)
        }
      }

      const { data, error: err } = await query

      if (err) throw err
      
      let filteredData = (data as any) || []
      
      if (statusFilter !== 'all') {
          filteredData = filteredData.filter((o: any) => {
              const salePrice = o.sale_price || 0
              const payments = o.OrderPayment || []
              const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
              let status = 'unpaid'
              if (o.pm_type === 'ນຳໃຊ້ເອງ') status = 'self_use'
              else if (salePrice === 0) status = 'paid'
              else if (totalPaid >= salePrice) status = 'paid'
              else if (totalPaid > 0) status = 'partial'
              
              if (statusFilter === 'self_use') return status === 'self_use'
              if (statusFilter === 'paid') return status === 'paid'
              if (statusFilter === 'unpaid') return status === 'unpaid' || status === 'partial'
              return true
          })
      }

      setTotalCount(filteredData.length)
      
      // local pagination
      const from = (pageNum - 1) * perPage
      const to = pageNum * perPage
      setOrders(filteredData.slice(from, to))
      setPage(pageNum)
    //   console.log('Fetched orders:', data)
    } catch (e) {
      setError((e as Error).message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [currentSearch])

  useEffect(() => {
    fetchOrders(1)
  }, []) // run once on mount

  return { orders, loading, error, fetchOrders, page, perPage, totalCount, currentStatusFilter }
}
