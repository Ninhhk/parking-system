"use client";

import { useState, useEffect } from "react";
import PageHeader from "../../components/admin/PageHeader";
import { useUser } from "../../components/providers/UserProvider";
import { HiCash, HiUserGroup, HiOfficeBuilding, HiClock } from "react-icons/hi";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import {
  fetchOverallStats,
  fetchRevenueData,
  fetchParkingLotOccupancy,
  fetchPopularTimes,
  fetchVehicleUsage,
  fetchParkingDuration,
} from "../../api/admin.client";
import { toast } from "react-hot-toast";

// Register the chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function InsightPage() {
  const { user } = useUser();
  const [timeRange, setTimeRange] = useState("weekly"); // weekly, monthly, yearly
  const [loading, setLoading] = useState(true);
  
  // State for real data
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalUsers: 0,
    totalLots: 0,
    averageTimeMinutes: 0,
  });
  const [revenueData, setRevenueData] = useState([]);
  const [occupancyData, setOccupancyData] = useState([]);
  const [popularTimesData, setPopularTimesData] = useState([]);
  const [vehicleUsageData, setVehicleUsageData] = useState([]);
  const [parkingDurationData, setParkingDurationData] = useState([]);

  // Fetch all analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [
        statsData,
        revenueDataResponse,
        occupancyDataResponse,
        popularTimesDataResponse,
        vehicleUsageDataResponse,
        parkingDurationDataResponse,
      ] = await Promise.all([
        fetchOverallStats(),
        fetchRevenueData(timeRange),
        fetchParkingLotOccupancy(),
        fetchPopularTimes(),
        fetchVehicleUsage(),
        fetchParkingDuration(),
      ]);

      setStats(statsData);
      setRevenueData(revenueDataResponse);
      setOccupancyData(occupancyDataResponse);
      setPopularTimesData(popularTimesDataResponse);
      setVehicleUsageData(vehicleUsageDataResponse);
      setParkingDurationData(parkingDurationDataResponse);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // Refetch revenue data when time range changes
  useEffect(() => {
    const fetchRevenueOnly = async () => {
      try {
        const data = await fetchRevenueData(timeRange);
        setRevenueData(data);
      } catch (error) {
        console.error("Error fetching revenue data:", error);
        toast.error("Failed to load revenue data");
      }
    };
    
    fetchRevenueOnly();
  }, [timeRange]);

  // Format stats for display
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = Math.round(minutes % 60);
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  // Process data for charts
  const processRevenueData = () => {
    if (!revenueData.length) return { labels: [], data: [] };
    
    return {
      labels: revenueData.map(item => item.period),
      data: revenueData.map(item => parseFloat(item.revenue))
    };
  };

  const processOccupancyData = () => {
    if (!occupancyData.length) return { labels: [], data: [] };
    
    return {
      labels: occupancyData.map(item => item.lot_name),
      data: occupancyData.map(item => parseFloat(item.occupancy_percentage))
    };
  };

  const processPopularTimesData = () => {
    if (!popularTimesData.length) return { labels: [], data: [] };
    
    // Define the order of time periods
    const timeOrder = ["6am-9am", "9am-12pm", "12pm-3pm", "3pm-6pm", "6pm-9pm", "9pm-12am"];
    
    // Create ordered data
    const orderedData = timeOrder.map(period => {
      const found = popularTimesData.find(item => item.time_period === period);
      return found ? found.percentage : 0;
    });
    
    return {
      labels: timeOrder,
      data: orderedData
    };
  };

  const processVehicleUsageData = () => {
    if (!vehicleUsageData.length) return { labels: [], datasets: [] };
    
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const vehicleTypes = [...new Set(vehicleUsageData.map(item => item.vehicle_type))];
    
    const datasets = vehicleTypes.map((type, index) => {
      const data = days.map(day => {
        const found = vehicleUsageData.find(item => 
          item.day_of_week === day && item.vehicle_type === type
        );
        return found ? parseInt(found.count) : 0;
      });
      
      return {
        label: type.charAt(0).toUpperCase() + type.slice(1) + 's',
        data: data,
        backgroundColor: index === 0 ? "rgba(54, 162, 235, 0.6)" : "rgba(255, 99, 132, 0.6)",
      };
    });
    
    return { labels: days, datasets };
  };

  const processParkingDurationData = () => {
    if (!parkingDurationData.length) return { labels: [], datasets: [] };
    
    const durations = ["< 1 hour", "1-2 hours", "2-4 hours", "4-8 hours", "8+ hours"];
    const vehicleTypes = [...new Set(parkingDurationData.map(item => item.vehicle_type))];
    
    const datasets = vehicleTypes.map((type, index) => {
      const data = durations.map(duration => {
        const found = parkingDurationData.find(item => 
          item.duration_range === duration && item.vehicle_type === type
        );
        return found ? parseInt(found.count) : 0;
      });
      
      // Convert to percentages
      const total = data.reduce((sum, val) => sum + val, 0);
      const percentages = total > 0 ? data.map(val => Math.round((val / total) * 100)) : data;
      
      return {
        label: type.charAt(0).toUpperCase() + type.slice(1) + 's',
        data: percentages,
        backgroundColor: index === 0 ? "rgba(54, 162, 235, 0.6)" : "rgba(255, 99, 132, 0.6)",
      };
    });
    
    return { labels: durations, datasets };
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Analytics & Insights" />
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading analytics data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader title="Analytics & Insights" />

      {/* Time range selector */}
      <div className="mb-6 flex space-x-2">
        <button
          onClick={() => handleTimeRangeChange("weekly")}
          className={`px-4 py-2 rounded ${
            timeRange === "weekly" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => handleTimeRangeChange("monthly")}
          className={`px-4 py-2 rounded ${
            timeRange === "monthly" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => handleTimeRangeChange("yearly")}
          className={`px-4 py-2 rounded ${
            timeRange === "yearly" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Yearly
        </button>
      </div>

      {/* Statistics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={<HiCash className="text-green-500" size={24} />}
        />
        <StatCard
          title="Registered Users"
          value={stats.totalUsers.toString()}
          icon={<HiUserGroup className="text-blue-500" size={24} />}
        />
        <StatCard
          title="Parking Lots"
          value={stats.totalLots.toString()}
          icon={<HiOfficeBuilding className="text-purple-500" size={24} />}
        />
        <StatCard
          title="Avg. Parking Time"
          value={formatTime(stats.averageTimeMinutes)}
          icon={<HiClock className="text-orange-500" size={24} />}
        />
      </div>      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue chart */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Revenue Overview</h2>
          <div className="h-[350px]">
            <Bar
              data={{
                labels: processRevenueData().labels,
                datasets: [
                  {
                    label: "Revenue (VND)",
                    data: processRevenueData().data,
                    backgroundColor: "rgba(53, 162, 235, 0.5)",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => `$${value.toLocaleString()}`,
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Occupancy chart */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Parking Lot Occupancy (%)</h2>
          <div className="h-[350px]">
            <Bar
              data={{
                labels: processOccupancyData().labels,
                datasets: [
                  {
                    label: "Occupancy (%)",
                    data: processOccupancyData().data,
                    backgroundColor: "rgba(75, 192, 192, 0.5)",
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    max: 100,
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular times */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Popular Parking Times</h2>
          <div className="h-[350px]">
            <Line
              data={{
                labels: processPopularTimesData().labels,
                datasets: [
                  {
                    label: "Usage (%)",
                    data: processPopularTimesData().data,
                    borderColor: "rgba(255, 99, 132, 0.7)",
                    backgroundColor: "rgba(255, 99, 132, 0.2)",
                    tension: 0.3,
                    fill: true,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Percentage of Total Sessions (%)'
                    }
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Parking Duration Distribution */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Parking Duration Distribution</h2>
          <div className="h-[350px]">
            <Bar
              data={processParkingDurationData()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Percentage of Total (%)'
                    }
                  },
                  x: {
                    title: {
                      display: true,
                      text: 'Duration'
                    }
                  }
                },
                plugins: {
                  legend: {
                    position: "top",
                  },
                  tooltip: {
                    callbacks: {
                      label: function(context) {
                        return `${context.dataset.label}: ${context.raw}%`;
                      }
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Additional Charts */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Additional Insights</h2>
        <div className="grid grid-cols-1 gap-6">
          {/* Vehicle Usage Comparison */}
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Weekly Vehicle Type Usage</h2>
            <div className="h-[350px]">
              <Bar
                data={processVehicleUsageData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: {
                      beginAtZero: true,
                      title: {
                        display: true,
                        text: 'Number of Vehicles'
                      }
                    }
                  },
                  plugins: {
                    legend: {
                      position: "top",
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center">
        <div className="mr-4">{icon}</div>
        <div>
          <h3 className="text-sm text-gray-600">{title}</h3>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}