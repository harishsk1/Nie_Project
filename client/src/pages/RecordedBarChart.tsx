import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { useScrollLock } from "../hooks/useScrollLock";
import { useTheme } from "../contexts/ThemeContext";
import { deviceApi } from "../api/deviceApi";
import { dataApi } from "../api/dataApi";
import RecordedDataDownload from "../components/RecordedDataDownload";

// amCharts imports
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";

interface ChartDataPoint {
  category: string;
  value: number | null;
  timestamp: number;
}

const getBaseInterval = (intervalStr: string): { timeUnit: am5.TimeUnit, count: number } => {
  if (intervalStr === "1M") return { timeUnit: "month", count: 1 };
  if (intervalStr === "1d") return { timeUnit: "day", count: 1 };
  if (intervalStr === "12h") return { timeUnit: "hour", count: 12 };
  if (intervalStr === "6h") return { timeUnit: "hour", count: 6 };
  if (intervalStr === "1h") return { timeUnit: "hour", count: 1 };
  if (intervalStr === "30m") return { timeUnit: "minute", count: 30 };
  if (intervalStr === "1m") return { timeUnit: "minute", count: 1 };
  return { timeUnit: "minute", count: 1 };
};

export default function RecordedBarChart() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Theme-aware colors
  const scrollbarTrack = isDark ? "#1f2937" : "#f1f5f9";
  const scrollbarThumb = isDark ? "#4b5563" : "#94a3b8";
  const scrollbarThumbHover = isDark ? "#6b7280" : "#64748b";

  // State
  const [devices, setDevices] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [availableParams, setAvailableParams] = useState<string[]>([]);
  const [selectedParameter, setSelectedParameter] = useState<string>("");
  const [parameterUnit, setParameterUnit] = useState<string>("");

  // Hourly data states
  const [hourlyDate, setHourlyDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [hourlyData, setHourlyData] = useState<ChartDataPoint[]>([]);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [hourlyMax, setHourlyMax] = useState<number>(0);
  const [hourlyMin, setHourlyMin] = useState<number>(0);
  const [hourlyInterval, setHourlyInterval] = useState<string>("1h");

  // Daily data states
  const [dailyMonth, setDailyMonth] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [dailyData, setDailyData] = useState<ChartDataPoint[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyMax, setDailyMax] = useState<number>(0);
  const [dailyMin, setDailyMin] = useState<number>(0);
  const [dailyInterval, setDailyInterval] = useState<string>("1d");

  // Monthly data states
  const [monthlyYear, setMonthlyYear] = useState(() => {
    const today = new Date();
    return String(today.getFullYear());
  });
  const [monthlyData, setMonthlyData] = useState<ChartDataPoint[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyMax, setMonthlyMax] = useState<number>(0);
  const [monthlyMin, setMonthlyMin] = useState<number>(0);
  const [monthlyInterval, setMonthlyInterval] = useState<string>("1M");

  // Dropdown states
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [deviceSearchQuery, setDeviceSearchQuery] = useState("");
  const [isParamDropdownOpen, setIsParamDropdownOpen] = useState(false);
  const [paramSearchQuery, setParamSearchQuery] = useState("");

  // Refs
  const deviceDropdownRef = useRef<HTMLDivElement>(null);
  const deviceButtonRef = useRef<HTMLButtonElement>(null);
  const paramDropdownRef = useRef<HTMLDivElement>(null);
  const paramButtonRef = useRef<HTMLButtonElement>(null);
  const [deviceDropdownPosition, setDeviceDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [paramDropdownPosition, setParamDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  useScrollLock(isDeviceDropdownOpen || isParamDropdownOpen);

  // Chart refs
  const hourlyChartRef = useRef<am5.Root | null>(null);
  const dailyChartRef = useRef<am5.Root | null>(null);
  const monthlyChartRef = useRef<am5.Root | null>(null);

  // Line chart refs
  const hourlyLineChartRef = useRef<am5.Root | null>(null);
  const dailyLineChartRef = useRef<am5.Root | null>(null);
  const monthlyLineChartRef = useRef<am5.Root | null>(null);

  // Filter devices and parameters based on search query
  const filteredDevices = useMemo(() => {
    if (!deviceSearchQuery.trim()) return devices;
    const query = deviceSearchQuery.toLowerCase();
    return devices.filter((device) => device.name.toLowerCase().includes(query));
  }, [devices, deviceSearchQuery]);

  const filteredParams = useMemo(() => {
    if (!paramSearchQuery.trim()) return availableParams;
    const query = paramSearchQuery.toLowerCase();
    return availableParams.filter((param) => param.toLowerCase().includes(query));
  }, [availableParams, paramSearchQuery]);

  // Close dropdowns when clicking outside + reposition on scroll/resize

  useEffect(() => {
    if (!isDeviceDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const devicePortal = document.querySelector('[data-device-dropdown-portal]');

      if (deviceDropdownRef.current &&
        !deviceDropdownRef.current.contains(target) &&
        (!devicePortal || !devicePortal.contains(target))) {
        setIsDeviceDropdownOpen(false);
        setDeviceSearchQuery("");
      }
    };

    const updateDevicePos = () => {
      if (deviceButtonRef.current) {
        const rect = deviceButtonRef.current.getBoundingClientRect();
        setDeviceDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updateDevicePos, true);
    window.addEventListener("resize", updateDevicePos);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateDevicePos, true);
      window.removeEventListener("resize", updateDevicePos);
    };
  }, [isDeviceDropdownOpen]);

  useEffect(() => {
    if (!isParamDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const paramPortal = document.querySelector('[data-param-dropdown-portal]');

      if (paramDropdownRef.current &&
        !paramDropdownRef.current.contains(target) &&
        (!paramPortal || !paramPortal.contains(target))) {
        setIsParamDropdownOpen(false);
        setParamSearchQuery("");
      }
    };

    const updateParamPos = () => {
      if (paramButtonRef.current) {
        const rect = paramButtonRef.current.getBoundingClientRect();
        setParamDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updateParamPos, true);
    window.addEventListener("resize", updateParamPos);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updateParamPos, true);
      window.removeEventListener("resize", updateParamPos);
    };
  }, [isParamDropdownOpen]);

  // Initial position measurement when dropdowns open
  useEffect(() => {
    if (isDeviceDropdownOpen && deviceButtonRef.current) {
      const rect = deviceButtonRef.current.getBoundingClientRect();
      setDeviceDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [isDeviceDropdownOpen]);

  useEffect(() => {
    if (isParamDropdownOpen && paramButtonRef.current) {
      const rect = paramButtonRef.current.getBoundingClientRect();
      setParamDropdownPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [isParamDropdownOpen]);

  // Load devices on mount
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const deviceList = await deviceApi.getAll();
        setDevices(deviceList);
        if (deviceList.length > 0) {
          setSelectedDevice(deviceList[0].name);
        }
      } catch (err) {
        console.error("Failed to load devices:", err);
      }
    };
    loadDevices();
  }, []);

  // Load available parameters when device is selected
  useEffect(() => {
    if (!selectedDevice || devices.length === 0) return;

    const device = devices.find(d => d.name === selectedDevice);
    if (!device) {
      console.warn(`Device not found in list: ${selectedDevice}`);
      return;
    }

    const loadParameters = async () => {
      try {
        console.log(`[Discovery] Starting discovery for ${selectedDevice}...`);
        
        // 1. Get from Device API (Configured parameters)
        let configuredNames: string[] = [];
        try {
          const params = await deviceApi.getParameters(device.id);
          configuredNames = params.map(p => p.name);
          console.log(`[Discovery] Device API returned:`, configuredNames);
        } catch (err) {
          console.warn(`[Discovery] Device API failed for ${selectedDevice}`);
        }

        // 2. Get from Data Snapshot (Actual records in DB)
        let dataNames: string[] = [];
        try {
          const snapshot = await dataApi.fetchSensorData(selectedDevice, { limit: 500, page: 1 });
          const rows = Array.isArray(snapshot.parameters) ? snapshot.parameters : [];
          dataNames = Array.from(new Set(rows.map(r => r.name))).filter(Boolean) as string[];
          console.log(`[Discovery] Data snapshot returned:`, dataNames);
        } catch (err) {
          console.warn(`[Discovery] Data snapshot failed for ${selectedDevice}`);
        }

        // Merge all sources
        const merged = Array.from(new Set([...configuredNames, ...dataNames]));
        
        if (merged.length > 0) {
          console.log(`[Discovery] Final parameters for ${selectedDevice}:`, merged);
          setAvailableParams(merged);
          // Auto-select first if none selected or current invalid
          if (!selectedParameter || !merged.includes(selectedParameter)) {
            setSelectedParameter(merged[0]);
          }
        } else {
          console.log(`[Discovery] No parameters found for ${selectedDevice}.`);
          setAvailableParams([]);
        }
      } catch (err) {
        console.error(`[Discovery] Critical error for ${selectedDevice}:`, err);
      }
    };

    loadParameters();
  }, [selectedDevice, devices]);

  // Fetch hourly data
  const fetchHourlyData = useCallback(async () => {
    if (!selectedDevice || !selectedParameter || !hourlyDate) return;

    setHourlyLoading(true);

    try {
      const startDate = new Date(`${hourlyDate}T00:00:00`);
      const endDate = new Date(`${hourlyDate}T23:59:59`);

      const response = await dataApi.fetchSensorData(selectedDevice, {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        names: [selectedParameter],
        interval: hourlyInterval as import("../api/dataApi").TimeInterval,
        limit: 2000,
      });

      const parameters = response.parameters || (response.data && response.data.parameters) || [];

      if (parameters.length === 0) {
        setHourlyData([]);
        setHourlyLoading(false);
        return;
      }

      // Get the unit from the first parameter if available
      if (parameters.length > 0) {
        const firstParam = parameters[0];
        if (firstParam.unit) {
          setParameterUnit(firstParam.unit);
        }
      }

      // Group by local time category string and average values in each bucket
      const categoryAccumulator = new Map<string, { sum: number; count: number }>();
      parameters.forEach((param: any) => {
        const time_bucket = param.time_bucket || param.created_at || param.timestamp || param.time;
        const date = new Date(time_bucket);
        const value = parseFloat(param.value);
        if (!isNaN(value) && value !== null) {
          let category = '';
          if (hourlyInterval === '1h') {
            category = `${String(date.getHours()).padStart(2, '0')}:00`;
          } else if (hourlyInterval === '30m') {
            // Snap minutes to the 30-min bucket boundary (0 or 30)
            const bucketMinute = date.getMinutes() < 30 ? '00' : '30';
            category = `${String(date.getHours()).padStart(2, '0')}:${bucketMinute}`;
          } else {
            // 1m: exact minute
            category = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          }
          const existing = categoryAccumulator.get(category);
          if (existing) {
            existing.sum += value;
            existing.count += 1;
          } else {
            categoryAccumulator.set(category, { sum: value, count: 1 });
          }
        }
      });

      // Average each bucket
      const categoryMap = new Map<string, number>();
      categoryAccumulator.forEach((acc, key) => {
        categoryMap.set(key, acc.sum / acc.count);
      });

      let intervalMs = 60 * 60 * 1000; // 1h
      if (hourlyInterval === '30m') intervalMs = 30 * 60 * 1000;
      if (hourlyInterval === '1m') intervalMs = 60 * 1000;

      const chartData: ChartDataPoint[] = [];
      const endTime = endDate.getTime();
      let currentTime = startDate.getTime();

      while (currentTime <= endTime) {
        const date = new Date(currentTime);
        let category = '';
        if (hourlyInterval === '1h') {
          category = `${String(date.getHours()).padStart(2, '0')}:00`;
        } else {
          category = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }

        chartData.push({
          category,
          value: categoryMap.has(category) ? categoryMap.get(category)! : null,
          timestamp: currentTime,
        });

        currentTime += intervalMs;
      }

      // Calculate max and min values
      const validValues = chartData.map(d => d.value).filter((v): v is number => v !== null);
      if (validValues.length > 0) {
        setHourlyMax(Math.max(...validValues));
        setHourlyMin(Math.min(...validValues));
      } else {
        setHourlyMax(0);
        setHourlyMin(0);
      }

      setHourlyData(chartData);

    } finally {
      setHourlyLoading(false);
    }
  }, [selectedDevice, selectedParameter, hourlyDate, hourlyInterval]);

  // Fetch daily data
  const fetchDailyData = useCallback(async () => {
    if (!selectedDevice || !selectedParameter || !dailyMonth) return;

    setDailyLoading(true);

    try {
      const [year, month] = dailyMonth.split('-');
      const startDateUtc = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0));
      const endDateUtc = new Date(Date.UTC(parseInt(year), parseInt(month), 0, 23, 59, 59, 999));

      // For 12h: fetch 1h-aggregated data and bucket on frontend — avoids backend/timezone issues
      const fetchInterval = dailyInterval === '12h' ? '1h' : dailyInterval;

      const response = await dataApi.fetchSensorData(selectedDevice, {
        from: startDateUtc.toISOString(),
        to: endDateUtc.toISOString(),
        names: [selectedParameter],
        interval: fetchInterval as import("../api/dataApi").TimeInterval,
        limit: 2000,
      });

      const parameters = response.parameters || (response.data && response.data.parameters) || [];

      if (parameters.length === 0) {
        setDailyData([]);
        setDailyLoading(false);
        return;
      }

      // Get the unit from the first parameter if available
      if (parameters.length > 0) {
        const firstParam = parameters[0];
        if (firstParam.unit) {
          setParameterUnit(firstParam.unit);
        }
      }

      // Build category accumulator (sum + count for averaging)
      const categoryAccumulator = new Map<string, { sum: number; count: number }>();
      parameters.forEach((param: any) => {
        const time_bucket = param.time_bucket || param.created_at || param.timestamp || param.time;
        const date = new Date(time_bucket);
        const value = parseFloat(param.value);
        if (!isNaN(value)) {
          let category = '';
          if (dailyInterval === '1d') {
            category = String(date.getDate()).padStart(2, '0');
          } else if (dailyInterval === '12h') {
            // AM bucket: hours 0–11 → "DD 00:00", PM bucket: hours 12–23 → "DD 12:00"
            const bucketHour = date.getHours() < 12 ? '00' : '12';
            category = `${String(date.getDate()).padStart(2, '0')} ${bucketHour}:00`;
          } else {
            // 1h
            category = `${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          }
          const existing = categoryAccumulator.get(category);
          if (existing) {
            existing.sum += value;
            existing.count += 1;
          } else {
            categoryAccumulator.set(category, { sum: value, count: 1 });
          }
        }
      });

      // Average each bucket
      const categoryMap = new Map<string, number>();
      categoryAccumulator.forEach((acc, key) => {
        categoryMap.set(key, acc.sum / acc.count);
      });

      // Generate skeleton of all expected time slots
      const chartData: ChartDataPoint[] = [];
      const localEndDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59, 999);

      if (dailyInterval === '12h') {
        // Explicitly generate exactly 2 slots per day: midnight (00:00) and noon (12:00)
        const daysInMonth = localEndDate.getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          for (const hour of [0, 12]) {
            const slotDate = new Date(parseInt(year), parseInt(month) - 1, day, hour, 0, 0, 0);
            const dayStr = String(day).padStart(2, '0');
            const hourStr = hour === 0 ? '00' : '12';
            const category = `${dayStr} ${hourStr}:00`;
            chartData.push({
              category,
              value: categoryMap.has(category) ? categoryMap.get(category)! : null,
              timestamp: slotDate.getTime(),
            });
          }
        }
      } else {
        let intervalMs = 24 * 60 * 60 * 1000; // 1d
        if (dailyInterval === '1h') intervalMs = 60 * 60 * 1000;

        const localStartDate = new Date(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0);
        const endTime = localEndDate.getTime();
        let currentTime = localStartDate.getTime();

        while (currentTime <= endTime) {
          const date = new Date(currentTime);
          let category = '';
          if (dailyInterval === '1d') {
            category = String(date.getDate()).padStart(2, '0');
          } else {
            category = `${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
          }
          chartData.push({
            category,
            value: categoryMap.has(category) ? categoryMap.get(category)! : null,
            timestamp: currentTime,
          });
          currentTime += intervalMs;
        }
      }

      // Calculate max and min values
      const validValues = chartData.map(d => d.value).filter((v): v is number => v !== null);
      if (validValues.length > 0) {
        setDailyMax(Math.max(...validValues));
        setDailyMin(Math.min(...validValues));
      } else {
        setDailyMax(0);
        setDailyMin(0);
      }

      setDailyData(chartData);
    } finally {
      setDailyLoading(false);
    }
  }, [selectedDevice, selectedParameter, dailyMonth, dailyInterval]);

  // Fetch monthly data
  const fetchMonthlyData = useCallback(async () => {
    if (!selectedDevice || !selectedParameter || !monthlyYear) return;

    setMonthlyLoading(true);

    try {
      const startDateUtc = new Date(Date.UTC(parseInt(monthlyYear), 0, 1, 0, 0, 0, 0));
      const endDateUtc = new Date(Date.UTC(parseInt(monthlyYear), 11, 31, 23, 59, 59, 999));

      const response = await dataApi.fetchSensorData(selectedDevice, {
        from: startDateUtc.toISOString(),
        to: endDateUtc.toISOString(),
        names: [selectedParameter],
        interval: monthlyInterval as import("../api/dataApi").TimeInterval,
        limit: 2000,
      });

      const parameters = response.parameters || (response.data && response.data.parameters) || [];

      if (parameters.length === 0) {
        setMonthlyData([]);
        setMonthlyLoading(false);
        return;
      }

      // Get the unit from the first parameter if available
      if (parameters.length > 0) {
        const firstParam = parameters[0];
        if (firstParam.unit) {
          setParameterUnit(firstParam.unit);
        }
      }

      // Group by interval category
      const categoryMap = new Map<string, number>();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      parameters.forEach((param: any) => {
        const time_bucket = param.time_bucket || param.created_at || param.timestamp || param.time;
        const date = new Date(time_bucket);
        const value = parseFloat(param.value);
        if (!isNaN(value) && value !== null) {
          let category = '';
          if (monthlyInterval === '1M') {
            category = monthNames[date.getMonth()];
          } else if (monthlyInterval === '1d') {
            category = `${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;
          }
          categoryMap.set(category, value);
        }
      });

      const chartData: ChartDataPoint[] = [];

      if (monthlyInterval === '1M') {
        const localStartDate = new Date(parseInt(monthlyYear), 0, 1, 0, 0, 0, 0);
        for (let month = 0; month < 12; month++) {
          const category = monthNames[month];
          const timestamp = new Date(parseInt(monthlyYear), month, 1, 0, 0, 0, 0).getTime();
          chartData.push({
            category,
            value: categoryMap.has(category) ? categoryMap.get(category)! : null,
            timestamp,
          });
        }
      } else if (monthlyInterval === '1d') {
        // Use local time for generating buckets loop
        const localStartDate = new Date(parseInt(monthlyYear), 0, 1, 0, 0, 0, 0);
        const localEndDate = new Date(parseInt(monthlyYear), 11, 31, 23, 59, 59, 999);
        const endTime = localEndDate.getTime();
        let currentTime = localStartDate.getTime();
        const intervalMs = 24 * 60 * 60 * 1000;

        while (currentTime <= endTime) {
          const date = new Date(currentTime);
          const category = `${monthNames[date.getMonth()]} ${String(date.getDate()).padStart(2, '0')}`;

          chartData.push({
            category,
            value: categoryMap.has(category) ? categoryMap.get(category)! : null,
            timestamp: currentTime,
          });

          currentTime += intervalMs;
        }
      }

      // Calculate max and min values
      const validValues = chartData.map(d => d.value).filter((v): v is number => v !== null);
      if (validValues.length > 0) {
        setMonthlyMax(Math.max(...validValues));
        setMonthlyMin(Math.min(...validValues));
      } else {
        setMonthlyMax(0);
        setMonthlyMin(0);
      }

      setMonthlyData(chartData);
    } finally {
      setMonthlyLoading(false);
    }
  }, [selectedDevice, selectedParameter, monthlyYear, monthlyInterval]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchHourlyData();
  }, [fetchHourlyData]);

  useEffect(() => {
    fetchDailyData();
  }, [fetchDailyData]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  // Create hourly chart
  useEffect(() => {
    if (hourlyData.length === 0) {
      return;
    }

    // Check if DOM element exists
    const chartDiv = document.getElementById("hourly-chart");
    if (!chartDiv) {
      return;
    }

    if (hourlyChartRef.current) {
      hourlyChartRef.current.dispose();
      hourlyChartRef.current = null;
    }

    // Create root
    const root = am5.Root.new("hourly-chart");

    // Set themes
    if (isDark) {
      root.setThemes([am5themes_Dark.new(root), am5themes_Animated.new(root)]);
    } else {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 40,
      })
    );

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 70, // Increased to give labels more space
      minorGridEnabled: false,
    });

    xRenderer.labels.template.setAll({
      rotation: -45,
      centerY: am5.p50,
      centerX: am5.p100,
      fontSize: 12,
      fontWeight: "normal",
    });

    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: getBaseInterval(hourlyInterval) as any,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const dateFormats = xAxis.get("dateFormats")!;
    dateFormats["minute"] = "HH:mm";
    dateFormats["hour"] = "HH:mm";
    dateFormats["day"] = "MMM dd";

    // No need to set data on DateAxis
    // xAxis.data.setAll(hourlyData);

    // Add X axis title
    xAxis.children.push(
      am5.Label.new(root, {
        text: "Hour of Day",
        x: am5.p50,
        centerX: am5.p50,
      })
    );

    // Create Y axis (Value)
    const yRenderer = am5xy.AxisRendererY.new(root, {});

    yRenderer.labels.template.setAll({
      fontSize: 13,
      fontWeight: "normal",
    });

    // Smart padding: works correctly for all value ranges including 0 and negatives
    const barDataRange = hourlyMax - hourlyMin;
    const barPadding = barDataRange > 0 ? barDataRange * 0.1 : (Math.abs(hourlyMax) * 0.1 || 1);
    const barAxisMin = hourlyMin - barPadding;
    const barAxisMax = hourlyMax + barPadding;

    const barIntervalLabel = hourlyInterval === '1h' ? '1 Hour avg'
      : hourlyInterval === '30m' ? '30 Min avg'
        : '1 Min avg';

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: barAxisMin,
        max: barAxisMax,
        renderer: yRenderer,
        numberFormat: "#.##",
      })
    );

    // Add Y axis title
    yAxis.children.unshift(
      am5.Label.new(root, {
        text: `${selectedParameter || 'Value'} (${parameterUnit || 'units'})`,
        rotation: -90,
        y: am5.p50,
        centerX: am5.p50,
        fontWeight: "600",
        fontSize: 12,
      })
    );

    // Create series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: selectedParameter,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        valueXField: "timestamp",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueX.formatDate('HH:mm')}: {valueY} " + (parameterUnit || 'units'),
        }),
      })
    );

    // Set column appearance
    series.columns.template.setAll({
      strokeOpacity: 0,
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      fillOpacity: 0.9,
      width: am5.percent(80),
    });

    // Add gradient color
    series.columns.template.adapters.add("fill", function (fill, target) {
      return chart.get("colors")?.getIndex(series.columns.indexOf(target));
    });

    // Set data
    series.data.setAll(hourlyData);

    // Add cursor
    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "zoomX",
        xAxis: xAxis,
      })
    );
    cursor.lineY.set("visible", false);

    // Add scrollbar
    const scrollbar = chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal"
    }));
    scrollbar.set("height", 10);

    // Make stuff animate on load
    series.appear(1000);
    chart.appear(1000, 100);

    hourlyChartRef.current = root;

    return () => {
      root.dispose();
    };
  }, [hourlyData, isDark, selectedParameter, parameterUnit, hourlyInterval, hourlyMin, hourlyMax]);

  // Create hourly line chart
  useEffect(() => {
    if (hourlyData.length === 0) return;

    const chartDiv = document.getElementById("hourly-line-chart");
    if (!chartDiv) return;

    if (hourlyLineChartRef.current) {
      hourlyLineChartRef.current.dispose();
      hourlyLineChartRef.current = null;
    }

    const root = am5.Root.new("hourly-line-chart");

    if (isDark) {
      root.setThemes([am5themes_Dark.new(root), am5themes_Animated.new(root)]);
    } else {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 40,
      })
    );

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 100,
      minorGridEnabled: false,
      inside: false,
    });

    xRenderer.grid.template.setAll({
      strokeOpacity: 0,
    });

    xRenderer.labels.template.setAll({
      centerY: am5.p100,
      centerX: am5.p100,
      rotation: -45,
      paddingTop: 10,
      paddingBottom: 5,
      fontSize: 10,
      oversizedBehavior: "truncate",
      maxWidth: 150,
    });

    // Use DateAxis instead of CategoryAxis
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: getBaseInterval(hourlyInterval) as any,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    // Explicitly set date formats
    const dateFormats = xAxis.get("dateFormats")!;
    dateFormats["minute"] = "HH:mm";
    dateFormats["hour"] = "HH:mm";
    dateFormats["day"] = "MMM dd";

    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 40,
      minorGridEnabled: true,
      inside: false,
    });

    if ((yRenderer as any).minorGrid) {
      (yRenderer as any).minorGrid.template.setAll({
        strokeOpacity: 0.3,
        strokeDasharray: [2, 2],
      });
    }

    yRenderer.labels.template.setAll({
      fontSize: 11,
    });


    // Smart padding for line chart Y axis
    const lineDataRange = hourlyMax - hourlyMin;
    const linePadding = lineDataRange > 0 ? lineDataRange * 0.1 : (Math.abs(hourlyMax) * 0.1 || 1);
    const lineAxisMin = hourlyMin - linePadding;
    const lineAxisMax = hourlyMax + linePadding;

    const lineIntervalLabel = hourlyInterval === '1h' ? '1 Hour avg'
      : hourlyInterval === '30m' ? '30 Min avg'
        : '1 Min avg';

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: lineAxisMin,
        max: lineAxisMax,
        renderer: yRenderer,
        numberFormat: "#.##",
      })
    );

    yAxis.children.unshift(
      am5.Label.new(root, {
        text: `${selectedParameter || 'Value'} (${parameterUnit || 'units'})`,
        rotation: -90,
        y: am5.p50,
        centerX: am5.p50,
        fontWeight: "600",
        fontSize: 12,
        paddingRight: 10,
      })
    );

    // Create line series with smooth curves
    const series = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: selectedParameter,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        valueXField: "timestamp",
        stroke: am5.color(0x8884d8),
        fill: am5.color(0x8884d8),
        connect: true,
        minBulletDistance: 15,
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueX.formatDate('HH:mm')}: {valueY.formatNumber('#.##')} " + (parameterUnit || ''),
        }),
      })
    );

    // Make the line smooth with tension
    series.strokes.template.setAll({
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    } as any);

    series.fills.template.setAll({
      visible: true,
      fillOpacity: 0.05,
    });

    // Add bullets (data points)
    series.bullets.push(function () {
      const circle = am5.Circle.new(root, {
        radius: 4.5,
        fill: series.get("fill"),
        stroke: root.interfaceColors.get("background"),
        strokeWidth: 2.5,
      });
      return am5.Bullet.new(root, {
        sprite: circle,
      });
    });

    series.data.setAll(hourlyData);

    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "zoomX",
        xAxis: xAxis,
      })
    );
    cursor.lineY.set("visible", false);

    // Style the x-axis bottom tooltip to match the bar chart (black box with date)
    const axisTooltip = xAxis.get("tooltip");
    if (axisTooltip) {
      axisTooltip.get("background")?.setAll({
        fill: am5.color(0x000000),
        fillOpacity: 0.85,
        strokeOpacity: 0,
        cornerRadius: 8,
      } as any);
      axisTooltip.label.setAll({
        fill: am5.color(0xffffff),
        fontSize: 13,
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 10,
        paddingRight: 10,
      });
    }

    // Add scrollbar
    const scrollbar = chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal",
    }));
    scrollbar.set("height", 10);

    series.appear(1000);
    chart.appear(1000, 100);

    hourlyLineChartRef.current = root;

    return () => {
      root.dispose();
    };
  }, [hourlyData, isDark, selectedParameter, parameterUnit, hourlyInterval, hourlyMin, hourlyMax]);

  // Create daily chart
  useEffect(() => {
    if (dailyData.length === 0) {
      return;
    }

    // Check if DOM element exists
    const chartDiv = document.getElementById("daily-chart");
    if (!chartDiv) {
      return;
    }

    if (dailyChartRef.current) {
      dailyChartRef.current.dispose();
      dailyChartRef.current = null;
    }

    // Create root
    const root = am5.Root.new("daily-chart");

    // Set themes
    if (isDark) {
      root.setThemes([am5themes_Dark.new(root), am5themes_Animated.new(root)]);
    } else {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 0,
      })
    );

    // Create X axis (Category - Days)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 70, // Increased to prevent overlap
      minorGridEnabled: false,
    });

    xRenderer.labels.template.setAll({
      rotation: -45, // Angle them to prevent horizontal overlap
      centerY: am5.p100,
      centerX: am5.p100,
      paddingTop: 10,
      paddingBottom: 5,
      fontSize: 11,
      fontWeight: "normal",
      oversizedBehavior: "truncate",
      maxWidth: 150,
    });

    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: getBaseInterval(dailyInterval) as any,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const dateFormats = xAxis.get("dateFormats")!;
    dateFormats["hour"] = "HH:mm";
    dateFormats["day"] = "MMM dd";
    dateFormats["month"] = "MMM yyyy";

    // xAxis.data.setAll(dailyData);

    // Add X axis title
    xAxis.children.push(
      am5.Label.new(root, {
        text: "Day of Month",
        x: am5.p50,
        centerX: am5.p50,
      })
    );

    // Create Y axis (Value)
    const yRenderer = am5xy.AxisRendererY.new(root, {});

    yRenderer.labels.template.setAll({
      fontSize: 13,
      fontWeight: "normal",
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: dailyMin * 0.9,
        max: dailyMax * 1.1,
        renderer: yRenderer,
        numberFormat: "#.##",
      })
    );

    // Add Y axis title
    yAxis.children.unshift(
      am5.Label.new(root, {
        text: `${selectedParameter || 'Value'} (${parameterUnit || 'units'})`,
        rotation: -90,
        y: am5.p50,
        centerX: am5.p50,
        fontWeight: "600",
        fontSize: 12,
      })
    );

    // Create series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: selectedParameter,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        valueXField: "timestamp",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueX.formatDate('MMM dd HH:mm')}: {valueY} " + (parameterUnit || 'units'),
        }),
      })
    );

    // Set column appearance
    series.columns.template.setAll({
      strokeOpacity: 0,
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      fillOpacity: 0.9,
      width: am5.percent(70),
    });

    // Add gradient color
    series.columns.template.adapters.add("fill", function (fill, target) {
      return chart.get("colors")?.getIndex(series.columns.indexOf(target));
    });

    // Set data
    series.data.setAll(dailyData);

    // Add cursor
    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "zoomX",
        xAxis: xAxis,
      })
    );
    cursor.lineY.set("visible", false);

    const scrollbar = chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal"
    }));
    scrollbar.set("height", 10);

    // Make stuff animate on load
    series.appear(1000);
    chart.appear(1000, 100);

    dailyChartRef.current = root;

    return () => {
      root.dispose();
    };
  }, [dailyData, isDark, selectedParameter, parameterUnit, dailyInterval, dailyMin, dailyMax]);

  // Create daily line chart
  useEffect(() => {
    if (dailyData.length === 0) return;

    const chartDiv = document.getElementById("daily-line-chart");
    if (!chartDiv) return;

    if (dailyLineChartRef.current) {
      dailyLineChartRef.current.dispose();
      dailyLineChartRef.current = null;
    }

    const root = am5.Root.new("daily-line-chart");

    if (isDark) {
      root.setThemes([am5themes_Dark.new(root), am5themes_Animated.new(root)]);
    } else {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 40,
      })
    );

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 100,
      minorGridEnabled: false,
      inside: false,
    });

    xRenderer.grid.template.setAll({
      strokeOpacity: 0,
    });

    xRenderer.labels.template.setAll({
      centerY: am5.p100,
      centerX: am5.p100,
      rotation: -45,
      paddingTop: 10,
      paddingBottom: 5,
      fontSize: 10,
      oversizedBehavior: "truncate",
      maxWidth: 150,
    });

    // Use DateAxis instead of CategoryAxis
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: getBaseInterval(dailyInterval) as any,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    // Explicitly set date formats
    const dateFormats = xAxis.get("dateFormats")!;
    dateFormats["hour"] = "MMM dd HH:mm";
    dateFormats["day"] = "MMM dd";
    dateFormats["month"] = "MMM yyyy";

    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 40,
      minorGridEnabled: true,
      inside: false,
    });

    if ((yRenderer as any).minorGrid) {
      (yRenderer as any).minorGrid.template.setAll({
        strokeOpacity: 0.3,
        strokeDasharray: [2, 2],
      });
    }

    yRenderer.labels.template.setAll({
      fontSize: 11,
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: dailyMin * 0.9,
        max: dailyMax * 1.1,
        renderer: yRenderer,
        numberFormat: "#.##",
      })
    );

    yAxis.children.unshift(
      am5.Label.new(root, {
        text: `${selectedParameter || 'Value'} (${parameterUnit || 'units'})`,
        rotation: -90,
        y: am5.p50,
        centerX: am5.p50,
        fontWeight: "600",
        fontSize: 12,
        paddingRight: 10,
      })
    );

    // Create line series with smooth curves
    const series = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: selectedParameter,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        valueXField: "timestamp",
        stroke: am5.color(0x8884d8),
        fill: am5.color(0x8884d8),
        connect: true,
        minBulletDistance: 15,
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueX.formatDate('MMM dd HH:mm')}: {valueY.formatNumber('#.##')} " + (parameterUnit || ''),
        }),
      })
    );

    series.strokes.template.setAll({
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    } as any);

    series.fills.template.setAll({
      visible: true,
      fillOpacity: 0.05,
    });

    // Add bullets (data points) - automatically hidden when dense
    series.bullets.push(function () {
      const circle = am5.Circle.new(root, {
        radius: 4.5,
        fill: series.get("fill"),
        stroke: root.interfaceColors.get("background"),
        strokeWidth: 2.5,
      });
      return am5.Bullet.new(root, {
        sprite: circle,
      });
    });

    series.data.setAll(dailyData);

    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "zoomX",
        xAxis: xAxis,
      })
    );
    cursor.lineY.set("visible", false);

    // Style the x-axis bottom tooltip to match the bar chart (black box with date)
    const axisTooltip = xAxis.get("tooltip");
    if (axisTooltip) {
      axisTooltip.get("background")?.setAll({
        fill: am5.color(0x000000),
        fillOpacity: 0.85,
        strokeOpacity: 0,
        cornerRadius: 8,
      } as any);
      axisTooltip.label.setAll({
        fill: am5.color(0xffffff),
        fontSize: 13,
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 10,
        paddingRight: 10,
      });
    }

    // Add scrollbar
    const scrollbar = chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal",
    }));
    scrollbar.set("height", 10);

    series.appear(1000);
    chart.appear(1000, 100);

    dailyLineChartRef.current = root;

    return () => {
      root.dispose();
    };
  }, [dailyData, isDark, selectedParameter, parameterUnit, dailyInterval]);

  // Create monthly chart
  useEffect(() => {
    if (monthlyData.length === 0) {
      return;
    }

    const chartDiv = document.getElementById("monthly-chart");
    if (!chartDiv) {
      return;
    }

    if (monthlyChartRef.current) {
      monthlyChartRef.current.dispose();
      monthlyChartRef.current = null;
    }

    // Create root
    const root = am5.Root.new("monthly-chart");

    // Set themes
    if (isDark) {
      root.setThemes([am5themes_Dark.new(root), am5themes_Animated.new(root)]);
    } else {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 0,
      })
    );

    // Create X axis (Category - Months)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 70, // Increased for label space
      minorGridEnabled: false,
      inside: false,
    });

    xRenderer.labels.template.setAll({
      centerY: am5.p100,
      centerX: am5.p100,
      rotation: -45,
      paddingTop: 10,
      paddingBottom: 5,
      fontSize: 10,
      oversizedBehavior: "truncate",
      maxWidth: 150,
    });



    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: getBaseInterval(monthlyInterval) as any,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const dateFormats = xAxis.get("dateFormats")!;
    dateFormats["day"] = "MMM dd";
    dateFormats["month"] = "MMM yyyy";

    // xAxis.data.setAll(monthlyData);

    // Add X axis title
    xAxis.children.push(
      am5.Label.new(root, {
        text: "Month",
        x: am5.p50,
        centerX: am5.p50,
      })
    );

    // Create Y axis (Value)
    const yRenderer = am5xy.AxisRendererY.new(root, {});

    yRenderer.labels.template.setAll({
      fontSize: 13,
      fontWeight: "normal",
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: monthlyMin * 0.9,
        max: monthlyMax * 1.1,
        renderer: yRenderer,
        numberFormat: "#.##",
      })
    );

    // Add Y axis title
    yAxis.children.unshift(
      am5.Label.new(root, {
        text: `${selectedParameter || 'Value'} (${parameterUnit || 'units'})`,
        rotation: -90,
        y: am5.p50,
        centerX: am5.p50,
        fontWeight: "600",
        fontSize: 12,
      })
    );

    // Create series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: selectedParameter,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        valueXField: "timestamp",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueX.formatDate('MMM dd')}: {valueY} " + (parameterUnit || 'units'),
        }),
      })
    );

    // Set column appearance
    series.columns.template.setAll({
      strokeOpacity: 0,
      cornerRadiusTL: 5,
      cornerRadiusTR: 5,
      fillOpacity: 0.9,
      width: am5.percent(70),
    });

    // Add gradient color
    series.columns.template.adapters.add("fill", function (fill, target) {
      return chart.get("colors")?.getIndex(series.columns.indexOf(target));
    });

    // Set data
    series.data.setAll(monthlyData);

    // Add cursor
    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "zoomX",
        xAxis: xAxis,
      })
    );
    cursor.lineY.set("visible", false);

    const scrollbar = chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal"
    }));
    scrollbar.set("height", 10);

    // Make stuff animate on load
    series.appear(1000);
    chart.appear(1000, 100);

    monthlyChartRef.current = root;

    return () => {
      root.dispose();
    };
  }, [monthlyData, isDark, selectedParameter, parameterUnit, monthlyInterval, monthlyMin, monthlyMax]);

  // Create monthly line chart
  useEffect(() => {
    if (monthlyData.length === 0) return;

    const chartDiv = document.getElementById("monthly-line-chart");
    if (!chartDiv) return;

    if (monthlyLineChartRef.current) {
      monthlyLineChartRef.current.dispose();
      monthlyLineChartRef.current = null;
    }

    const root = am5.Root.new("monthly-line-chart");

    if (isDark) {
      root.setThemes([am5themes_Dark.new(root), am5themes_Animated.new(root)]);
    } else {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "zoomX",
        pinchZoomX: true,
        paddingLeft: 0,
        paddingRight: 20,
        paddingBottom: 40,
      })
    );

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 100,
      minorGridEnabled: false,
      inside: false,
    });

    xRenderer.grid.template.setAll({
      strokeOpacity: 0,
    });

    xRenderer.labels.template.setAll({
      centerY: am5.p100,
      centerX: am5.p100,
      rotation: -45,
      paddingTop: 10,
      paddingBottom: 5,
      fontSize: 10,
      oversizedBehavior: "truncate",
      maxWidth: 150,
    });

    // Use DateAxis instead of CategoryAxis
    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: getBaseInterval(monthlyInterval) as any,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    // Explicitly set date formats
    const dateFormats = xAxis.get("dateFormats")!;
    dateFormats["day"] = "MMM dd";
    dateFormats["month"] = "MMM yyyy";

    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 40,
      minorGridEnabled: true,
      inside: false,
    });

    if ((yRenderer as any).minorGrid) {
      (yRenderer as any).minorGrid.template.setAll({
        strokeOpacity: 0.3,
        strokeDasharray: [2, 2],
      });
    }

    yRenderer.labels.template.setAll({
      fontSize: 11,
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: monthlyMin * 0.9,
        max: monthlyMax * 1.1,
        renderer: yRenderer,
        numberFormat: "#.##",
      })
    );

    yAxis.children.unshift(
      am5.Label.new(root, {
        text: `${selectedParameter || 'Value'} (${parameterUnit || 'units'})`,
        rotation: -90,
        y: am5.p50,
        centerX: am5.p50,
        fontWeight: "600",
        fontSize: 12,
        paddingRight: 10,
      })
    );

    // Create line series with smooth curves
    const series = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: selectedParameter,
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "value",
        valueXField: "timestamp",
        stroke: am5.color(0x8884d8),
        fill: am5.color(0x8884d8),
        connect: true,
        minBulletDistance: 15,
      })
    );

    series.strokes.template.setAll({
      strokeWidth: 2.5,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    } as any);

    series.fills.template.setAll({
      visible: true,
      fillOpacity: 0.05,
    });

    // Add bullets (data points) - automatically hidden when dense
    series.bullets.push(function () {
      const circle = am5.Circle.new(root, {
        radius: 4.5,
        fill: series.get("fill"),
        stroke: root.interfaceColors.get("background"),
        strokeWidth: 2.5,
      });
      return am5.Bullet.new(root, {
        sprite: circle,
      });
    });

    series.data.setAll(monthlyData);

    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "zoomX",
        xAxis: xAxis,
      })
    );
    cursor.lineY.set("visible", false);

    // Add scrollbar
    const scrollbar = chart.set("scrollbarX", am5.Scrollbar.new(root, {
      orientation: "horizontal",
    }));
    scrollbar.set("height", 10);

    series.appear(1000);
    chart.appear(1000, 100);

    monthlyLineChartRef.current = root;

    return () => {
      root.dispose();
    };
  }, [monthlyData, isDark, selectedParameter, parameterUnit, monthlyInterval]);

  // Sync horizontal scrolling between Line and Bar charts
  useEffect(() => {
    const disposers: am5.IDisposer[] = [];

    const syncAxes = (chart1Ref: React.RefObject<am5.Root>, chart2Ref: React.RefObject<am5.Root>) => {
      if (!chart1Ref.current || !chart2Ref.current) return;
      try {
        const c1 = chart1Ref.current.container.children.getIndex(0) as am5xy.XYChart;
        const x1 = c1?.xAxes.getIndex(0);
        const c2 = chart2Ref.current.container.children.getIndex(0) as am5xy.XYChart;
        const x2 = c2?.xAxes.getIndex(0);

        if (!x1 || !x2) return;

        let isSyncing = false;

        disposers.push(x1.on("start", (start) => {
          if (!isSyncing && x2.get("start") !== start) {
            isSyncing = true;
            x2.set("start", start);
            isSyncing = false;
          }
        }));

        disposers.push(x1.on("end", (end) => {
          if (!isSyncing && x2.get("end") !== end) {
            isSyncing = true;
            x2.set("end", end);
            isSyncing = false;
          }
        }));

        disposers.push(x2.on("start", (start) => {
          if (!isSyncing && x1.get("start") !== start) {
            isSyncing = true;
            x1.set("start", start);
            isSyncing = false;
          }
        }));

        disposers.push(x2.on("end", (end) => {
          if (!isSyncing && x1.get("end") !== end) {
            isSyncing = true;
            x1.set("end", end);
            isSyncing = false;
          }
        }));
      } catch (e) {
        console.warn("Could not sync charts", e);
      }
    };

    // Need a tiny timeout to ensure roots are fully initialized and axes are attached
    const timeout = setTimeout(() => {
      syncAxes(hourlyChartRef, hourlyLineChartRef);
      syncAxes(dailyChartRef, dailyLineChartRef);
      syncAxes(monthlyChartRef, monthlyLineChartRef);
    }, 100);

    return () => {
      clearTimeout(timeout);
      disposers.forEach(d => d.dispose());
    };
  }, [hourlyData, dailyData, monthlyData, isDark, selectedParameter, parameterUnit]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      {/* Header */}
      <div className="bg-card rounded-lg shadow p-4 sm:p-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          Recorded Graph - Historical Sensor Data
        </h1>

        {/* Dropdowns Row */}
        <div className="flex flex-wrap gap-4">
          {/* Select Sensor Dropdown */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Select Sensor
            </label>
            <div className="relative" ref={deviceDropdownRef}>
              <button
                ref={deviceButtonRef}
                type="button"
                onClick={() => {
                  setIsDeviceDropdownOpen(!isDeviceDropdownOpen);
                  setDeviceSearchQuery("");
                }}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg flex items-center justify-between hover:bg-accent transition"
              >
                <span className="truncate">
                  {selectedDevice || "Select a sensor"}
                </span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
              </button>

              {isDeviceDropdownOpen &&
                createPortal(
                  <div
                    data-device-dropdown-portal
                    className="absolute z-[9999] bg-card border border-input rounded-lg shadow-lg overflow-hidden"
                    style={{
                      top: `${deviceDropdownPosition.top}px`,
                      left: `${deviceDropdownPosition.left}px`,
                      width: `${deviceDropdownPosition.width}px`,
                    }}
                  >
                    {/* Search Input */}
                    <div className="p-2 border-b border-input bg-background">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search sensor..."
                          value={deviceSearchQuery}
                          onChange={(e) => setDeviceSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-9 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          autoFocus
                        />
                        {deviceSearchQuery && (
                          <button
                            onClick={() => setDeviceSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dropdown List */}
                    <div
                      className="max-h-60 overflow-y-auto"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: `${scrollbarThumb} ${scrollbarTrack}`,
                      }}
                    >
                      {filteredDevices.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                          No sensors found
                        </div>
                      ) : (
                        filteredDevices.map((device) => (
                          <button
                            key={device.id}
                            onClick={() => {
                              setSelectedDevice(device.name);
                              setIsDeviceDropdownOpen(false);
                              setDeviceSearchQuery("");
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-accent transition text-sm ${selectedDevice === device.name
                              ? "bg-accent font-medium"
                              : ""
                              }`}
                          >
                            {device.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          </div>

          {/* Select Parameter Dropdown */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Select Parameter
            </label>
            <div className="relative" ref={paramDropdownRef}>
              <button
                ref={paramButtonRef}
                type="button"
                onClick={() => {
                  setIsParamDropdownOpen(!isParamDropdownOpen);
                  setParamSearchQuery("");
                }}
                className="w-full px-4 py-2 bg-background border border-input rounded-lg flex items-center justify-between hover:bg-accent transition"
                disabled={!selectedDevice || availableParams.length === 0}
              >
                <span className="truncate">
                  {selectedParameter || "Select a parameter"}
                </span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2" />
              </button>

              {isParamDropdownOpen &&
                createPortal(
                  <div
                    data-param-dropdown-portal
                    className="absolute z-[9999] bg-card border border-input rounded-lg shadow-lg overflow-hidden"
                    style={{
                      top: `${paramDropdownPosition.top}px`,
                      left: `${paramDropdownPosition.left}px`,
                      width: `${paramDropdownPosition.width}px`,
                    }}
                  >
                    {/* Search Input */}
                    <div className="p-2 border-b border-input bg-background">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search parameter..."
                          value={paramSearchQuery}
                          onChange={(e) => setParamSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-9 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          autoFocus
                        />
                        {paramSearchQuery && (
                          <button
                            onClick={() => setParamSearchQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded"
                          >
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Dropdown List */}
                    <div
                      className="max-h-60 overflow-y-auto"
                      style={{
                        scrollbarWidth: "thin",
                        scrollbarColor: `${scrollbarThumb} ${scrollbarTrack}`,
                      }}
                    >
                      {filteredParams.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground text-center">
                          No parameters found
                        </div>
                      ) : (
                        filteredParams.map((param) => (
                          <button
                            key={param}
                            onClick={() => {
                              setSelectedParameter(param);
                              setIsParamDropdownOpen(false);
                              setParamSearchQuery("");
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-accent transition text-sm ${selectedParameter === param
                              ? "bg-accent font-medium"
                              : ""
                              }`}
                          >
                            {param}
                          </button>
                        ))
                      )}
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          </div>

          {/* Download Button */}
          {/* <div className="flex items-end">
            <RecordedDataDownload
              selectedDevice={selectedDevice}
              selectedParameter={selectedParameter}
              parameterUnit={parameterUnit}
              hourlyData={hourlyData}
              dailyData={dailyData}
              monthlyData={monthlyData}
              hourlyDate={hourlyDate}
              dailyMonth={dailyMonth}
              monthlyYear={monthlyYear}
            />
          </div> */}
        </div>
      </div>

      {/* Hourly Data Section */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6 mt-8">
        {/* Chart Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-muted/30">
          {/* Left: Title & Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#8884d8" }}></span>
              {selectedParameter || "Parameter"} Hourly Data
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground">Unit:</span> <span className="font-medium">{parameterUnit || "N/A"}</span>
              {" | "}<span className="font-semibold text-foreground">Range:</span> <span className="font-medium">{hourlyMin.toFixed(2)} - {hourlyMax.toFixed(2)}</span>
              {" | "}<span className="font-semibold text-foreground">Data Points:</span> <span className="font-medium">{hourlyData.length}</span>
            </p>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {hourlyLoading && (
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            )}

            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Date:</label>
              <input
                type="date"
                value={hourlyDate}
                onChange={(e) => setHourlyDate(e.target.value)}
                className="h-9 px-3 text-sm font-medium bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              />
            </div>

            {/* Interval Selector */}
            <div className="flex items-center gap-2 ml-2">
              <label className="text-sm font-medium text-muted-foreground">X-axis interval:</label>
              <div className="relative">
                <select
                  value={hourlyInterval}
                  onChange={(e) => setHourlyInterval(e.target.value)}
                  className="appearance-none h-9 pl-3 pr-8 text-sm font-medium bg-background border border-border rounded-lg hover:bg-accent cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary min-w-[110px]"
                >
                  <option value="1h">1 Hour</option>
                  <option value="30m">30 Minutes</option>
                  <option value="1m">1 Minute</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="p-4 relative">
          {hourlyData.length === 0 && !hourlyLoading ? (
            <div className="flex items-center justify-center h-[350px] bg-muted/20 rounded-lg border border-dashed border-border">
              <div className="text-center">
                <p className="text-muted-foreground font-medium">No data available for the selected date</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting the date range or time scale</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Line Chart */}
              <div>
                <div id="hourly-line-chart" style={{ width: "100%", height: "350px" }}></div>
              </div>

              {/* Separator between Line and Bar Chart */}
              <div className="border-t border-border/50 my-6"></div>

              {/* Bar Chart */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">Bar Chart Representation</h3>
                <div id="hourly-chart" style={{ width: "100%", height: "350px" }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-4 pb-3 text-xs text-muted-foreground text-center border-t border-border pt-3">
          Total Records: <span className="font-medium">{hourlyData.length}</span>
          {" • "}
          Data Points: <span className="font-medium">{hourlyData.length}</span>
          {" • "}
          Scale: <span className="font-medium">Recorded Data ({hourlyInterval})</span>
        </div>
      </div>

      {/* Daily Data Section */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6 mt-8">
        {/* Chart Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-muted/30">
          {/* Left: Title & Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#8884d8" }}></span>
              {selectedParameter || "Parameter"} Daily Data
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground">Unit:</span> <span className="font-medium">{parameterUnit || "N/A"}</span>
              {" | "}<span className="font-semibold text-foreground">Range:</span> <span className="font-medium">{dailyMin.toFixed(2)} - {dailyMax.toFixed(2)}</span>
              {" | "}<span className="font-semibold text-foreground">Data Points:</span> <span className="font-medium">{dailyData.length}</span>
            </p>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {dailyLoading && (
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            )}

            {/* Date Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Month:</label>
              <input
                type="month"
                value={dailyMonth}
                onChange={(e) => setDailyMonth(e.target.value)}
                className="h-9 px-3 text-sm font-medium bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-w-[140px]"
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              />
            </div>

            {/* Interval Selector */}
            <div className="flex items-center gap-2 ml-2">
              <label className="text-sm font-medium text-muted-foreground">X-axis interval:</label>
              <div className="relative">
                <select
                  value={dailyInterval}
                  onChange={(e) => setDailyInterval(e.target.value)}
                  className="appearance-none h-9 pl-3 pr-8 text-sm font-medium bg-background border border-border rounded-lg hover:bg-accent cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary min-w-[110px]"
                >
                  <option value="1d">1 Day</option>
                  <option value="12h">12 Hours</option>
                  <option value="1h">1 Hour</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="p-4 relative">
          {dailyData.length === 0 && !dailyLoading ? (
            <div className="flex items-center justify-center h-[350px] bg-muted/20 rounded-lg border border-dashed border-border">
              <div className="text-center">
                <p className="text-muted-foreground font-medium">No data available for the selected month</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting the date range or time scale</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Line Chart */}
              <div>
                <div id="daily-line-chart" style={{ width: "100%", height: "350px" }}></div>
              </div>

              {/* Separator between Line and Bar Chart */}
              <div className="border-t border-border/50 my-6"></div>

              {/* Bar Chart */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">Bar Chart Representation</h3>
                <div id="daily-chart" style={{ width: "100%", height: "350px" }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-4 pb-3 text-xs text-muted-foreground text-center border-t border-border pt-3">
          Total Records: <span className="font-medium">{dailyData.length}</span>
          {" • "}
          Data Points: <span className="font-medium">{dailyData.length}</span>
          {" • "}
          Scale: <span className="font-medium">Recorded Data ({dailyInterval})</span>
        </div>
      </div>

      {/* Monthly Data Section */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6 mt-8">
        {/* Chart Header with Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-muted/30">
          {/* Left: Title & Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#8884d8" }}></span>
              {selectedParameter || "Parameter"} Monthly Data
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="font-semibold text-foreground">Unit:</span> <span className="font-medium">{parameterUnit || "N/A"}</span>
              {" | "}<span className="font-semibold text-foreground">Data Points:</span> <span className="font-medium">{monthlyData.length}</span>
            </p>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {monthlyLoading && (
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            )}

            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground">Year:</label>
              <input
                type="number"
                value={monthlyYear}
                onChange={(e) => setMonthlyYear(e.target.value)}
                min="2020"
                max="2030"
                className="h-9 px-3 text-sm font-medium bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary min-w-[100px]"
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
              />
            </div>
          </div>
        </div>

        {/* Chart Container */}
        <div className="p-4 relative">
          {monthlyData.length === 0 && !monthlyLoading ? (
            <div className="flex items-center justify-center h-[350px] bg-muted/20 rounded-lg border border-dashed border-border">
              <div className="text-center">
                <p className="text-muted-foreground font-medium">No data available for the selected year</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting the year or loading a different time scale</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Line Chart */}
              <div>
                <div id="monthly-line-chart" style={{ width: "100%", height: "350px" }}></div>
              </div>

              {/* Separator between Line and Bar Chart */}
              <div className="border-t border-border/50 my-6"></div>

              {/* Bar Chart */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-2">Bar Chart Representation</h3>
                <div id="monthly-chart" style={{ width: "100%", height: "350px" }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-4 pb-3 text-xs text-muted-foreground text-center border-t border-border pt-3">
          Total Records: <span className="font-medium">{monthlyData.length}</span>
          {" • "}
          Data Points: <span className="font-medium">{monthlyData.length}</span>
          {" • "}
          Scale: <span className="font-medium">Recorded Data (Monthly)</span>
        </div>
      </div>
    </div>
  );
}
