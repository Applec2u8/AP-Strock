import { useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export interface Product {
  id: number
  pro_img?: string
  pro_name: string
  sku: string
  quantity: number             // total quantity ever stocked
  qty_sale?: number            // quantity sold
  qty_stock?: number           // remaining stock
  cost_price: number
  sell_price: number
  phase_id?: {
    phase_name: string
    status: string
  }
  user?: {
    fullname: string
  }
  cate_id?: {
    id: number
    name: string
  }
  category?: {
    name: string
  }
  created_at?: string
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const perPage = 10

  // filter/search state can be passed in args
  const fetchProducts = useCallback(async (opts?: { search?: string; cate_id?: number; archived?: boolean }, pageNum: number = 1) => {
    try {
      setLoading(true)
      setError(null)

      const from = (pageNum - 1) * perPage
      const to = pageNum * perPage - 1

      let query = supabase
        .from('Product')
        .select(
          `*,
          user(*),
          cate_id(*),
          phase_id!inner(phase_name, status)`,
          { count: 'exact' }
        )
        .eq('phase_id.status', 'active')
        .order('id', { ascending: false })
        .order('is_archived', { ascending: true })
        .range(from, to)

      if (opts?.archived !== undefined) {
        query = query.eq('is_archived', opts.archived);
      }

      if (opts) {
        if (opts.search) {
          // search across product name, SKU, creator fullname, and category name
          const term = `%${opts.search}%`;
          query = query.or(
            [`pro_name.ilike.${term}`,
             `sku.ilike.${term}`,
             `user.fullname.ilike.${term}`,
             `cate_id.name.ilike.${term}`].join(",")
          );
        }
        if (opts.cate_id) {
          query = query.eq('cate_id', opts.cate_id)
        }
        if (opts.archived !== undefined) {
          query = query.eq('is_archived', opts.archived);
        }
      }

      const { data, error: supabaseError, count } = await query

      if (supabaseError) {
        throw supabaseError
      }

      if (data) {
        setProducts(data as Product[])
      }
      if (typeof count === 'number') {
        setTotalCount(count)
      }
      setPage(pageNum)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch products'
      setError(errorMessage)
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // NOTE: component is responsible for calling fetchProducts with desired options
  // previous version automatically loaded all products on mount, but archived
  // filtering is controlled by the caller.

  return {
    products,
    totalCount,
    loading,
    error,
    fetchProducts,
    page,
    perPage,
  }
}
