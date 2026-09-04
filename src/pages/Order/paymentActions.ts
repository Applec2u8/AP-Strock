import { supabase } from '../../lib/supabase';
import swal from 'sweetalert';

export async function updatePaymentMethod(
  orderId: number,
  newType: string,
  refresh: () => void
) {
  try {
    const { error } = await supabase
      .from('Order')
      .update({ pm_type: newType })
      .eq('id', orderId);
    if (error) throw error;
    swal('ສຳເລັດ!', 'ອັບເດດວິທີຈ່າຍເງິນແລ້ວ', 'success');
    refresh();
  } catch (err: any) {
    swal('ຜິດພາດ!', 'Update failed: ' + err.message, 'error');
  }
}

export function promptPaymentMethod(orderId: number, refresh: () => void) {
  swal({
    title: 'ເລືອກວິທີຈ່າຍເງິນ',
    buttons: {
      'ໂອນ': {
        text: 'ໂອນ',
        value: 'ໂອນ',
        className: 'swal-button swal-button-success',
      },
      'ຈ່າຍສົດ': {
        text: 'ຈ່າຍສົດ',
        value: 'ຈ່າຍສົດ',
        className: 'swal-button swal-button-info',
      },
      'ຍັງບໍ່ຈ່າຍ': {
        text: 'ຍັງບໍ່ຈ່າຍ',
        value: 'ຍັງບໍ່ຈ່າຍ',
        className: 'swal-button swal-button-warning',
      },
      cancel: {
        text: 'ຍົກເລີກ',
        value: null,
        className: 'swal-button swal-button--cancel',
      },
    },
    dangerMode: true,
  }).then(async (newType) => {
    if (!newType) return;
    await updatePaymentMethod(orderId, newType, refresh);
  });
}
