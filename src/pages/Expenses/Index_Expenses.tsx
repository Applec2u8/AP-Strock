import Button from "../../components/ui/button/Button";
import { useExpenses } from './useExpenses';
import ExpensesTable from './ExpensesTable';

export default function Index_Expenses() {
  const {
    expenses,
    totalCount,
    loading,
    error,
    payees,
    fetchExpenses,
    handleCreate,
    handleUpdate,
    handleDelete,
  } = useExpenses()

  const onExport = async () => {
    if (!expenses || expenses.length === 0) {
      alert('No expenses to export')
      return
    }

    // Prepare data
    const headers = ['#ເຟສ', 'ເວລາ', 'ຈຳນວນເງີນ', 'ຜູ້ຮັບເງີນ', 'ລາຍລະອຽດ', 'ຜູ້ສ້າງ']
    const rows = expenses.map((e: any) => [
      e.phase_id?.phase_name ?? '',
      e.created_at ? new Date(e.created_at).toLocaleString() : '',
      e.amount ?? '',
      e.payee_id?.name || '',
      e.description || '',
      e.user_id?.fullname || '',
    ])

    // Try SheetJS (.xlsx) via dynamic import
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const aoa = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, 'Expenses')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      XLSX.writeFile(wb, `ລາຍຈ່າຍ-${ts}.xlsx`)
      return
    } catch (xlsxErr) {
      console.warn('SheetJS not available, falling back to CSV export', xlsxErr)
    }

    // Fallback: CSV download (UTF-8 BOM)
    try {
      const bom = '\uFEFF'
      const titleLine = 'ລາຍການໃຊ້ຈ່າຍ'
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
      a.download = `expenses-${ts}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed', err)
      alert('Export failed')
    }
  }

  return (
    <>
      <div className="flex md:justify-end mb-2 gap-1">
        <Button size="sm" className='h-6' variant="outline" onClick={() => handleCreate()}>
          ເພີມລາຍການໃຊ້ຈ່າຍ
        </Button>
        <Button size="sm" className='h-6' variant="outline" onClick={fetchExpenses}>
          Refresh
        </Button>
        <Button size="sm" className='h-6' variant="outline" onClick={onExport}>
          Export Excel
        </Button>
      </div>

      {error && (
        <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      <ExpensesTable
        expenses={expenses}
        totalCount={totalCount}
        loading={loading}
        payees={payees}
        handleUpdate={handleUpdate}
        handleDelete={handleDelete}
      />
    </>
  )
}
