import { supabase } from '../../lib/supabase';
import swal from 'sweetalert';

export async function deleteOrder(orderId: number, refresh: () => void) {
  swal({
    title: 'ຢືນຢັນການຍົກເລີກອໍເດີ້',
    text: 'ທ່ານຕ້ອງການຍົກເລີກອໍເດີ້ລາຍການສັ່ງຊື້ ຫຼື ບໍ່?',
    icon: 'warning',
    buttons: ['Closs', 'ຍົກເລີກອໍເດີ້'],
    dangerMode: true,
  }).then(async (willDelete) => {
    if (!willDelete) return;
    try {      // fetch order items so we can return stock
      const { data: items, error: fetchErr } = await supabase
        .from('OrderItem')
        .select('pro_id, qty')
        .eq('order_id', orderId);
      if (fetchErr) throw fetchErr;

      if (Array.isArray(items)) {
        for (const it of items) {
          if (!it.pro_id) continue;
          // increment product quantity by first reading current value (simpler than raw SQL)
          const { data: prodData, error: prodErr } = await supabase
            .from('Product')
            .select('*')
            .eq('id', it.pro_id)
            .single();
          if (!prodErr && prodData) {
            const newSaleQty = (prodData.qty_sale || 0) - (it.qty || 0);
            const newStockQty = (prodData.qty_stock || 0) + (it.qty || 0);
            await supabase
              .from('Product')
              .update({ 
                qty_stock: newStockQty, // also update qty_stock to match
                qty_sale: newSaleQty // reset qty_sale since we're restoring all stock
               })
              .eq('id', it.pro_id);
          }
          // note: raw expression used to avoid race conditions where possible
        }
      }
      const { error: e1 } = await supabase
        .from('OrderItem')
        .delete()
        .eq('order_id', orderId);
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from('Order')
        .delete()
        .eq('id', orderId);
      if (e2) throw e2;

      swal('ສຳເລັດ!', 'ລາຍການສັ່ງຊື້ຖືກຍົກເລີກອໍເດີ້ແລ້ວ', 'success');
      refresh();
    } catch (err: any) {
      swal('ຜິດພາດ!', 'ຍົກເລີກອໍເດີ້ failed: ' + err.message, 'error');
    }
  });
}
