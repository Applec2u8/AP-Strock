import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/button/Button';
import swal from 'sweetalert';
import { FormDrawer } from '../../components/ui/drawer/FormDrawer';

const LS_KEY_PAYEES = 'ap_payee_names';

function useSuggestList(lsKey: string) {
  const getSaved = (): string[] => {
    try { return JSON.parse(localStorage.getItem(lsKey) || '[]'); }
    catch { return []; }
  };
  const save = (name: string) => {
    const list = getSaved().filter(n => n !== name);
    list.unshift(name);
    localStorage.setItem(lsKey, JSON.stringify(list.slice(0, 20)));
  };
  return { getSaved, save };
}

interface PaymentModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  setOrders?: any;
  ordersSnapshot?: any[];
}

export default function PaymentModal({ order, isOpen, onClose, setOrders, ordersSnapshot }: PaymentModalProps) {
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [pmType, setPmType] = useState('ໂອນ');
  const [loading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Local state for pending payments
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  const payeeRef = useRef<HTMLInputElement>(null);
  const { getSaved: getSavedPayees, save: savePayee } = useSuggestList(LS_KEY_PAYEES);

  const filteredSuggestions = getSavedPayees().filter(n =>
    n.toLowerCase().includes(payeeName.toLowerCase()) && n !== payeeName
  );

  useEffect(() => {
    if (!isOpen) {
      setPayeeName('');
      setAmount('');
      setPendingPayments([]); // Reset on close
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const salePrice = order.sale_price || 0;
  const payments = order.OrderPayment || [];
  const existingPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const pendingPaid = pendingPayments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const totalPaid = existingPaid + pendingPaid;
  const remaining = salePrice - totalPaid;

  const handleAddToList = () => {
    if (!payeeName || !amount) {
      swal('Error', 'ກະລຸນາໃສ່ຊື່ ແລະ ຈຳນວນເງິນ', 'error');
      return;
    }
    setPendingPayments([...pendingPayments, {
      payee: payeeName,
      amount: Number(amount),
      pm_type: pmType,
      created_at: new Date().toISOString()
    }]);
    savePayee(payeeName);
    setPayeeName('');
    setAmount('');
  };

  const handleSaveAll = async () => {
    if (pendingPayments.length === 0) {
      onClose();
      return;
    }

    const inserts = pendingPayments.map(p => ({
      order_id: order.id,
      payee: p.payee,
      amount: p.amount,
      pm_type: p.pm_type
    }));

    const newOrderStatus = totalPaid >= salePrice ? inserts[inserts.length-1].pm_type : 'ທະຍອຍຈ່າຍ';

    // --- Optimistic Update ---
    if (setOrders) {
       setOrders((prev: any[]) => prev.map(o => {
         if (o.id === order.id) {
           return {
             ...o,
             pm_type: newOrderStatus,
             OrderPayment: [
               ...(o.OrderPayment || []),
               ...inserts.map((ins, idx) => ({ ...ins, id: -(Date.now() + idx), created_at: new Date().toISOString() }))
             ]
           };
         }
         return o;
       }));
    }

    setPendingPayments([]);
    onClose(); // Close modal immediately for snappy feeling

    try {
      const { error } = await supabase.from('OrderPayment').insert(inserts);
      if (error) throw error;

      const { error: updateError } = await supabase.from('Order').update({ pm_type: newOrderStatus }).eq('id', order.id);
      if (updateError) throw updateError;
    } catch (err: any) {
      // --- Rollback ---
      if (setOrders && ordersSnapshot) {
         setOrders(ordersSnapshot);
      }
      swal('Error', 'Failed to save payments: ' + err.message, 'error');
    }
  };

  const handleDeleteExisting = async (paymentId: number) => {
    if (!window.confirm('ຕ້ອງການລຶບລາຍການນີ້ແທ້ບໍ?')) return;

    // --- Optimistic Update ---
    if (setOrders) {
       setOrders((prev: any[]) => prev.map(o => {
          if (o.id === order.id) {
             return {
                ...o,
                OrderPayment: (o.OrderPayment || []).filter((p: any) => p.id !== paymentId)
             };
          }
          return o;
       }));
    }

    try {
      const { error } = await supabase.from('OrderPayment').delete().eq('id', paymentId);
      if (error) throw error;
    } catch (err: any) {
      // --- Rollback ---
      if (setOrders && ordersSnapshot) {
         setOrders(ordersSnapshot);
      }
      swal('Error', 'Failed to delete: ' + err.message, 'error');
    }
  };

  const removePending = (index: number) => {
    setPendingPayments(pendingPayments.filter((_, i) => i !== index));
  };

  return (
    <FormDrawer
      isOpen={isOpen && !!order}
      onClose={onClose}
      title={`ຊຳລະເງິນ - ອໍເດີ້ #${order?.order || '#'}`}
      footer={
        <Button className="w-full font-medium" variant="primary" onClick={handleSaveAll} disabled={loading || pendingPayments.length === 0}>
          {loading ? 'ກຳລັງບັນທຶກ...' : `ບັນທຶກທັງໝົດ (${pendingPayments.length} ລາຍການ)`}
        </Button>
      }
    >
      {order && (
        <div>
            {/* Balance Summary */}
            <div className="mb-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                <span>ຍອດລວມທັງໝົດ:</span>
                <span className="font-bold">{salePrice.toLocaleString('en-US')} ₭</span>
              </div>
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>ຈ່າຍແລ້ວ:</span>
                <span className="font-bold">{totalPaid.toLocaleString('en-US')} ₭</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-red-500 border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                <span>ຍັງເຫຼືອ:</span>
                <span>{Math.max(0, remaining).toLocaleString('en-US')} ₭</span>
              </div>
            </div>

            {/* Add Payment Form */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">ເພີ່ມການຈ່າຍເງິນ</h4>
              <div className="space-y-2">
                {/* Payee Name with Suggestions */}
                <div className="relative">
                  <input
                    ref={payeeRef}
                    type="text"
                    placeholder="ຊື່ຜູ້ຈ່າຍ"
                    value={payeeName}
                    onChange={(e) => { setPayeeName(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    autoComplete="off"
                  />
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded shadow-lg max-h-40 overflow-y-auto">
                      {filteredSuggestions.map((name) => (
                        <div
                          key={name}
                          onMouseDown={() => { setPayeeName(name); setShowSuggestions(false); }}
                          className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
                        >
                          👤 {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment method + amount in one row */}
                <div className='flex gap-1'>
                  <select
                    value={pmType}
                    onChange={(e) => setPmType(e.target.value)}
                    className="w-1/3 sm:w-1/4 p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="ໂອນ">ໂອນ</option>
                    <option value="ຈ່າຍສົດ">ຈ່າຍສົດ</option>
                  </select>
                  <div className="relative w-full flex-1">
                    <input
                      type="number"
                      inputMode="numeric" pattern="[0-9]*"
                      placeholder="ຈຳນວນເງິນ"
                      value={amount}
                      onChange={(e) => {
                        let val: number | '' = e.target.value === '' ? '' : Number(e.target.value);
                        if (val !== '' && val > Math.max(0, remaining)) {
                          val = Math.max(0, remaining);
                        }
                        setAmount(val);
                      }}
                      className="w-full p-2 pr-14 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setAmount(Math.max(0, remaining))}
                      className="absolute right-1.5 top-1.5 px-2.5 py-1 text-[11px] uppercase font-bold bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-800 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleAddToList}
                    className={`px-4 py-1.5 text-sm rounded font-medium transition-all duration-200 border ${
                      payeeName && amount
                        ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md shadow-blue-200 dark:shadow-blue-900/30 scale-[1.02]'
                        : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-default'
                    }`}
                  >
                    + ເພີ່ມລົງລາຍການ
                  </button>
                </div>
              </div>
            </div>

            {/* Payment History */}
            <div>
              <h4 className="text-sm font-semibold mb-2 text-gray-800 dark:text-gray-200">ປະຫວັດການຈ່າຍເງິນ</h4>
              {payments.length === 0 && pendingPayments.length === 0 ? (
                <p className="text-xs text-gray-500">ຍັງບໍ່ມີການຈ່າຍເງິນ</p>
              ) : (
                <div className="space-y-2">
                  {/* Pending Payments — newest first, shown on top */}
                  {[...pendingPayments].reverse().map((p: any, idx: number) => (
                    <div key={'pending-'+idx} className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                      <div>
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-300">
                          {p.payee} <span className="text-[10px] text-blue-500 ml-1 font-normal bg-blue-100 dark:bg-blue-800/50 px-1.5 py-0.5 rounded-full">ລໍຖ້າບັນທຶກ</span>
                        </div>
                        <div className="text-xs text-blue-600/70 dark:text-blue-400/70">{p.pm_type} • {new Date(p.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-green-600">{Number(p.amount).toLocaleString('en-US')} ₭</span>
                        <button onClick={() => removePending(pendingPayments.length - 1 - idx)} className="text-red-500 hover:text-red-700 text-xs px-1 font-semibold">ລຶບ</button>
                      </div>
                    </div>
                  ))}

                  {/* Existing Payments */}
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-700">
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.payee}</div>
                        <div className="text-xs text-gray-500">{p.pm_type} • {new Date(p.created_at).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-green-600">{Number(p.amount).toLocaleString('en-US')} ₭</span>
                        <button onClick={() => handleDeleteExisting(p.id)} className="text-red-500 hover:text-red-700 text-xs px-1 font-semibold">ລຶບ</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
        </div>
      )}
    </FormDrawer>
  );
}
