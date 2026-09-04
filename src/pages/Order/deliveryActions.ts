import { supabase } from '../../lib/supabase';
import swal from 'sweetalert';

export async function toggleDelivery(
  orderId: number,
  currentlyConfirmed: string,
  setOrders: any,
  ordersSnapshot: any[]
) {
  const isDelivered = currentlyConfirmed === 'true';
  const confirmMsg = isDelivered
    ? 'ທ່ານຕ້ອງການຍືນ ຍົກເລີການຈັດສົງແລ້ວ ຫຼື ບໍ່?'
    : 'ທ່ານຕ້ອງການຍືນການຈັດສົງແລ້ວ ຫຼື ບໍ່?';

  swal({
    title: 'ຢືນຢັນ',
    text: confirmMsg,
    icon: 'info',
    buttons: ['ຍົກເລີກ', 'ຢືນຢັນ'],
    dangerMode: false,
  }).then(async (willUpdate) => {
    if (!willUpdate) return;

    const newStatus = isDelivered ? 'false' : 'true';

    // --- Optimistic Update ---
    setOrders((prev: any[]) => prev.map(o => o.id === orderId ? { ...o, delivery_confirmed: newStatus } : o));

    try {
      const { error } = await supabase
        .from('Order')
        .update({ delivery_confirmed: newStatus })
        .eq('id', orderId);
      if (error) throw error;
      swal('ສຳເລັດ!', 'ອັບເດດສະຖານະການຈັດສົງແລ້ວ', 'success');
      // No refresh needed
    } catch (err: any) {
      // --- Rollback ---
      setOrders(ordersSnapshot);
      swal('ຜິດພາດ!', 'Update failed: ' + err.message, 'error');
    }
  });
}
