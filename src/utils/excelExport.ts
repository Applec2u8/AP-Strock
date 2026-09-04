import { supabase } from '../lib/supabase';

interface Phase {
  id: number;
  phase_name: string;
  status: string;
}

export const exportExcel = async (activePhase: Phase) => {
  try {
    console.log('Starting export...');
    console.log('Exporting for phase:', activePhase.phase_name);

    // Fetch data for the active phase only
    const fetchAllOrders = async () => {
      const { data, error } = await supabase
        .from('Order')
        .select(`*, OrderItem(*, pro_id(*, cate_id(*))), user_id(*), phase_id(phase_name), OrderPayment(*)`)
        .eq('phase_id', activePhase.id)
        .order('id', { ascending: false });
      if (error) throw new Error(`Orders fetch error: ${error.message}`);
      return data as any[] || [];
    };

    const fetchAllExpenses = async () => {
      const { data, error } = await supabase
        .from('Expenses')
        .select(`*, user_id(*), payee_id(*), phase_id(id)`)
        .eq('phase_id', activePhase.id)
        .order('id', { ascending: false });
      if (error) throw new Error(`Expenses fetch error: ${error.message}`);
      return data as any[] || [];
    };

    const fetchAllProducts = async () => {
      const { data, error } = await supabase
        .from('Product')
        .select(`*, user(*), phase_id(phase_name), cate_id(*)`)
        .eq('phase_id', activePhase.id)
        .order('id', { ascending: false });
      if (error) throw new Error(`Products fetch error: ${error.message}`);
      return data as any[] || [];
    };

    // Fetch all data
    const [allOrders, allExpenses, allProducts] = await Promise.all([
      fetchAllOrders(),
      fetchAllExpenses(),
      fetchAllProducts()
    ]);

    console.log('All data fetched successfully');

    const orders = allOrders;
    const expenses = allExpenses;

    // Prepare Product data
    const productHeaders = ['#ເຟສ', 'ສິນຄ້າ', 'SKU', 'ນຳເຂົ້າ', 'ຈຳນວນຂາຍ', 'ຍັງສະຕ໋ອກ', 'ປະເພດ', 'ຕົ້ນທືນ', 'ລາຄາຂາຍ', 'ຜູ້ສ້າງ', 'ວັນທີ່ສ້າງ'];
    const productRows = allProducts.map(p => [
      p.phase_id?.phase_name || '',
      p.pro_name,
      p.sku,
      p.quantity,
      p.qty_sale || 0,
      p.qty_stock || 0,
      p.cate_id?.name || '',
      p.cost_price != null ? p.cost_price.toLocaleString('en-US') + ' ₭' : '',
      p.sell_price != null ? p.sell_price.toLocaleString('en-US') + ' ₭' : '',
      p.user?.fullname || '',
      p.created_at || '',
    ]);

    const getPaymentStatus = (o: any) => {
        const salePrice = o.sale_price || 0;
        const payments = o.OrderPayment || [];
        const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
        if (salePrice === 0) return { status: 'free', totalPaid, remaining: 0 };
        if (totalPaid >= salePrice) return { status: 'paid', totalPaid, remaining: 0 };
        if (totalPaid > 0) return { status: 'partial', totalPaid, remaining: salePrice - totalPaid };
        return { status: 'unpaid', totalPaid: 0, remaining: salePrice };
    };

    // Prepare Order data
    const orderHeaders = ['#ອໍເດີ', 'ເວລາ', 'ການຈ່າຍ', 'ສະຖານະການຈ່າຍ', 'ຈ່າຍແລ້ວ', 'ຄ້າງຈ່າຍ', 'ຈຳນວນລວມ', 'ໂປຣໂມຊັ່ນ', 'ເງີນລວມ', 'ຜູ້ຮັບເງີນ', 'ລາຍການ', 'ຜູ້ອອກບີນ', 'ຈັດສົ່ງ'];
    const orderRows = orders.map(o => {
      const items = (o.OrderItem || [])
        .map((it: any) => `${it.pro_id?.pro_name || ''} x ${it.qty} @ ${it.price?.toLocaleString('en-US')} ₭`)
        .join(' | ');
      const addressStr = o.address
        ? `${o.address.name || ''} | ${o.address.phone || ''} | ${o.address.branch || ''} | ${o.address.address || ''}`
        : '';

      const ps = getPaymentStatus(o);
      const paymentStatusText = ps.status === 'paid' ? 'ຈ່າຍຄົບແລ້ວ' : ps.status === 'partial' ? 'ທະຍອຍຈ່າຍ' : ps.status === 'unpaid' ? 'ຍັງບໍ່ຈ່າຍ' : 'N/A';

      return [
        `#${o.order || ''}`,
        o.created_at ? new Date(o.created_at).toLocaleString() : '',
        o.pm_type || '',
        paymentStatusText,
        ps.totalPaid,
        ps.remaining,
        o.total_qty ?? '',
        o.promotion != null ? o.promotion.toLocaleString('en-US') + ' ₭' : '',
        o.sale_price != null ? o.sale_price.toLocaleString('en-US') + ' ₭' : '',
        o.payee ?? '',
        items,
        o.user_id?.fullname || '',
        addressStr,
      ];
    });

    // Prepare OrderItem data
    const orderItemHeaders = ['ສິນຄ້າ', 'ປະເພດ', 'ຈຳນວນ', 'ລາຄາຈີງ', 'ລາຄາໂປຣໂມຊັ່ນ', 'ລາຄາຂາຍລວມ', '#ອໍເດີ'];
    const orderItemRows = orders.flatMap(o =>
      (o.OrderItem || []).map((it: any) => {
        const total = o.promotion == null ? ((it.price || 0) * (it.qty || 0)) : ((o.promotion || 0) * (it.qty || 0));
        return [
          it.pro_id?.pro_name || '',
          it.pro_id?.cate_id?.name || '',
          it.qty || 0,
          (it.price || 0).toLocaleString('en-US') + ' ₭',
          o.promotion == null ? '' : o.promotion === 0 ? '0 ₭' : o.promotion.toLocaleString('en-US') + ' ₭',
          total.toLocaleString('en-US') + ' ₭',
          `#${o.order}`,
        ];
      })
    );

    // Prepare Expenses data
    const expenseHeaders = ['ເວລາ', 'ຈຳນວນເງີນ', 'ຜູ້ຮັບເງີນ', 'ລາຍລະອຽດ', 'ຜູ້ສ້າງ'];
    const expenseRows = expenses.map(e => [
      e.created_at ? new Date(e.created_at).toLocaleString() : '',
      e.amount != null ? e.amount.toLocaleString('en-US') + ' ₭' : '',
      e.payee_id?.name || '',
      e.description || '',
      e.user_id?.fullname || '',
    ]);

    // Prepare Summary Report
    const totalIncome = orders.reduce((sum, order) => sum + (order.sale_price || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const totalProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? (totalProfit / totalIncome * 100) : 0;

    const hourlyCounts: Record<number, number> = {};
    const hourlyTotals: Record<number, number> = {};
    orders.forEach(o => {
      if (o.created_at) {
        const h = new Date(o.created_at).getHours();
        hourlyCounts[h] = (hourlyCounts[h] || 0) + 1;
        hourlyTotals[h] = (hourlyTotals[h] || 0) + (o.sale_price || 0);
      }
    });

    let bestHour = -1;
    let maxOrders = 0;
    for (let h = 0; h < 24; h++) {
      if (hourlyCounts[h] && hourlyCounts[h] > maxOrders) {
        maxOrders = hourlyCounts[h];
        bestHour = h;
      }
    }
    const bestHourStr = bestHour >= 0
      ? `${String(bestHour).padStart(2, '0')}:00 - ${String(bestHour + 1).padStart(2, '0')}:00 (${maxOrders} ລາຍການ)`
      : '-';

    const hourlyHeaders = ['ຊ່ວງເວລາ (ໂມງ)', 'ຈຳນວນລາຍການ (ອໍເດີ້)', 'ຍອດຂາຍລວມ (ກີບ)'];
    const hourlyRows: any[] = [];
    for (let h = 0; h < 24; h++) {
      const timeStr = `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`;
      const count = hourlyCounts[h] || 0;
      const total = hourlyTotals[h] || 0;
      hourlyRows.push([
        timeStr,
        count,
        total.toLocaleString('en-US') + ' ₭'
      ]);
    }

    const summaryRows = [
      ['ລາຍຮັບລວມ', totalIncome.toLocaleString('en-US') + ' ₭'],
      ['ລາຍຈ່າຍລວມ', totalExpenses.toLocaleString('en-US') + ' ₭'],
      ['ກຳໄລລວມ', totalProfit.toLocaleString('en-US') + ' ₭'],
      ['ອັດຕາສ່ວນກຳໄລ', profitMargin.toFixed(2) + '%'],
      ['ຊ່ວງເວລາຂາຍດີທີ່ສຸດ', bestHourStr],
    ];

    // Prepare Payee Summary
    const payeeTotals: { [key: string]: number } = {};

    orders.forEach(order => {
      if (order.payee) {
        payeeTotals[order.payee] = (payeeTotals[order.payee] || 0) + (order.sale_price || 0);
      }
    });

    const payeeRows = Object.keys(payeeTotals)
      .sort()
      .map(payee => [
        payee,
        payeeTotals[payee].toLocaleString('en-US') + ' ₭'
      ]);

    // Combined Summary Sheet
    const combinedSummaryData = [
      [],
      ['ສະຫຼຸບລາຍງານທາງການເງິນ'],
      [],
      ...summaryRows.map(row => row),
      [],
      ['ຜູ້ຮັບເງີນລາຍລະອຽດ'],
      ...payeeRows.map(row => row),
    ];

    // Create Excel file with multiple sheets
    console.log('Creating Excel workbook...');
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    console.log('Workbook created');

    // Add sheets
    if (productRows.length > 0) {
      const productWs = XLSX.utils.aoa_to_sheet([productHeaders, ...productRows]);
      XLSX.utils.book_append_sheet(wb, productWs, 'ນຳເຂົ້າສິນຄ້າ');
    }

    if (orderRows.length > 0) {
      const orderWs = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
      XLSX.utils.book_append_sheet(wb, orderWs, 'ອໍເດີ້');
    }

    if (orderItemRows.length > 0) {
      const orderItemWs = XLSX.utils.aoa_to_sheet([orderItemHeaders, ...orderItemRows]);
      XLSX.utils.book_append_sheet(wb, orderItemWs, 'ລາຍການຂາຍ');
    }

    if (expenseRows.length > 0) {
      const expenseWs = XLSX.utils.aoa_to_sheet([expenseHeaders, ...expenseRows]);
      XLSX.utils.book_append_sheet(wb, expenseWs, 'ລາຍການໃຊ້ຈ່າຍ');
    }

    if (hourlyRows.length > 0) {
      const hourlyWs = XLSX.utils.aoa_to_sheet([hourlyHeaders, ...hourlyRows]);
      XLSX.utils.book_append_sheet(wb, hourlyWs, 'ຍອດຂາຍແຕ່ລະຊົ່ວໂມງ');
    }

    // Add Combined Summary Report sheet
    if (summaryRows.length > 0 || payeeRows.length > 0) {
      const combinedWs = XLSX.utils.aoa_to_sheet(combinedSummaryData);
      XLSX.utils.book_append_sheet(wb, combinedWs, 'ສະຫຼຸບລວມ');
    }


    // Generate filename with timestamp
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ລາຍງານລວມ-${ts}.xlsx`;
    console.log('Writing Excel file:', filename);
    XLSX.writeFile(wb, filename);
    console.log('Export completed successfully');

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Export all failed:', errorMessage, err);
    throw new Error(`Export failed: ${errorMessage}`);
  }
};
