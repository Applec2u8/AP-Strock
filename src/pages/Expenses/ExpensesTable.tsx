import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import Badge from "../../components/ui/badge/Badge";
import { Expense } from './useExpenses'

interface ExpensesTableProps {
  expenses: Expense[];
  totalCount: number;
  loading: boolean;
  payees?: { id: number; name: string }[];
  handleUpdate: (expense: Expense) => void;
  handleDelete: (id: number) => void;
}

const ExpensesTable: React.FC<ExpensesTableProps> = ({
  expenses,
  totalCount,
  loading,
  payees = [],
  handleUpdate,
  handleDelete,
}) => {
  const [selectedPayeeFilter, setSelectedPayeeFilter] = useState<string>('')

  const getTotalAmount = () => {
    return getFilteredExpenses().reduce((sum, exp) => sum + (exp.amount || 0), 0)
  }

  const getFilteredExpenses = () => {
    if (!selectedPayeeFilter) return expenses
    
    return expenses.filter((exp) => {
      if (typeof exp.payee_id === 'object' && exp.payee_id?.id) {
        return String(exp.payee_id.id) === selectedPayeeFilter
      }
      return false
    })
  }

  const filteredExpenses = getFilteredExpenses()

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      {/* Filter Section */}
      <div className="px-5 py-3 border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-white/[0.02]">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ຕັ້ງຄ່າຂໍ້ມູນຜູ້ຮັບບໍລິການ:</label>
        <select 
          value={selectedPayeeFilter} 
          onChange={(e) => setSelectedPayeeFilter(e.target.value)}
          className="mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white w-full"
        >
          <option value="">ທັງໝົດ</option>
          {payees.map((payee) => (
            <option key={payee.id} value={payee.id.toString()}>
              {payee.name}
            </option>
          ))}
        </select>
      </div>

      <div className="max-w-full overflow-x-auto">
        {loading ? (
          <Table>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {Array(Math.max(totalCount, 5))
                .fill(null)
                .map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20" />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16" />
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            {/* Table Header */}
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow className={filteredExpenses.length === 0 ? 'hidden' : ''}>
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
                  ລາຍລະອຽດ
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  ຈຳນວນເງິນ
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  ວັນທີ
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  ຜູ້ຮັບບໍລິການ
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  ດຳເນີນການ
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((exp, idx) => (
                  <TableRow key={exp.id} className='hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer'>
                    <TableCell className="sticky left-0 z-10 px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400 hover:bg-gray-200 bg-gray-50 dark:bg-gray-900/50 dark:hover:bg-gray-800 dark:border-gray-700">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {exp.description}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {exp.amount?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₭
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {exp.created_at ? new Date(exp.created_at).toLocaleDateString('lo-LA') : '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      {exp.payee_id?.name || '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-gray-500 text-theme-sm dark:text-gray-400">
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdate(exp)} className="p-0">
                          <Badge variant="light" color="primary">
                            ແກ້ໄຂ
                          </Badge>
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="p-0">
                          <Badge variant="light" color="error">
                            ລົບ
                          </Badge>
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                    ບໍ່ມີລາຍການໃຊ້ຈ່າຍ
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
      
      {/* Footer with total */}
      {!loading && filteredExpenses.length > 0 && (
        <div className="border-t border-gray-100 dark:border-white/[0.05] px-5 py-3 bg-gray-50 dark:bg-white/[0.02] flex justify-between items-center">
          <span className="text-gray-600 dark:text-gray-400 font-medium">ລວມທັງໝົດ:</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {getTotalAmount().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₭
          </span>
        </div>
      )}
    </div>
  )
}

export default ExpensesTable;
