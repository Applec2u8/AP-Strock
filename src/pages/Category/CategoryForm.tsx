import React, { useState } from "react";

interface CategoryFormProps {
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const CategoryForm: React.FC<CategoryFormProps> = ({
  initialName = "",
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) { setError("ກະລຸນາໃສ່ຊື່ປະເພດ"); return; }
    try {
      await onSubmit(trimmed);
    } catch (err: any) {
      setError(err.message || "ເກີດຂໍ້ຜິດພາດ");
    }
  };

  const fieldClass =
    "w-full px-4 py-2 border border-gray-300 rounded-lg bg-white dark:bg-white/[0.05] dark:border-white/[0.1] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form onSubmit={handleSubmit} id="category-form" className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          ຊື່ປະເພດ <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ໃສ່ຊື່ປະເພດ"
          required
          autoFocus
          className={fieldClass}
        />
      </div>

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

export default CategoryForm;
