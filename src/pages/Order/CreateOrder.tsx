import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router'
import { Product as ProdType } from '../Product/useProducts'
import { useUser } from '../../context/UserContext'

interface LineItem {
    pro_id?: number
    pro_name?: string
    qty: number
    price?: number
    sell_price?: number
    pro_img?: string
    stock?: number    // available quantity at time of selection
}

export default function CreateOrder() {
    const user = useUser().user;

    const navigate = useNavigate()
    const [products, setProducts] = useState<ProdType[]>([])
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<LineItem[]>([])
    const [pmType, setPmType] = useState('ຍັງບໍ່ຈ່າຍ')
    const [delivery_confirmed, setdelivery_confirmed] = useState(false)
    const [address, setAddress] = useState({ name: '', phone: '', branch: '', address: '' })
    const [promotion, setPromotion] = useState<number | ''>('')
    const [payee, setPayee] = useState('')
    const [payees, setPayees] = useState<{ id: number; name: string }[]>([])
    const [showAddItem, setShowAddItem] = useState(false)
    const [selectedQty, setSelectedQty] = useState(1)

    // localStorage suggestions for customer name
    const LS_CUSTOMER_KEY = 'ap_customer_names'
    const [showNameSuggestions, setShowNameSuggestions] = useState(false)
    const nameInputRef = useRef<HTMLInputElement>(null)
    const getSavedNames = (): string[] => {
        try { return JSON.parse(localStorage.getItem(LS_CUSTOMER_KEY) || '[]') } catch { return [] }
    }
    const saveCustomerName = (name: string) => {
        const list = getSavedNames().filter(n => n !== name)
        list.unshift(name)
        localStorage.setItem(LS_CUSTOMER_KEY, JSON.stringify(list.slice(0, 20)))
    }
    const nameSuggestions = getSavedNames().filter(n =>
        n.toLowerCase().includes(address.name.toLowerCase()) && n !== address.name
    )

    useEffect(() => {
        // load products for selection (include current stock quantity)
        supabase
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
            .then(res => {
                if (res.data) setProducts(res.data as any)
            })
    }, [])

    useEffect(() => {
        // load payees for the select
        supabase
            .from('Payee')
            .select('id, name')
            .then(res => {
                if (res.data) setPayees(res.data as any)
            })
    }, [])

    const removeLine = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
    const updateLine = (idx: number, patch: Partial<LineItem>) =>
        setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))

    const addItemFromProduct = (product: ProdType) => {
        // Check available stock
        const stock = product.qty_stock ?? 0
        if (stock <= 0) {
            alert('ຈຳນວນສິນຄ້າໃນສະຕ໋ອກເບີດແລ້ວ')
            setShowAddItem(false)
            return
        }

        // Check if product already exists
        const existingIndex = items.findIndex(it => it.pro_id === product.id)

        if (existingIndex !== -1) {
            // Product already exists, increase quantity; also refresh stock
            const currentQty = items[existingIndex].qty
            const currentStock = stock // latest from product
            const newQty = currentQty + selectedQty
            if (newQty > currentStock) {
                alert(`Cannot add more than ${currentStock} items available`)
                updateLine(existingIndex, { qty: currentStock, stock: currentStock })
            } else {
                updateLine(existingIndex, { qty: newQty, stock: currentStock })
            }
        } else {
            // Add new item (cap to stock)
            const qtyToAdd = Math.min(selectedQty, stock)
            const newItem: LineItem = {
                pro_id: product.id,
                pro_name: product.pro_name,
                sell_price: product.sell_price,
                pro_img: product.pro_img,
                qty: qtyToAdd,
                price: product.sell_price,
                stock,
            }
            setItems(prev => [...prev, newItem])
            if (qtyToAdd < selectedQty) {
                alert(`Only ${stock} units available, added ${qtyToAdd}`)
            }
        }
        setSelectedQty(1)
        setShowAddItem(false)
    }

    const computeTotalQty = () => items.reduce((s, it) => s + (it.qty || 0), 0)
    const computeSalePrice = () => {
        if (pmType === 'ນຳໃຊ້ເອງ') return 0;
        const basePrice = items.reduce((s, it) => s + ((it.price || 0) * it.qty), 0)
        const discountPerItem = promotion === '' ? 0 : (promotion as number)
        const totalDiscount = discountPerItem * computeTotalQty()
        return Math.max(0, basePrice - totalDiscount)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (items.length === 0) {
            alert('ເລືອກລາຍການຢ່າງໜ້ອຍ 1 ລາຍການ')
            return
        }

        setLoading(true)
        try {
            // Get active phase
            const { data: activePhase } = await supabase
                .from('Phase')
                .select('id')
                .eq('status', 'active')
                .single()

            if (!activePhase) {
                alert('No active phase found. Please create a phase first.')
                setLoading(false)
                return
            }

            const totalQty = computeTotalQty()
            const salePrice = computeSalePrice()

            let query = supabase
                .from('Order')
                .select('order')
                .eq('phase_id', activePhase.id)

            if (user?.id) {
                query = query.eq('user_id', user.id)
            } else {
                query = query.is('user_id', null)
            }

            const { data: latestOrder } = await query
                .order('order', { ascending: false })
                .limit(1)
                .maybeSingle()

            const order_count = latestOrder?.order ? latestOrder.order + 1 : 1


            const orderPayload: any = {
                pm_type: pmType,
                sale_price: salePrice,
                address: address,
                total_qty: totalQty,
                delivery_confirmed: delivery_confirmed,
                promotion: promotion === '' ? null : promotion,
                payee: payee || null,
                user_id: user?.id || null,
                order: (order_count || 1), // simple incremental order number
                phase_id: activePhase.id,
            }

            const { data: orderData, error: orderErr } = await supabase
                .from('Order')
                .insert([orderPayload])
                .select('id')
                .single()

            if (orderErr) throw orderErr

            const orderId = (orderData as any).id

            // insert order items
            const itemsPayload = items.map(it => ({
                order_id: orderId,
                pro_id: it.pro_id,
                qty: it.qty,
                price: it.price || it.sell_price || null,
                phase_id: activePhase.id,
            }))

            const { error: itemsErr } = await supabase.from('OrderItem').insert(itemsPayload)
            if (itemsErr) throw itemsErr

            // decrement product quantities
            for (const it of items) {
                if (!it.pro_id) continue
                // fetch current quantity (could be omitted if you trust the local state)
                const { data: prodData, error: prodErr } = await supabase
                    .from('Product')
                    .select('qty_stock, qty_sale')
                    .eq('id', it.pro_id)
                    .single()
                if (prodErr) {
                    console.error('failed to fetch product for qty update', prodErr)
                    // continue with others
                } else if (prodData) {
                    const newQty = (prodData.qty_stock || 0) - it.qty
                    await supabase
                        .from('Product')
                        .update({
                            qty_sale: (prodData.qty_sale || 0) + it.qty,
                            qty_stock: newQty < 0 ? 0 : newQty
                        })
                        .eq('id', it.pro_id)
                }
            }

            // save customer name for autocomplete
            if (address.name.trim()) saveCustomerName(address.name.trim())

            // refresh notifications
            window.dispatchEvent(new CustomEvent("refresh-notifications"));

            navigate('/order')
        } catch (err) {
            console.error(err)
            alert('Failed to create order')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-4 mb-6">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    aria-label="Go back"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">ສ້າງອໍເດີ້ໃໝ່</h1>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* Left Column: Product Selection & Cart */}
                <div className="md:col-span-7 space-y-6">
                    <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ລາຍການສິນຄ້າ</h2>

                            {/* Add Item Button */}
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowAddItem(!showAddItem)}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>ເລືອກລາຍການ</span>
                                </button>

                                {/* Dropdown Menu */}
                                {showAddItem && (
                                    <>
                                        {/* Overlay to close on click outside */}
                                        <div
                                            className="fixed inset-0 z-10"
                                            onClick={() => setShowAddItem(false)}
                                        />
                                        <div className="fixed inset-x-4 top-[15vh] max-h-[70vh] sm:max-h-80 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 bg-white dark:bg-gray-800 border text-gray-900 dark:text-white border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl sm:w-80 overflow-y-auto z-50">
                                            <div className="p-3 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-gray-50 dark:bg-gray-900/90 backdrop-blur-sm z-10">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">ຄົ້ນຫາ / ເລືອກສິນຄ້າ</label>
                                            </div>
                                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {products.map(product => (
                                                    <div
                                                        key={product.id}
                                                        onClick={() => addItemFromProduct(product)}
                                                        className="flex justify-between items-center p-3 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                                                    >
                                                        <div className="flex items-center flex-1 gap-3 min-w-0">
                                                            {product.pro_img ? (
                                                                <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800">
                                                                    <img src={product.pro_img} alt={product.pro_name} className="w-full h-full object-cover" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-800 flex-shrink-0 flex items-center justify-center">
                                                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="font-medium text-sm truncate text-gray-900 dark:text-white">{product.pro_name}</div>
                                                                <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">{product.sell_price?.toLocaleString('en-US')} ₭</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex-shrink-0 ml-2 text-right">
                                                            {product.qty_stock !== undefined && (
                                                                <span className={`text-xs px-2 py-1 rounded-full ${product.qty_stock > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                    {product.qty_stock} ພ້ອມສົ່ງ
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                        </div>

                            {/* Cart Items List */}
                            {items.length === 0 ? (
                                <div className="text-center py-10 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400">
                                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <p>ຍັງບໍ່ມີລາຍການສິນຄ້າ, ກະລຸນາກົດ "ເລືອກລາຍການ" ເພື່ອເພີ່ມສິນຄ້າ</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {items.map((it, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-700 gap-3">
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                {it.pro_img ? (
                                                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                                                        <img src={it.pro_img} alt={it.pro_name} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-14 h-14 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0 flex items-center justify-center">
                                                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{it.pro_name || `Product ${it.pro_id}`}</div>
                                                    <div className="text-blue-600 dark:text-blue-400 font-medium text-sm mt-0.5">{it.sell_price?.toLocaleString('en-US')} ₭</div>
                                                    {it.stock !== undefined && (
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ສະຕ໋ອກ: {it.stock}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-0 border-gray-200 dark:border-gray-700">
                                                <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden h-9">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateLine(idx, { qty: Math.max(1, it.qty - 1) })}
                                                        className="w-10 h-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                                                    </button>
                                                    <div className="w-10 h-full flex items-center justify-center font-medium text-gray-900 dark:text-white border-x border-gray-200 dark:border-gray-600 text-sm">
                                                        {it.qty}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const maxQty = it.stock ?? Infinity
                                                            const desired = it.qty + 1
                                                            if (desired > maxQty) {
                                                                alert(`Only ${maxQty} available`)
                                                                updateLine(idx, { qty: maxQty })
                                                            } else {
                                                                updateLine(idx, { qty: desired })
                                                            }
                                                        }}
                                                        disabled={it.stock !== undefined && it.qty >= it.stock}
                                                        className="w-10 h-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                                    </button>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeLine(idx)}
                                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                                    aria-label="Remove item"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Order Form */}
                    <div className="md:col-span-5 space-y-4">

                        {/* Payment Info */}
                        <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-5">
                            <h3 className="text-base font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                ສວນຫຼຸດ / ໂປຣໂມຊັ່ນ
                            </h3>
                            <div className="space-y-4">
                                <div className="hidden">
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">ສະຖານະການຈ່າຍ</label>
                                    <select value={pmType} onChange={e => setPmType(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition">
                                        <option value="ໂອນ">ໂອນ</option>
                                        <option value="ຈ່າຍສົດ">ຈ່າຍສົດ</option>
                                        <option value="ຍັງບໍ່ຈ່າຍ">ຍັງບໍ່ຈ່າຍ</option>
                                        <option value="ນຳໃຊ້ເອງ">ນຳໃຊ້ເອງ</option>
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <input
                                        type="checkbox"
                                        checked={pmType === 'ນຳໃຊ້ເອງ'}
                                        onChange={e => setPmType(e.target.checked ? 'ນຳໃຊ້ເອງ' : '')}
                                        id='pmType-checkbox'
                                    />
                                    <label htmlFor='pmType-checkbox' id='pmType-label'>ນຳໃຊ້ເອງ</label>

                                    <input
                                        type="checkbox"
                                        checked={delivery_confirmed === true}
                                        onChange={e => setdelivery_confirmed(e.target.checked ? true : false)}
                                        id='delivery_confirmed-checkbox'
                                    />
                                    <label htmlFor='delivery_confirmed-checkbox' id='delivery_confirmed-label'>ສົງແລ້ວ</label>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">ບັນຊີຜູ້ຮັບເງິນ</label>
                                    <select required value={payee} onChange={async (e) => {
                                        const val = e.target.value
                                        if (val === 'newPayee') {
                                            const name = window.prompt('Enter new payee name')
                                            if (!name || !name.trim()) {
                                                setPayee('')
                                                return
                                            }
                                            try {
                                                const { data: newPayee, error: payeeErr } = await supabase
                                                    .from('Payee')
                                                    .insert([{ name: name.trim(), user_id: user?.id ?? null }])
                                                    .select('id, name')
                                                    .single()
                                                if (payeeErr) throw payeeErr
                                                if (newPayee) {
                                                    setPayees(prev => [...prev, newPayee])
                                                    setPayee(newPayee.name)
                                                }
                                            } catch (err) {
                                                console.error('Failed to add payee', err)
                                                alert('Failed to add payee')
                                            }
                                        } else {
                                            setPayee(val)
                                        }
                                    }} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition">
                                        <option value="">ເລືອກບັນຊີຜູ້ຮັບເງິນ</option>
                                        {payees.map(p => (
                                            <option key={p.id} value={p.name}>{p.name}</option>
                                        ))}
                                        <option value="newPayee">+ ເພີ່ມບັນຊີໃໝ່</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1.5">ສ່ວນຫຼຸດ / ໂປຣໂມຊັ່ນ</label>
                                    <div className="relative">
                                        <input type="number" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={promotion === '' ? '' : promotion} onChange={e => setPromotion(e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
                                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-500">₭</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Delivery Info */}
                        <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 sm:p-5">
                            <h3 className="text-base font-semibold mb-3 text-gray-900 dark:text-white flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                ຂໍ້ມູນການຈັດສົງ
                            </h3>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <input
                                            ref={nameInputRef}
                                            placeholder="ຊື່ລູກຄ້າ"
                                            value={address.name}
                                            onChange={e => { setAddress({ ...address, name: e.target.value }); setShowNameSuggestions(true); }}
                                            onFocus={() => setShowNameSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
                                            autoComplete="off"
                                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                        />
                                        {showNameSuggestions && nameSuggestions.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                                                {nameSuggestions.map(n => (
                                                    <div
                                                        key={n}
                                                        onMouseDown={() => { setAddress(prev => ({ ...prev, name: n })); setShowNameSuggestions(false); }}
                                                        className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200"
                                                    >
                                                        👤 {n}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <input placeholder="ເບີໂທຕິດຕໍ່" inputMode="numeric" pattern="[0-9]*" value={address.phone} onChange={e => setAddress({ ...address, phone: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
                                </div>
                                <select value={address.branch} onChange={e => setAddress({ ...address, branch: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition">
                                    <option value="">ເລືອກສາຂາຂົນສົງ</option>
                                    <option value="ອານຸສິດ">ອານຸສິດ</option>
                                    <option value="ຮຸ່ງອາລຸນ">ຮຸ່ງອາລຸນ</option>
                                    <option value="ມີໄຊ">ມີໄຊ</option>
                                </select>
                                <textarea placeholder="ລາຍລະອຽດທີ່ຢູ່ເພີ່ມເຕີມ..." rows={2} value={address.address} onChange={e => setAddress({ ...address, address: e.target.value })} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none"></textarea>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-600 dark:text-gray-300">ຈຳນວນລວມ</span>
                                <span className="font-semibold text-gray-900 dark:text-white">{computeTotalQty()} ລາຍການ</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-blue-200/50 dark:border-blue-800/50 pt-2 mt-2">
                                <span className="text-gray-800 dark:text-gray-200 font-medium">ລວມເປັນເງິນທັງໝົດ</span>
                                <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">{computeSalePrice().toLocaleString('en-US')} ₭</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => navigate(-1)} className="flex-1 py-3 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                ຍົກເລີກ
                            </button>
                            <button type="submit" disabled={loading || items.length === 0} className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20">
                                {loading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ກຳລັງບັນທືກ...
                                    </span>
                                ) : 'ບັນທືກອໍເດີ້'}
                            </button>
                        </div>
                    </div>
            </form>
        </div>
    )
}
