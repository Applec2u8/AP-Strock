import Button from "../../components/ui/button/Button";
import { useCategories } from './useCategories';
import CategoryTable from './CategoryTable';

export default function Index_Category() {
  const {
    categories,
    totalCount,
    loading,
    error,
    fetchCategories,
    handleCreate,
    handleUpdate,
    handleDelete,
  } = useCategories()

  const onExport = async () => {
    if (!categories || categories.length === 0) {
      alert('No categories to export')
      return
    }

    // Prepare data
    const headers = ['ຊື່ປະເພດ', 'ລາຍລະອຽດ', 'ວັນທີ່ສ້າງ']
    const rows = categories.map((c: any) => [
      c.name || '',
      c.description || '',
      c.created_at ? new Date(c.created_at).toLocaleString() : '',
    ])

    // Try SheetJS (.xlsx) via dynamic import
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const aoa = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      XLSX.utils.book_append_sheet(wb, ws, 'Categories')
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      XLSX.writeFile(wb, `categories-${ts}.xlsx`)
      return
    } catch (xlsxErr) {
      console.warn('SheetJS not available, falling back to CSV export', xlsxErr)
    }

    // Fallback: CSV download (UTF-8 BOM)
    try {
      const bom = '\uFEFF'
      const titleLine = 'ປະເພດສິນຄ້າ'
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
      a.download = `categories-${ts}.csv`
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
      <div className="flex justify-end mb-2 gap-1">
        <Button size="sm" className='h-6' variant="outline" onClick={handleCreate}>
          ເພີມລາຍການ
        </Button>
        <Button size="sm" className='h-6' variant="outline" onClick={fetchCategories}>
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

      <CategoryTable
        categories={categories}
        totalCount={totalCount}
        loading={loading}
        handleUpdate={handleUpdate}
        handleDelete={handleDelete}
      />
    </>
  )
}

