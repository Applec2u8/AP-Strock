import { useState, useEffect } from "react";
import swal from 'sweetalert';
import { supabase } from "../../lib/supabase";

import Button from "../../components/ui/button/Button";
import { useProducts } from "./useProducts";
import { useProductActions } from "./useProductActions";
import { FormDrawer } from "../../components/ui/drawer/FormDrawer";
import CreateProduct from "./CreateProduct";
import EditProduct from "./EditProduct";

export default function Index_Product() {
    const { products, loading, error, fetchProducts, page, perPage, totalCount, setProducts } = useProducts() as any;

    // aggregates for visible products on the page
    const productCount = products?.length || 0
    const totalStock = products.reduce((s: number, p: any) => s + (p.qty_stock || 0), 0)

    const [filterCate, setFilterCate] = useState("");
    const [showArchived] = useState(true);
    const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
    const [totals, setTotals] = useState({ cost: 0, target: 0, actual: 0 });
    const [loadingTotal, setLoadingTotal] = useState(true)

    // ── Drawer state ──────────────────────────────────────────
    const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
    const [editingProductId, setEditingProductId] = useState<number | null>(null);

    const openCreateDrawer = () => setDrawerMode("create");
    const openEditDrawer = (id: number) => { setEditingProductId(id); setDrawerMode("edit"); };
    const closeDrawer = () => { setDrawerMode(null); setEditingProductId(null); };
    const handleDrawerSuccess = async () => {
        closeDrawer();
        await refreshProducts(page);
    };
    // ─────────────────────────────────────────────────────────

    useEffect(() => {
        const fetchGrandTotal = async () => {
            try {
                setLoadingTotal(true)
                const { data: allProducts } = await supabase
                    .from('Product')
                    .select('*, phase_id!inner(status)')
                    .eq('phase_id.status', 'active')
                let cost = 0, target = 0, actual = 0;
                if (allProducts) {
                    allProducts.forEach((p: any) => {
                        cost += (p.quantity || 0) * (p.cost_price || 0);
                        target += (p.quantity || 0) * (p.sell_price || 0);
                        actual += (p.qty_sale || 0) * (p.sell_price || 0);
                    })
                }
                setTotals({ cost, target, actual });
            } catch (err) {
                console.error('Failed to fetch grand total:', err)
            } finally {
                setLoadingTotal(false)
            }
        }
        fetchGrandTotal()
    }, [])

    const { handleDelete, exportCsv } =
        useProductActions(filterCate, fetchProducts, products, setProducts);

    const refreshProducts = async (pageNum: number = page) => {
        await fetchProducts({ cate_id: filterCate ? parseInt(filterCate) : undefined, archived: showArchived }, pageNum);
    };

    useEffect(() => {
        refreshProducts(1);
    }, [showArchived]);

    useEffect(() => {
        supabase.from("Category").select("id, name").then(res => {
            if (res.data) setCategories(res.data as any);
        });
    }, []);

    const handleCategoryFilterChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFilterCate(val);
        await refreshProducts(1);
    };

    if (error) {
        return (
            <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900 dark:text-red-200">
                {error}
            </div>
        );
    }

    const plusArchived = async (product: any) => {
        if ((product.qty_stock || 0) > 0) {
            return;
        }

        swal({
            title: 'ເລືອກການກະທຳ',
            text: 'ທ່ານຕ້ອງການເກັບສິນຄ້າ ຫຼື ເພີ່ມຈຳນວນ?',
            buttons: {
                archive: { text: 'ເກັບ', value: 'archive', className: 'swal-button swal-button-info' },
                plus: { text: 'ເພີ່ມຈຳນວນ', value: 'plus', className: 'swal-button swal-button-success' },
                cancel: { text: 'ຍົກເລີກ', value: null, className: 'swal-button swal-button--cancel' },
            },
            dangerMode: true,
        }).then(async (choice) => {
            if (!choice) return;
            try {
                if (choice === 'archive') {
                    const snapshot = products;
                    setProducts((prev: any[]) => prev.filter((p: any) => p.id !== product.id));
                    const { error: fkErr, count } = await supabase.from('OrderItem').select('pro_id', { count: 'exact' }).eq('pro_id', product.id);
                    if (fkErr) { setProducts(snapshot); throw fkErr; }
                    let apiError;
                    if (typeof count === 'number' && count > 0) {
                        const { error } = await supabase.from('Product').update({ is_archived: true }).eq('id', product.id);
                        apiError = error;
                    } else {
                        const { error } = await supabase.from('Product').delete().eq('id', product.id);
                        apiError = error;
                    }
                    if (apiError) { setProducts(snapshot); throw apiError; }
                    swal('ສຳເລັດ!', 'ສິນຄ້າຖືກເກັບແລ້ວ', 'success');
                } else if (choice === 'plus') {
                    const qty = await swal({
                        title: 'ເພີ່ມຈຳນວນ', text: 'ໃສ່ຈຳນວນທີ່ຈະເພີ່ມ',
                        content: { element: 'input', attributes: { type: 'number', min: 0, step: 1, inputMode: 'numeric', pattern: '[0-9]*' } },
                        buttons: { confirm: { text: 'ເພີ່ມ', closeModal: false } },
                    });
                    const add = parseInt(qty as string, 10);
                    if (!isNaN(add) && add > 0) {
                        const newQty = (product.quantity || 0) + add;
                        const newStock = (product.qty_stock || 0) + add;
                        const snapshot = products;
                        setProducts((prev: any[]) => prev.map((p: any) => p.id === product.id ? { ...p, quantity: newQty, qty_stock: newStock } : p));
                        const { error } = await supabase.from('Product').update({ quantity: newQty, qty_stock: newStock }).eq('id', product.id);
                        if (error) { setProducts(snapshot); throw error; }
                        swal('ສຳເລັດ!', 'ເພີ່ມຈຳນວນສິນຄ້າແລ້ວ', 'success');
                    } else {
                        swal('ຜິດພາດ!', 'ຈຳນວນບໍ່ຖືກຕ້ອງ', 'error');
                    }
                }
            } catch (err: any) {
                swal('ຜິດພາດ!', err.message || 'เกิดข้อผิดพลาด', 'error');
            }
        });
    }

    const handleAddStock = async (product: any) => {
        // Step 1: Get the quantity
        const qty = await swal({
            title: 'ປັບປຸງຈຳນວນສິນຄ້າ', 
            text: 'ໃສ່ຈຳນວນທີ່ຕ້ອງການ',
            content: { element: 'input', attributes: { type: 'number', min: 1, step: 1, inputMode: 'numeric', pattern: '[0-9]*' } },
            buttons: { 
                cancel: { text: 'ຍົກເລີກ', value: null, visible: true, className: 'swal-button swal-button--cancel' },
                confirm: { text: 'ຕໍ່ໄປ', value: true, closeModal: false } 
            },
        });
        
        if (!qty) return;
        
        const amount = parseInt(qty as string, 10);
        if (isNaN(amount) || amount <= 0) {
            swal('ຜິດພາດ!', 'ກະລຸນາໃສ່ຈຳນວນທີ່ຫຼາຍກວ່າ 0', 'error');
            return;
        }

        // Step 2: Choose action (Add or Subtract)
        const action = await swal({
            title: `ຈຳນວນ: ${amount}`,
            text: 'ທ່ານຕ້ອງການເພີ່ມ ຫຼື ຫຼຸດຈຳນວນສິນຄ້ານີ້?',
            buttons: {
                cancel: { text: 'ຍົກເລີກ', value: null, className: 'swal-button swal-button--cancel' },
                subtract: { text: 'ຫຼຸດຈຳນວນ (-)', value: 'subtract', className: 'swal-button swal-button-danger' },
                add: { text: 'ເພີ່ມຈຳນວນ (+)', value: 'add', className: 'swal-button swal-button-success' },
            },
            dangerMode: true,
        });

        if (!action) return;

        let newQty = product.quantity || 0;
        let newStock = product.qty_stock || 0;

        if (action === 'add') {
            newQty += amount;
            newStock += amount;
        } else if (action === 'subtract') {
            newQty -= amount;
            newStock -= amount;
            // Prevent negative stock
            if (newStock < 0) newStock = 0;
            if (newQty < 0) newQty = 0;
        }

        const snapshot = products;
        
        // Optimistic UI update
        setProducts((prev: any[]) => prev.map((p: any) => p.id === product.id ? { ...p, quantity: newQty, qty_stock: newStock } : p));
        
        try {
            const { error } = await supabase.from('Product').update({ quantity: newQty, qty_stock: newStock }).eq('id', product.id);
            if (error) throw error;
            swal('ສຳເລັດ!', 'ປັບປຸງຈຳນວນສິນຄ້າຮຽບຮ້ອຍແລ້ວ', 'success');
        } catch (err: any) {
            setProducts(snapshot);
            swal('ຜິດພາດ!', err.message || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ', 'error');
        }
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-2 w-auto">
                <div className="flex flex-wrap items-center justify-start gap-2">
                    <Button size="sm" className='h-8 shadow-sm font-medium' variant="primary" onClick={openCreateDrawer}>
                        + ເພີ່ມລາຍການ
                    </Button>
                    <Button size="sm" className='h-8' variant="outline" onClick={() => refreshProducts(page)}>
                        Refresh
                    </Button>
                    <Button size="sm" className='h-8' variant="outline" onClick={exportCsv}>
                        Export Excel
                    </Button>
                </div>
                <div className="flex flex-wrap items-center justify-end mb-2 gap-2">
                    <select
                        value={filterCate}
                        onChange={handleCategoryFilterChange}
                        className="px-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    >
                        <option value="">ຄົ້ນຫາ / ປະເພດ</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Product Grid */}
            <div className="mt-4">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array(8).fill(null).map((_, idx) => (
                            <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
                                <div className="flex gap-4 mb-4">
                                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg flex-shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                                    </div>
                                </div>
                                <div className="space-y-2 mt-4">
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : products.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        ບໍ່ມີລາຍການສິນຄ້າ
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {products.map((product: any) => {
                            const isOutOfStock = (product.qty_stock || 0) === 0;
                            return (
                                <div
                                    key={product.id}
                                    onClick={() => plusArchived(product)}
                                    className={`relative bg-white dark:bg-gray-800 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden group
                                        ${isOutOfStock
                                            ? 'border-red-200 dark:border-red-900/50 opacity-80 hover:opacity-100'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-brand-500 dark:hover:border-brand-500 hover:shadow-md'
                                        }`}
                                >
                                    {isOutOfStock && (
                                        <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg z-10">
                                            ສິນຄ້າໝົດ
                                        </div>
                                    )}

                                    <div className="p-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                                                {product.pro_img ? (
                                                    <img src={product.pro_img} alt={product.pro_name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h3 className="font-semibold text-gray-900 dark:text-white truncate pr-2" title={product.pro_name}>
                                                        {product.pro_name}
                                                    </h3>
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">#{product.sku}</span>
                                                </div>
                                                <p className="text-xs text-brand-600 dark:text-brand-400 mb-2 truncate">
                                                    {product.cate_id?.name || "ບໍ່ລະບຸປະເພດ"}
                                                </p>
                                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                                                    <div>ຕົ້ນທຶນ: <span className="font-medium">{product.cost_price?.toLocaleString() || 0} ₭</span></div>
                                                    <div>ລາຄາຂາຍ: <span className="font-medium text-blue-600 dark:text-blue-400">{product.sell_price?.toLocaleString() || 0} ₭</span></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-3 gap-2 py-3 border-y border-gray-100 dark:border-gray-700/50">
                                            <div className="text-center">
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ນຳເຂົ້າ</div>
                                                <div className="font-semibold text-gray-700 dark:text-gray-200">{product.quantity || 0}</div>
                                            </div>
                                            <div className="text-center border-l border-r border-gray-100 dark:border-gray-700/50">
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ຂາຍແລ້ວ</div>
                                                <div className="font-semibold text-green-600 dark:text-green-500">{product.qty_sale || 0}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">ຄ້າງເຫຼືອ</div>
                                                <div className={`font-semibold ${isOutOfStock ? 'text-red-500' : 'text-orange-500'}`}>
                                                    {product.qty_stock || 0}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate flex-1 pr-2">
                                                ໂດຍ: {product.user?.fullname || "N/A"}
                                            </div>
                                            <div className="flex gap-1.5 shrink-0">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAddStock(product); }}
                                                    className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 dark:bg-green-900/30 dark:hover:bg-green-900/50 dark:text-green-400 rounded-md transition-colors"
                                                    title="ປັບປຸງຈຳນວນ"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openEditDrawer(product.id); }}
                                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-md transition-colors"
                                                    title="ແກ້ໄຂ"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                                                    className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-400 rounded-md transition-colors"
                                                    title="ລົບ"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* aggregates */}
            <div className="flex items-center justify-end gap-4 mt-4 text-sm text-gray-700 dark:text-gray-300">
                <div>ລາຍການ: <span className="font-medium">{productCount}</span></div>
                <div>Stock: <span className="font-medium">{totalStock}</span></div>
            </div>

            <div className="flex flex-col gap-3 mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="grid grid-cols-2 md:flex items-center justify-end gap-8">
                    <div>ຕົ້ນທຸນ: <span className="text-lg text-orange-600 dark:text-orange-400">{loadingTotal ? '...' : totals.cost.toLocaleString('en-US')} LAK</span></div>
                    <div>ເງີນເປົ້າ: <span className="text-lg text-blue-600 dark:text-blue-400">{loadingTotal ? '...' : totals.target.toLocaleString('en-US')} LAK</span></div>
                    <div className="col-span-2 md:col-span-1">ຍອດ: <span className="text-lg text-green-600 dark:text-green-400">{loadingTotal ? '...' : totals.actual.toLocaleString('en-US')} LAK</span></div>
                </div>
            </div>

            {/* pagination */}
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button size="sm" className="h-6" variant="outline" disabled={page <= 1} onClick={() => refreshProducts(page - 1)}>Prev</Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">Page {page} of {Math.ceil(totalCount / perPage) || 1}</span>
                <Button size="sm" className="h-6" variant="outline" disabled={page >= Math.ceil(totalCount / perPage)} onClick={() => refreshProducts(page + 1)}>Next</Button>
            </div>

            {/* ── Create Product Drawer ─────────────────────────────── */}
            <FormDrawer
                isOpen={drawerMode === "create"}
                onClose={closeDrawer}
                title="ເພີ່ມສິນຄ້າໃໝ່"
                size="lg"
                footer={
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={closeDrawer}>ຍົກເລີກ</Button>
                        <button
                            type="submit"
                            form="create-product-form"
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            ບັນທຶກ
                        </button>
                    </div>
                }
            >
                <CreateProduct onSuccess={handleDrawerSuccess} onClose={closeDrawer} />
            </FormDrawer>

            {/* ── Edit Product Drawer ───────────────────────────────── */}
            <FormDrawer
                isOpen={drawerMode === "edit"}
                onClose={closeDrawer}
                title="ແກ້ໄຂສິນຄ້າ"
                size="lg"
                footer={
                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={closeDrawer}>ຍົກເລີກ</Button>
                        <button
                            type="submit"
                            form="edit-product-form"
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                        >
                            ບັນທຶກ
                        </button>
                    </div>
                }
            >
                {editingProductId && (
                    <EditProduct
                        productId={editingProductId}
                        onSuccess={handleDrawerSuccess}
                        onClose={closeDrawer}
                    />
                )}
            </FormDrawer>
        </div>
    );
}
