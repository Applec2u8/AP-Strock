import React, { useState } from "react";
import { Expense } from "./useExpenses";

interface ExpenseFormProps {
  initialData?: Partial<Expense>;
  payees: { id: number; name: string }[];
  onSubmit: (data: { description: string; amount: number; payee_id: number | undefined }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({
  initialData,
  payees,
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [description, setDescription] = useState(initialData?.description || "");
  const [amount, setAmount] = useState<string>(initialData?.amount?.toString() || "");
  const [payeeId, setPayeeId] = useState<string>(
    initialData?.payee_id && typeof initialData.payee_id === "object"
      ? String((initialData.payee_id as any).id)
      : ""
  );
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const parsedAmount = parseFloat(amount);
    if (!description.trim()) { setError("ກະລຸນາໃສ່ລາຍລະອຽດ"); return; }
    if (isNaN(parsedAmount) || parsedAmount < 0) { setError("ກະລຸນາໃສ່ຈຳນວນເງິນທີ່ຖືກຕ້ອງ"); return; }
    if (payees.length > 0 && !payeeId) { setError("ກະລຸນາເລືອກຜູ້ຮັບບໍລິການ"); return; }

    try {
      await onSubmit({
        description: description.trim(),
        amount: parsedAmount,
        payee_id: payeeId ? parseInt(payeeId) : undefined,
      });
    } catch (err: any) {
      setError(err.message || "ເກີດຂໍ້ຜິດພາດ");
    }
  };

  const fieldClass =
    "w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <form onSubmit={handleSubmit} id="expense-form" className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Description */}
      <div>
        <label className={labelClass}>
          ລາຍລະອຽດ <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="ລາຍລະອຽດການໃຊ້ຈ່າຍ"
          rows={3}
          required
          className={`${fieldClass} resize-none`}
        />
      </div>

      {/* Amount */}
      <div>
        <label className={labelClass}>
          ຈຳນວນເງິນ <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          required
          className={fieldClass}
        />
      </div>

      {/* Payee */}
      {payees.length > 0 && (
        <div>
          <label className={labelClass}>
            ຜູ້ຮັບບໍລິການ <span className="text-red-500">*</span>
          </label>
          <select
            value={payeeId}
            onChange={(e) => setPayeeId(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="" className="dark:bg-gray-700">ເລືອກຜູ້ຮັບບໍລິການ</option>
            {payees.map((p) => (
              <option key={p.id} value={p.id} className="dark:bg-gray-700">
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Footer buttons (page mode only — drawer uses footer prop) */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
        >
          ຍົກເລີກ
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "ກຳລັງບັນທຶກ..." : "ບັນທຶກ"}
        </button>
      </div>
    </form>
  );
};

export default ExpenseForm;
