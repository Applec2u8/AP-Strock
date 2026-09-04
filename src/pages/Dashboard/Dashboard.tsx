import { useState, useEffect } from "react";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import SalesMetrics from "../../components/ecommerce/SalesMetrics";
import { usePhases } from "../../hooks/usePhases";
import Button from "../../components/ui/button/Button";
import { exportExcel } from "../../utils/excelExport";

export default function Dashboard() {
  const { phases, createNewPhase, setActivePhase, loading } = usePhases();

  const [selectedPhase, setSelectedPhase] = useState<string>('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isChangingPhase, setIsChangingPhase] = useState(false);

  // keep selection in sync with active phase list
  useEffect(() => {
    const active = phases.find(p => p.status === 'active');
    if (active) {
      setSelectedPhase(active.id.toString());
    } else {
      setSelectedPhase('new');
    }
  }, [phases]);

  const handlePhaseChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedPhase(val);
    try {
      setIsChangingPhase(true);
      await setActivePhase(parseInt(val));
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Phase change failed:', err);
    } finally {
      setIsChangingPhase(false);
    }
  };

  const handleCreatePhase = async () => {
    try {
      setIsChangingPhase(true);
      await createNewPhase();
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Phase create failed:', err);
    } finally {
      setIsChangingPhase(false);
    }
  };

  const exportAll = async () => {
    try {
      // Get the currently active phase
      const activePhase = phases.find(p => p.status === 'active');
      if (!activePhase) {
        alert('Please select an active phase to export');
        return;
      }

      await exportExcel(activePhase);
      alert('Export completed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Export failed:', errorMessage);
      alert(errorMessage);
    }
  };

  return (
    <>
      {isChangingPhase && (
        <div className="fixed inset-0  flex items-center justify-center z-9999 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col items-center gap-4">
            <svg className="w-10 h-10 animate-spin text-blue-600 dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm text-gray-600 dark:text-gray-300">ກຳລັງປ່ຽນເຟສ...</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 xl:col-span-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-green-400 whitespace-nowrap">Online:</span>

            {/* Button to create a new phase — always clickable */}
            <button
              onClick={handleCreatePhase}
              disabled={loading || isChangingPhase}
              className="flex items-center h-8 px-3 text-sm whitespace-nowrap rounded bg-brand-500 hover:bg-brand-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              + ສ້າງຂໍ້ມູນໃໝ່
            </button>

            {/* Dropdown to switch between existing phases */}
            {phases.length > 0 && (
              <select
                value={selectedPhase}
                onChange={handlePhaseChange}
                disabled={loading || isChangingPhase}
                className="h-8 px-2 text-sm rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phases.map(p => (
                  <option key={p.id} value={p.id.toString()}>
                    {p.phase_name} {p.status === 'active' ? '✓' : ''}
                  </option>
                ))}
              </select>
            )}

            <Button size="sm" className='h-8 whitespace-nowrap' variant="outline" onClick={exportAll}>
              Export All Excel
            </Button>

          </div>
        </div>

        <div className="col-span-12 space-y-6 xl:col-span-12">
          <SalesMetrics refreshTrigger={refreshTrigger} />
        </div>

        <div className="col-span-12 xl:col-span-12">
          <RecentOrders />
        </div>
      </div>
    </>
  );
}
