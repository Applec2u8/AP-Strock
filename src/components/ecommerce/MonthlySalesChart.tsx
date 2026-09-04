import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

type PeriodType = "last7" | "week1" | "week2" | "week3" | "week4";

export default function MonthlySalesChart() {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodType>("last7");
  const [chartData, setChartData] = useState<{ categories: string[]; data: number[] }>({
    categories: [],
    data: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        setLoading(true);
        const { data: items, error } = await supabase
          .from("OrderItem")
          .select(`*, order_id!inner(created_at, promotion, phase_id!inner(status))`)
          .eq('order_id.phase_id.status', 'active');

        if (error) throw error;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Filter items by period
        let filteredItems = items || [];

        if (period === "last7") {
          // Last 7 days
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          filteredItems = filteredItems.filter((item) => {
            const itemDate = new Date(item.order_id?.created_at);
            return itemDate >= sevenDaysAgo && itemDate <= now;
          });
        } else {
          // Week of month (1-4)
          const weekNum = parseInt(period.replace("week", ""));
          const startDay = (weekNum - 1) * 7 + 1;
          const endDay = weekNum * 7;

          filteredItems = filteredItems.filter((item) => {
            const itemDate = new Date(item.order_id?.created_at);
            return (
              itemDate.getMonth() === currentMonth &&
              itemDate.getFullYear() === currentYear &&
              itemDate.getDate() >= startDay &&
              itemDate.getDate() <= endDay
            );
          });
        }

        // Group by date
        const byDate: Record<string, { count: number; total: number }> = {};

        filteredItems.forEach((item) => {
          const itemDate = new Date(item.order_id?.created_at);
          const dateStr = itemDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const isPromo = item.order_id?.promotion;
          const itemTotal = isPromo
            ? item.order_id.promotion * (item.qty || 0)
            : (item.price || 0) * (item.qty || 0);

          if (!byDate[dateStr]) {
            byDate[dateStr] = { count: 0, total: 0 };
          }
          byDate[dateStr].count += 1;
          byDate[dateStr].total += itemTotal;
        });

        const categories = Object.keys(byDate);
        // use total sales amount for each day
        const data = Object.values(byDate).map((d) => Math.round(d.total));

        setChartData({ categories, data });
      } catch (e) {
        console.error("Error fetching sales data:", e);
        setChartData({ categories: [], data: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [period]);

  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 180,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
      categories: chartData.categories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    yaxis: {
      title: {
        text: "₭",
      },
      labels: {
        formatter: (val) => val.toLocaleString('en-US'),
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      x: {
        show: false,
      },
      y: {
        formatter: (val: number) => `${val.toLocaleString('en-US')} ₭`,
      },
    },
  };

  const series = [
    {
      name: "Sales",
      data: chartData.data.length > 0 ? chartData.data : [0],
    },
  ];

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handlePeriodSelect = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    closeDropdown();
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "last7":
        return "ທີ່ຜ່ານມາ 7 ວັນ";
      case "week1":
        return "ອາທິດ 1";
      case "week2":
        return "ອາທິດ 2";
      case "week3":
        return "ອາທິດ 3";
      case "week4":
        return "ອາທິດ 4";
      default:
        return "ທີ່ຜ່ານມາ 7 ວັນ";
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            ຍອດຂາຍ {getPeriodLabel()}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {loading ? "ກຳລັງໂຫລດ..." : `${chartData.categories.length} ວັນ`}
          </p>
        </div>
        <div className="relative inline-block">
          <button 
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5"
            onClick={toggleDropdown}
          >
            <span className="text-xs">🔽</span>
            {getPeriodLabel()}
          </button>
          <Dropdown
            isOpen={isOpen}
            onClose={closeDropdown}
            className="w-48 p-2 right-0"
          >
            <DropdownItem
              onItemClick={() => handlePeriodSelect("last7")}
              className={`flex w-full font-normal text-left px-3 py-2 rounded-lg ${
                period === "last7"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              ທີ່ຜ່ານມາ 7 ວັນ
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handlePeriodSelect("week1")}
              className={`flex w-full font-normal text-left px-3 py-2 rounded-lg ${
                period === "week1"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              ອາທິດ 1 ຂອງເດືອນ
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handlePeriodSelect("week2")}
              className={`flex w-full font-normal text-left px-3 py-2 rounded-lg ${
                period === "week2"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              ອາທິດ 2 ຂອງເດືອນ
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handlePeriodSelect("week3")}
              className={`flex w-full font-normal text-left px-3 py-2 rounded-lg ${
                period === "week3"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              ອາທິດ 3 ຂອງເດືອນ
            </DropdownItem>
            <DropdownItem
              onItemClick={() => handlePeriodSelect("week4")}
              className={`flex w-full font-normal text-left px-3 py-2 rounded-lg ${
                period === "week4"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              ອາທິດ 4 ຂອງເດືອນ
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
          {loading ? (
            <div className="h-[180px] flex items-center justify-center text-gray-500">
              ກຳລັງໂຫລດຂໍ້ມູນ...
            </div>
          ) : chartData.categories.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-gray-500">
              ບໍ່ມີຂໍ້ມູນໃນໄລຍະເວລານີ້
            </div>
          ) : (
            <Chart options={options} series={series} type="bar" height={180} />
          )}
        </div>
      </div>
    </div>
  );
}
