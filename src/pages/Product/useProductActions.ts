import { useCallback } from "react";
import { useNavigate } from "react-router";
import { supabase } from "../../lib/supabase";
import { Product } from "./useProducts";

export function useProductActions(
    filterCate: string,
    fetchProducts: (opts?: { search?: string; cate_id?: number; archived?: boolean }, page?: number) => Promise<void>,
    products: Product[]
) {
    const navigate = useNavigate();

    const handleCreate = useCallback(() => {
        navigate("/product/create");
    }, [navigate]);

    const handleRefresh = useCallback(async () => {
        // reset back to first page
        await fetchProducts({ cate_id: filterCate ? parseInt(filterCate) : undefined }, 1);
    }, [filterCate, fetchProducts]);

    const handleEdit = useCallback((productId: number) => {
        navigate(`/product/edit/${productId}`);
    }, [navigate]);

    const handleDelete = useCallback(async (productId: number) => {
        if (!window.confirm(`ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລົບສິນຄ້ານີ້ ຫຼື ບໍ່?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from("Product")
                .delete()
                .eq("id", productId);

            if (error) throw error;
            
            // Refresh the product list
            await fetchProducts({ cate_id: filterCate ? parseInt(filterCate) : undefined });
        } catch (err) {
            console.error("Error deleting product:", err);
            alert("ບໍ່ສາມາດລົບສິນຄ້າໄດ້");
        }
    }, [filterCate, fetchProducts]);

    const handleFilterChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        // reset to first page when applying new filter
        await fetchProducts({ cate_id: val ? parseInt(val) : undefined }, 1);
    }, [fetchProducts]);

    const exportCsv = useCallback(async () => {
        if (!products || products.length === 0) {
            alert('No products to export')
            return
        }

        // Prepare data
        const headers = [
            "#ເຟສ",
            "Image URL",
            "ໍສິນຄ້າ",
            "SKU",
            "ນຳເຂົ້າ",
            "ຈຳນວນຂາຍ",
            "ຍັງສະຕ໋ອກ",
            "ປະເພດສີນຄ້າ",
            "ຕົ້ນທືນ",
            "ລາຄາຂາຍ",
            "ຜູ້ສ້າງ",
            "ວັນທີ່ສ້າງ",
        ];
        const rows = products.map(p => [
            p.phase_id?.phase_name || "",
            p.pro_img || "",
            p.pro_name,
            p.sku,
            p.quantity,
            p.qty_sale,
            p.qty_stock,
            p.cate_id?.name || "",
            p.cost_price,
            p.sell_price,
            p.user?.fullname || "",
            p.created_at || "",
        ]);

        // Try SheetJS (.xlsx) via dynamic import
        try {
            const XLSX = await import('xlsx')
            const wb = XLSX.utils.book_new()
            const aoa = [headers, ...rows]
            const ws = XLSX.utils.aoa_to_sheet(aoa)
            XLSX.utils.book_append_sheet(wb, ws, "ນຳເຂົ້າສິນຄ້າ")
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            XLSX.writeFile(wb, `ນຳເຂົ້າສິນຄ້າ-${ts}.xlsx`)
            return
        } catch (xlsxErr) {
            console.warn('SheetJS not available, falling back to CSV export', xlsxErr)
        }

        // Fallback: CSV download (UTF-8 BOM)
        try {
            const bom = '\uFEFF'
            const titleLine = 'ນຳເຂົ້າສິນຄ້າ'
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
            a.download = `products-${ts}.csv`
            document.body.appendChild(a)
            a.click()
            a.remove()
            URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Export failed', err)
            alert('Export failed')
        }
    }, [products]);

    return {
        handleCreate,
        handleRefresh,
        handleEdit,
        handleDelete,
        handleFilterChange,
        exportCsv,
    };
}
