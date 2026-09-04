import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";
import { Category } from './useCategories'

interface CategoryTableProps {
  categories: Category[];
  totalCount: number;
  loading: boolean;
  handleUpdate: (category: Category) => void;
  handleDelete: (id: number) => void;
}

const CategoryTable: React.FC<CategoryTableProps> = ({
  categories,
  totalCount,
  loading,
  handleUpdate,
  handleDelete,
}) => {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        {loading ? (
          <Table>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {Array(Math.max(totalCount))
                .fill(null)
                .map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            {/* Table Header */}
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow className={categories.length === 0 ? 'hidden' : ''}>
                <TableCell
                  isHeader
                  className="sticky left-0 z-20 px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 dark:border-gray-700"
                >
                  #
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  ປະເພດລາຍການ
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  ເວລາ
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Edit
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {categories.map((it, idx) => (
                <TableRow key={it.id} className='hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer'>
                  <TableCell className="sticky left-0 z-10 px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400 hover:bg-gray-200 bg-gray-50 dark:bg-gray-900/50 dark:hover:bg-gray-800 dark:border-gray-700">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    {it.name}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    {it.created_at ? new Date(it.created_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(it)} className="p-0">
                        <Badge variant="light" color="primary">
                          ແກ້ໄຂ
                        </Badge>
                      </button>
                      <button onClick={() => handleDelete(it.id)} className="p-0">
                        <Badge variant="light" color="error">
                          ລົບ
                        </Badge>
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

export default CategoryTable;
