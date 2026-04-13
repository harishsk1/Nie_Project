import React, { useEffect, useState, useRef, useMemo, useLayoutEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { deviceApi } from "../api/deviceApi";
import { dataApi, TimeInterval } from "../api/dataApi";
import { aggregateDataIntoBuckets, CHART_COLORS, ChartDataPoint } from "../utils/chartUtils";
import SensorDropdown from "../components/SensorDropdown";
import TimeDateFilter from "../components/TimeDateFilter";

// amCharts imports
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import am5themes_Dark from "@amcharts/amcharts5/themes/Dark";



const RECORDS_PER_PAGE = 50;
const LIVE_RECORDS_PER_PARAM = 50;

// Re-export COLORS for IndividualChart to keep backward-compat
const COLORS = CHART_COLORS;


interface ParameterChartData {
  name: string;
  unit: string;
  data: ChartDataPoint[];
  min: number;
  max: number;
  pagination: {
    page: number;
    totalPages: number;
    totalRecords: number;
  };
  interval: TimeInterval;
  loading: boolean;
}

export default function LiveGraphPage() {
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === "dark";

  const isLiveMode = true;
  const isLive = true;

  // Theme-aware colors
  const scrollbarTrack = isDark ? "#1f2937" : "#f1f5f9";
  const scrollbarThumb = isDark ? "#4b5563" : "#94a3b8";
  const scrollbarThumbHover = isDark ? "#6b7280" : "#64748b";

  // State
  const [devices, setDevices] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [initialLoading, setInitialLoading] = useState(false);
  const [parameterCharts, setParameterCharts] = useState<ParameterChartData[]>([]);
  const [availableParams, setAvailableParams] = useState<string[]>([]);

  // Live mode polling
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-parameter aggregation intervals for live mode
  const [parameterIntervals, setParameterIntervals] = useState<Record<string, { value: number; unit: 'seconds' | 'minutes' | 'hours' }>>({});

  // Dropdown states
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [seasonSearchQuery, setSeasonSearchQuery] = useState("");

  // Refs
  const seasonDropdownRef = useRef<HTMLDivElement>(null);
  const seasonButtonRef = useRef<HTMLButtonElement>(null);
  const [seasonDropdownPosition, setSeasonDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Filter devices based on search query
  const filteredDevices = useMemo(() => {
    if (!seasonSearchQuery.trim()) return devices;
    const query = seasonSearchQuery.toLowerCase();
    return devices.filter((device) =>
      device.name.toLowerCase().includes(query)
    );
  }, [devices, seasonSearchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isSeasonDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const seasonPortal = document.querySelector('[data-season-dropdown-portal]');

      if (seasonDropdownRef.current &&
        !seasonDropdownRef.current.contains(target) &&
        (!seasonPortal || !seasonPortal.contains(target))) {
        setIsSeasonDropdownOpen(false);
        setSeasonSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isSeasonDropdownOpen]);

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

  // Helper function to get last 1 hour date range
  const getLastHourRange = () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    return {
      from: oneHourAgo.toISOString(),
      to: now.toISOString(),
    };
  };

  // Ensure live mode always applies a 1-hour window and keeps state in sync
  const ensureLiveWindow = useCallback(() => {
    const { from: liveFrom, to: liveTo } = getLastHourRange();
    if (!fromDate || !toDate) {
      setFromDate(liveFrom);
      setToDate(liveTo);
    }
    return { from: fromDate || liveFrom, to: toDate || liveTo };
  }, [fromDate, toDate]);

  // When entering live graph route, always reset the window (kept for consistency even though live ignores from/to filters)
  useEffect(() => {
    if (!isLiveMode) return;
    const { from: from1h, to: to1h } = getLastHourRange();
    setFromDate(from1h);
    setToDate(to1h);
  }, [isLiveMode]);

  // Auto-set to last 1 hour when device changes in Live mode
  useEffect(() => {
    if (isLiveMode && selectedDevice) {
      const { from: from1h, to: to1h } = getLastHourRange();
      setFromDate(from1h);
      setToDate(to1h);
    } else if (!isLiveMode && selectedDevice) {
      // Reset date filters when switching to Recorded mode
      setFromDate("");
      setToDate("");
    }
  }, [selectedDevice, isLiveMode]);

  // Fetch data for a single parameter
  const fetchSingleParameterData = useCallback(async (
    paramName: string,
    interval: TimeInterval | undefined,
    page: number = 1,
    useRawData: boolean = false,
    timeRangeSeconds?: number // For live mode: time range in seconds
  ): Promise<Partial<ParameterChartData> | null> => {
    if (!selectedDevice) return null;

    try {
      const queryParams: any = {
        page,
        limit: useRawData ? 1000 : RECORDS_PER_PAGE, // Get more records for raw data
        names: [paramName],
      };

      // For live mode with time range - always fetch raw data, aggregate on client side
      if (timeRangeSeconds !== undefined) {
        // In live mode, fetch latest 50 records per parameter by default (ignore date filters)
        queryParams.limit = LIVE_RECORDS_PER_PARAM;
        // Don't add date filters - fetch most recent records
      } else if (useRawData) {
        // In live mode, fetch latest records without date filters
        if (isLiveMode) {
          queryParams.limit = LIVE_RECORDS_PER_PARAM;
          // Don't add date filters - fetch most recent records
        } else {
          // Legacy: fetch last 60 minutes for raw data
          const now = new Date();
          const minutesBack = 60;
          queryParams.from = new Date(now.getTime() - minutesBack * 60 * 1000).toISOString();
          queryParams.to = now.toISOString();
        }
      } else {
        // Only add interval if not using raw data and interval is provided
        if (interval) {
          queryParams.interval = interval;
        }
        // For non-live mode, use date filters if provided
        if (isLiveMode) {
          // In live mode, fetch latest 50 records per parameter
          queryParams.limit = LIVE_RECORDS_PER_PARAM;
          // Don't add date filters - fetch most recent records
        } else {
          if (fromDate) queryParams.from = fromDate;
          if (toDate) queryParams.to = toDate;
        }
      }

      const response = await dataApi.fetchSensorData(selectedDevice, queryParams);

      const { parameters, pagination } = response;

      if (!parameters || parameters.length === 0) {
        return {
          data: [],
          pagination: {
            page: pagination?.page || 1,
            totalPages: pagination?.totalPages || 1,
            totalRecords: pagination?.totalRecords || 0,
          },
        };
      }

      // Process data - get raw data points
      let chartData: ChartDataPoint[] = parameters
        .map((item: any) => {
          const timestamp = item.created_at || item.createdAt || item.time_bucket;
          const timestampValue = new Date(timestamp).getTime();
          const value = parseFloat(item.value);

          if (isNaN(timestampValue) || isNaN(value)) return null;

          return {
            date: timestampValue,
            value: value,
          };
        })
        .filter(Boolean) as ChartDataPoint[];

      // Sort by date ascending (oldest to newest)
      chartData.sort((a, b) => a.date - b.date);

      // Remove duplicate timestamps (keep the last one if duplicates exist)
      const seen = new Map<number, ChartDataPoint>();
      chartData.forEach(point => {
        seen.set(point.date, point);
      });
      chartData = Array.from(seen.values()).sort((a, b) => a.date - b.date);

      // For live mode, aggregate into buckets based on the selected viewing interval
      if (timeRangeSeconds !== undefined) {
        // Aggregate raw data into buckets of the selected interval size
        // This groups data points that fall within each time bucket (15s, 30s, 1min, etc.)
        if (chartData.length > 0) {
          chartData = aggregateDataIntoBuckets(chartData, timeRangeSeconds);

          // Filter to show a reasonable number of recent buckets
          // Show approximately 60-100 buckets max for readability
          const maxBuckets = 100;
          const now = Date.now();
          const displayWindow = Math.min(maxBuckets * timeRangeSeconds * 1000, 60 * 60 * 1000); // Max 60 minutes or 100 buckets
          const displayStart = now - displayWindow;

          // Filter to only show buckets within the display window
          chartData = chartData.filter(point => point.date >= displayStart);

          // Also limit to maxBuckets from the most recent
          if (chartData.length > maxBuckets) {
            chartData = chartData.slice(-maxBuckets);
          }
        }
      }

      const values = chartData.map(d => d.value);
      // Use reduce instead of spread to avoid RangeError on large arrays
      const min = values.length > 0 ? values.reduce((a, b) => (a < b ? a : b), values[0]) : 0;
      const max = values.length > 0 ? values.reduce((a, b) => (a > b ? a : b), values[0]) : 100;

      return {
        unit: parameters[0]?.unit || "",
        data: chartData,
        min,
        max,
        pagination: {
          page: pagination?.page || 1,
          totalPages: pagination?.totalPages || 1,
          totalRecords: pagination?.totalRecords || 0,
        },
      };
    } catch (err) {
      console.error(`Error fetching data for ${paramName}:`, err);
      return null;
    }
  }, [selectedDevice, fromDate, toDate, isLiveMode]);

  // Discover available parameters and create initial charts
  const discoverAndInitializeCharts = useCallback(async () => {
    if (!selectedDevice) {
      setParameterCharts([]);
      setAvailableParams([]);
      return;
    }

    setInitialLoading(true);
    try {
      // In Live mode, always fetch latest records without date filters to discover parameters
      // In Recorded mode, use date filters if provided
      let response = await dataApi.fetchSensorData(selectedDevice, {
        page: 1,
        limit: 100,
        from: isLiveMode ? undefined : (fromDate || undefined),
        to: isLiveMode ? undefined : (toDate || undefined),
      });

      let parameters = response.parameters || [];

      // Get unique parameter names
      const paramNames = [...new Set(parameters.map((p: any) => p.name))] as string[];
      setAvailableParams(paramNames);

      if (paramNames.length === 0) {
        setParameterCharts([]);
        return;
      }

      // Initialize charts for each parameter
      const initialCharts: ParameterChartData[] = await Promise.all(
        paramNames.map(async (name, index) => {
          let data;

          if (isLiveMode) {
            // In Live mode: Fetch latest 50 raw records per parameter (no aggregation/averaging)
            data = await fetchSingleParameterData(
              name,
              undefined,
              1,
              true, // useRawData: true to get raw data without aggregation
              undefined
            );
          } else {
            // Recorded mode: Normal fetch with date filters
            data = await fetchSingleParameterData(
              name,
              "1m",
              1,
              false,
              undefined
            );
          }

          return {
            name,
            unit: data?.unit || "",
            data: data?.data || [],
            min: data?.min || 0,
            max: data?.max || 100,
            pagination: data?.pagination || { page: 1, totalPages: 1, totalRecords: 0 },
            interval: "1m" as TimeInterval,
            loading: false,
          };
        })
      );

      setParameterCharts(initialCharts);
    } catch (err) {
      console.error("Error discovering parameters:", err);
      setParameterCharts([]);
    } finally {
      setInitialLoading(false);
    }
  }, [selectedDevice, fromDate, toDate, fetchSingleParameterData, isLiveMode]);

  // Update a single chart's interval
  const handleIntervalChange = useCallback(async (paramName: string, newInterval: TimeInterval) => {
    // Set loading state for this chart
    setParameterCharts(prev => prev.map(chart =>
      chart.name === paramName ? { ...chart, loading: true } : chart
    ));

    const data = await fetchSingleParameterData(paramName, newInterval, 1);

    setParameterCharts(prev => prev.map(chart =>
      chart.name === paramName
        ? {
          ...chart,
          interval: newInterval,
          data: data?.data || [],
          min: data?.min || chart.min,
          max: data?.max || chart.max,
          pagination: data?.pagination || chart.pagination,
          loading: false,
        }
        : chart
    ));
  }, [fetchSingleParameterData]);

  // Update per-parameter aggregation interval
  const handleParameterIntervalChange = useCallback((paramName: string, value: number | null, unit: 'seconds' | 'minutes' | 'hours' | null) => {
    setParameterIntervals(prev => {
      if (value === null || unit === null) {
        // Remove the interval for this parameter (Default option)
        const { [paramName]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [paramName]: { value, unit }
      };
    });
  }, []);

  // Update a single chart's page
  const handlePageChange = useCallback(async (paramName: string, newPage: number) => {
    const chart = parameterCharts.find(c => c.name === paramName);
    if (!chart) return;

    // Set loading state
    setParameterCharts(prev => prev.map(c =>
      c.name === paramName ? { ...c, loading: true } : c
    ));

    const data = await fetchSingleParameterData(paramName, chart.interval, newPage);

    setParameterCharts(prev => prev.map(c =>
      c.name === paramName
        ? {
          ...c,
          data: data?.data || [],
          min: data?.min || c.min,
          max: data?.max || c.max,
          pagination: data?.pagination || c.pagination,
          loading: false,
        }
        : c
    ));
  }, [parameterCharts, fetchSingleParameterData]);

  // Live mode polling - fetch latest 50 records per parameter every 5 seconds
  useEffect(() => {
    if (isLiveMode && selectedDevice) {
      // Initial fetch
      discoverAndInitializeCharts();

      // Poll every 5 seconds for latest 50 records per parameter
      liveIntervalRef.current = setInterval(async () => {
        const paramsToFetch = availableParams.length > 0 ? availableParams : parameterCharts.map(c => c.name);

        // Fetch all parameters at once
        const fetchPromises = paramsToFetch.map(paramName =>
          fetchSingleParameterData(paramName, undefined, 1, true, undefined)
            .then(data => ({ paramName, data }))
            .catch(err => {
              console.error(`Error fetching live data for ${paramName}:`, err);
              return null;
            })
        );

        // Wait for all fetches to complete
        const results = await Promise.all(fetchPromises);

        // Update all charts in a single state update
        setParameterCharts(currentCharts => {
          let updatedCharts = [...currentCharts];

          results.forEach(result => {
            if (!result || !result.data) return;

            const { paramName, data } = result;
            const existingIndex = updatedCharts.findIndex(c => c.name === paramName);

            if (existingIndex !== -1) {
              // Update existing chart
              updatedCharts[existingIndex] = {
                ...updatedCharts[existingIndex],
                data: data.data || [],
                min: data.min ?? updatedCharts[existingIndex].min,
                max: data.max ?? updatedCharts[existingIndex].max,
                pagination: data.pagination || updatedCharts[existingIndex].pagination,
                loading: false,
              };
            } else {
              // Create new chart if it doesn't exist yet
              updatedCharts.push({
                name: paramName,
                unit: data.unit || "",
                data: data.data || [],
                min: data.min || 0,
                max: data.max || 100,
                pagination: data.pagination || { page: 1, totalPages: 1, totalRecords: 0 },
                interval: "1m" as TimeInterval,
                loading: false,
              });
            }
          });

          return updatedCharts;
        });
      }, 5000);
    } else {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    }

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
      }
    };
  }, [isLiveMode, selectedDevice, availableParams, discoverAndInitializeCharts, fetchSingleParameterData]);

  // Fetch data when device or date range changes (non-live mode)
  useEffect(() => {
    if (selectedDevice && !isLiveMode) {
      const timer = setTimeout(() => {
        discoverAndInitializeCharts();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedDevice, fromDate, toDate, isLive, isLiveMode, discoverAndInitializeCharts]);

  // Ensure charts are initialized when entering live mode with a selected device
  useEffect(() => {
    if (isLiveMode && selectedDevice && parameterCharts.length === 0 && !initialLoading) {
      discoverAndInitializeCharts();
    }
  }, [isLiveMode, selectedDevice, parameterCharts.length, initialLoading, discoverAndInitializeCharts]);

  // Clear filters
  const clearFilters = () => {
    setFromDate("");
    setToDate("");
  };

  return (
    <>
      <style>{`
        .sensor-dropdown-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: ${scrollbarThumb} ${scrollbarTrack};
        }
        .sensor-dropdown-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .sensor-dropdown-scrollbar::-webkit-scrollbar-track {
          background: ${scrollbarTrack};
          border-radius: 4px;
        }
        .sensor-dropdown-scrollbar::-webkit-scrollbar-thumb {
          background: ${scrollbarThumb};
          border-radius: 4px;
        }
        .sensor-dropdown-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${scrollbarThumbHover};
        }
        .date-filter-label {
          line-height: 1.2;
          display: block;
          top: -0.5rem;
        }
      `}</style>

      <div className="w-full max-w-full min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] flex flex-col bg-background overflow-x-hidden box-border">
        {/* Header */}
        <div className="bg-card border-b border-border shadow-sm p-4 w-full max-w-full overflow-hidden box-border">
          {/* Page Title - Show both modes */}
          <div className="mb-4 sm:mb-5 lg:mb-6">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
              {isLiveMode ? 'Live Graph - Real-time Sensor Data' : 'Recorded Graph - Historical Sensor Data'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLiveMode
                ? 'View real-time sensor readings updated every 5 seconds'
                : 'Analyze historical sensor data with custom time intervals and date ranges'}
            </p>
          </div>
          <div className="pt-5 pb-3 sm:pb-4 px-3 sm:px-4 flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6 items-start lg:items-center bg-card border-2 border-border rounded-lg shadow-md w-full max-w-full overflow-hidden box-border">

            <SensorDropdown
              devices={devices}
              selectedDevice={selectedDevice}
              onSelect={(name) => {
                setSelectedDevice(name);
                setIsSeasonDropdownOpen(false);
                setSeasonSearchQuery("");
              }}
            />

            {/* Date Filters - Hidden in Live Mode */}
            {!isLiveMode && (
              <div className="flex-1 flex justify-center min-w-0 px-2 lg:px-2 flex-shrink-1 overflow-visible">
                <TimeDateFilter
                  from={fromDate}
                  to={toDate}
                  setFrom={setFromDate}
                  setTo={setToDate}
                  clearAllFilters={clearFilters}
                />
              </div>
            )}

            {/* Recorded Graph page must be recorded-only: no live toggle / live range UI here */}


          </div>
        </div>

        {/* Body: Charts */}
        <div ref={chartContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6 w-full max-w-full box-border">
          {initialLoading && parameterCharts.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
                <span className="text-muted-foreground">Loading chart data...</span>
              </div>
            </div>
          ) : parameterCharts.length === 0 && !initialLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center max-w-md">
                <p className="text-lg font-semibold text-foreground mb-2">📊 No Data Available</p>
                <p className="text-sm text-muted-foreground">
                  {selectedDevice
                    ? isLiveMode
                      ? "No real-time data is currently being transmitted from this sensor. Please check if the sensor is active."
                      : "No historical data found for the selected date range. Try adjusting the date filters or selecting a different time period."
                    : "Please select a sensor from the dropdown above to view its data graphs."}
                </p>
              </div>
            </div>
          ) : (
            parameterCharts.map((chart, index) => (
              <IndividualChart
                key={chart.name}
                chart={chart}
                color={COLORS[index % COLORS.length]}
                isDark={isDark}
                isLive={isLive}
                isLiveMode={isLiveMode}
                parameterInterval={parameterIntervals[chart.name]}
                onParameterIntervalChange={(value, unit) => handleParameterIntervalChange(chart.name, value, unit)}
                onIntervalChange={(interval) => handleIntervalChange(chart.name, interval)}
                onPageChange={(page) => handlePageChange(chart.name, page)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}

// Individual Chart Component with its own controls
function IndividualChart({
  chart,
  color,
  isDark,
  isLive,
  isLiveMode,
  parameterInterval,
  onParameterIntervalChange,
  onIntervalChange,
  onPageChange,
}: {
  chart: ParameterChartData;
  color: string;
  isDark: boolean;
  isLive: boolean;
  isLiveMode: boolean;
  parameterInterval?: { value: number; unit: 'seconds' | 'minutes' | 'hours' };
  onParameterIntervalChange?: (value: number | null, unit: 'seconds' | 'minutes' | 'hours' | null) => void;
  onIntervalChange: (interval: TimeInterval) => void;
  onPageChange: (page: number) => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const seriesRef = useRef<am5xy.LineSeries | null>(null);
  const xAxisRef = useRef<am5xy.DateAxis<am5xy.AxisRendererX> | null>(null);
  const yAxisRef = useRef<am5xy.ValueAxis<am5xy.AxisRendererY> | null>(null);
  const xyChartRef = useRef<am5xy.XYChart | null>(null);
  const [isIntervalOpen, setIsIntervalOpen] = useState(false);
  const intervalDropdownRef = useRef<HTMLDivElement>(null);
  const [isParamIntervalOpen, setIsParamIntervalOpen] = useState(false);
  const paramIntervalDropdownRef = useRef<HTMLDivElement>(null);
  const previousDataLengthRef = useRef<number>(0);
  const previousAxisRangeRef = useRef<{ min: number; max: number } | null>(null);

  // Calculate aggregation interval in seconds for this parameter
  const paramAggregationSeconds = useMemo(() => {
    if (!isLive || !parameterInterval) return null;
    const multipliers = { seconds: 1, minutes: 60, hours: 3600 };
    return parameterInterval.value * multipliers[parameterInterval.unit];
  }, [isLive, parameterInterval]);

  // Aggregate data in a non-blocking way: useEffect + requestAnimationFrame
  // Previously a useMemo — calling aggregateDataIntoBuckets synchronously on every render
  // froze the browser when large intervals like 30 seconds were selected.
  const [displayData, setDisplayData] = useState<ChartDataPoint[]>([]);
  useEffect(() => {
    if (!chart.data || chart.data.length === 0) {
      setDisplayData([]);
      return;
    }

    if (isLive && paramAggregationSeconds && paramAggregationSeconds > 0) {
      // Cap raw points before bucketing to bound worst-case work
      const pointsToAggregate = chart.data.slice(-200);
      // Defer to next animation frame so the UI stays responsive
      const id = requestAnimationFrame(() => {
        const aggregated = aggregateDataIntoBuckets(pointsToAggregate, paramAggregationSeconds);
        setDisplayData(aggregated.length > 0 ? aggregated : pointsToAggregate);
      });
      return () => cancelAnimationFrame(id);
    }

    setDisplayData([...chart.data]);
  }, [chart.data, paramAggregationSeconds, isLive]);

  // Recalculate min/max based on aggregated data
  const { displayMin, displayMax } = useMemo(() => {
    if (displayData.length === 0) {
      return { displayMin: chart.min, displayMax: chart.max };
    }
    const values = displayData.map(d => d.value);
    return {
      displayMin: values.reduce((a, b) => (a < b ? a : b), values[0]),
      displayMax: values.reduce((a, b) => (a > b ? a : b), values[0]),
    };
  }, [displayData, chart.min, chart.max]);

  const chartConfigRef = useRef({
    interval: chart.interval,
    name: chart.name,
    unit: chart.unit,
    color,
    isDark,
    isLive,
    isLiveMode
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isIntervalOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (intervalDropdownRef.current && !intervalDropdownRef.current.contains(event.target as Node)) {
        setIsIntervalOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isIntervalOpen]);

  // Close parameter interval dropdown when clicking outside
  useEffect(() => {
    if (!isParamIntervalOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (paramIntervalDropdownRef.current && !paramIntervalDropdownRef.current.contains(event.target as Node)) {
        setIsParamIntervalOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isParamIntervalOpen]);

  // Create chart (only when structure changes)
  useLayoutEffect(() => {
    if (!chartRef.current) return;

    // Check if we need to recreate the chart (structural changes)
    const configChanged =
      chartConfigRef.current.interval !== chart.interval ||
      chartConfigRef.current.name !== chart.name ||
      chartConfigRef.current.unit !== chart.unit ||
      chartConfigRef.current.color !== color ||
      chartConfigRef.current.isDark !== isDark ||
      chartConfigRef.current.isLive !== isLive ||
      chartConfigRef.current.isLiveMode !== isLiveMode;

    // Dispose previous chart only if structure changed
    if (rootRef.current && configChanged) {
      rootRef.current.dispose();
      rootRef.current = null;
      seriesRef.current = null;
      xAxisRef.current = null;
      yAxisRef.current = null;
      xyChartRef.current = null;
    }

    // Create new chart only if it doesn't exist
    if (!rootRef.current) {
      const root = am5.Root.new(chartRef.current);
      rootRef.current = root;

      // Set themes — Animated theme intentionally omitted: it hooks into every amCharts
      // operation (axis changes, data.setAll, appear) and triggers full canvas animation
      // sequences that block the main thread when multiple charts update simultaneously.
      const themes: am5.Theme[] = [];
      if (isDark) {
        themes.push(am5themes_Dark.new(root));
      }
      root.setThemes(themes);

      // Create chart
      const xyChart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: false,
          wheelX: "panX",
          wheelY: "zoomX",
          pinchZoomX: true,
          paddingLeft: 0,
          paddingRight: 20,
        })
      );
      xyChartRef.current = xyChart;

      // Remove axis corner icon/image at the intersection of Y-axis and X-axis
      // This is done by hiding the axis corner sprites
      xyChart.set("arrangeTooltips", false);

      // Calculate time range with buffer
      let dataMin: number;
      let dataMax: number;

      if (displayData.length > 0) {
        // Use reduce to avoid spread RangeError on large arrays
        dataMin = displayData.reduce((a, d) => (d.date < a ? d.date : a), displayData[0].date);
        dataMax = displayData.reduce((a, d) => (d.date > a ? d.date : a), displayData[0].date);
      } else {
        // Default range based on interval if no data - use current time
        const now = Date.now();
        // Use a default 1-minute fallback for when there is no data yet
        const msInterval = 60000;
        dataMax = now;
        dataMin = now - msInterval * RECORDS_PER_PAGE;
      }

      const range = dataMax - dataMin;
      // Calculate buffer based on the base interval - use a few intervals as buffer
      const bufferSizeMs = isLive
        ? 5000 // 5 second buffer for live mode (raw data with seconds precision)
        : 60000; // Default 1 minute buffer for non-live
      // Ensure minimum buffer but don't exceed 5% of range
      let buffer = Math.max(range * 0.05, bufferSizeMs);

      // If aggregation is active, align buffer to the aggregation interval
      if (isLive && paramAggregationSeconds && paramAggregationSeconds > 0) {
        const bucketSizeMs = paramAggregationSeconds * 1000;
        buffer = bucketSizeMs; // Use one bucket as buffer
      }

      // Determine base interval - in live mode use user-selected interval, otherwise use chart.interval
      let baseInterval: { timeUnit: am5.time.TimeUnit; count: number } = { timeUnit: 'minute', count: 1 };

      if (isLive) {
        // For live mode, calculate the actual interval from data to align grid lines with data points
        // If aggregation is applied, use the aggregation interval; otherwise detect from data
        if (paramAggregationSeconds && paramAggregationSeconds > 0) {
          // Use the per-parameter selected interval for base interval
          const gapSeconds = paramAggregationSeconds;
          if (gapSeconds < 60) {
            baseInterval = { timeUnit: 'second', count: Math.max(1, gapSeconds) };
          } else if (gapSeconds < 3600) {
            baseInterval = { timeUnit: 'minute', count: Math.max(1, Math.round(gapSeconds / 60)) };
          } else {
            baseInterval = { timeUnit: 'hour', count: Math.max(1, Math.round(gapSeconds / 3600)) };
          }
        } else if (displayData.length >= 2) {
          const sortedData = [...displayData].sort((a, b) => a.date - b.date);
          const gaps: number[] = [];
          for (let i = 1; i < Math.min(sortedData.length, 10); i++) {
            gaps.push(sortedData[i].date - sortedData[i - 1].date);
          }
          // Use median gap
          gaps.sort((a, b) => a - b);
          const medianGap = gaps[Math.floor(gaps.length / 2)];
          const gapSeconds = Math.round(medianGap / 1000);

          const timeUnitMap = {
            'seconds': 'second' as am5.time.TimeUnit,
            'minutes': 'minute' as am5.time.TimeUnit,
            'hours': 'hour' as am5.time.TimeUnit,
          };

          // Use the detected gap as base interval for precise alignment
          if (gapSeconds < 60) {
            baseInterval = { timeUnit: 'second', count: Math.max(1, gapSeconds) };
          } else if (gapSeconds < 3600) {
            baseInterval = { timeUnit: 'minute', count: Math.max(1, Math.round(gapSeconds / 60)) };
          } else {
            baseInterval = { timeUnit: 'hour', count: Math.max(1, Math.round(gapSeconds / 3600)) };
          }
        } else {
          // Fallback: use 10 seconds as default
          baseInterval = { timeUnit: 'second', count: 10 };
        }
      }


      // Calculate appropriate minGridDistance based on interval
      // Longer intervals = fewer data points = can show more labels = lower minGridDistance
      // Shorter intervals = more data points = need more spacing = higher minGridDistance
      let minGridDistance: number;
      minGridDistance = 100;

      // Align axis min and max to grid boundaries when aggregation is active
      let axisMin = dataMin - buffer;
      let axisMax = dataMax + buffer;

      if (isLive && paramAggregationSeconds && paramAggregationSeconds > 0 && displayData.length > 0) {
        const bucketSizeMs = paramAggregationSeconds * 1000;
        const firstDataPoint = displayData[0].date;
        const lastDataPoint = displayData[displayData.length - 1].date;

        // Set axis min to a bucket boundary that's at or before the first data point
        // This ensures grid lines align with data points
        axisMin = Math.floor(firstDataPoint / bucketSizeMs) * bucketSizeMs;

        // Set axis max to a bucket boundary after the last data point
        axisMax = Math.ceil((lastDataPoint + buffer) / bucketSizeMs) * bucketSizeMs;
      }

      // Create X-axis (DateAxis) with proper formatting
      // Allow amCharts to automatically calculate appropriate grid intervals

      const xAxis = xyChart.xAxes.push(
        am5xy.DateAxis.new(root, {
          baseInterval: baseInterval,
          min: axisMin,
          max: axisMax,
          maxZoomFactor: 1000,
          strictMinMax: true,
          // Remove gridIntervals to let amCharts calculate optimal intervals based on minGridDistance
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: minGridDistance, // Dynamic spacing based on interval
            minorGridEnabled: false,
            inside: false,
          }),
          tooltip: am5.Tooltip.new(root, {}),
        })
      );
      xAxisRef.current = xAxis as am5xy.DateAxis<am5xy.AxisRendererX>;

      // Configure X-axis renderer
      const xRenderer = xAxis.get("renderer");

      // Hide vertical grid lines (X-axis grid)
      xRenderer.grid.template.setAll({
        strokeOpacity: 0,
      });

      // Style X-axis labels - consistent for both modes
      xRenderer.labels.template.setAll({
        centerY: am5.p100,
        centerX: am5.p100,
        rotation: -45,
        paddingTop: 10, // Further increased padding to prevent labels from overlapping with the line
        paddingBottom: 5,
        fontSize: 10, // Slightly smaller font to reduce label width
        oversizedBehavior: "truncate",
        maxWidth: 150, // Limit label width to prevent excessive overlap
      });

      // Force grid lines to align with data points
      xAxis.set("snapTooltip", true);
      xAxis.set("start", 0);
      xAxis.set("end", 1);

      // Remove period selector icon/link above X-axis labels
      if (xAxis.axisHeader) {
        xAxis.axisHeader.children.clear();
      }
      // Disable period selector
      xAxis.set("markUnitChange", false);

      // Configure date formats for X-axis labels - consistent format for both modes
      const dateFormats = xAxis.get("dateFormats")!;
      dateFormats["millisecond"] = "dd MMM yyyy HH:mm:ss.SSS";
      dateFormats["second"] = "dd MMM yyyy HH:mm:ss";
      dateFormats["minute"] = "dd MMM yyyy HH:mm";
      dateFormats["hour"] = "dd MMM yyyy HH:mm";
      dateFormats["day"] = "dd MMM yyyy";
      dateFormats["week"] = "dd MMM yyyy";
      dateFormats["month"] = "MMM yyyy";
      dateFormats["year"] = "yyyy";

      // Configure tooltip date formats - always show full format
      const tooltipFormats = xAxis.get("tooltipDateFormats")!;
      tooltipFormats["millisecond"] = "dd MMM yyyy HH:mm:ss.SSS";
      tooltipFormats["second"] = "dd MMM yyyy HH:mm:ss";
      tooltipFormats["minute"] = "dd MMM yyyy HH:mm";
      tooltipFormats["hour"] = "dd MMM yyyy HH:mm";
      tooltipFormats["day"] = "dd MMM yyyy";
      tooltipFormats["week"] = "dd MMM yyyy";
      tooltipFormats["month"] = "MMM yyyy";
      tooltipFormats["year"] = "yyyy";

      // Configure period change formats - consistent for both modes
      const periodFormats = xAxis.get("periodChangeDateFormats")!;
      periodFormats["millisecond"] = "dd MMM yyyy HH:mm:ss";
      periodFormats["second"] = "dd MMM yyyy HH:mm:ss";
      periodFormats["minute"] = "dd MMM yyyy HH:mm";
      periodFormats["hour"] = "dd MMM yyyy HH:mm";
      periodFormats["day"] = "dd MMM yyyy";
      periodFormats["week"] = "dd MMM yyyy";
      periodFormats["month"] = "MMM yyyy";
      periodFormats["year"] = "yyyy";

      // Style minor grid lines (if available)
      if ((xRenderer as any).minorGrid) {
        (xRenderer as any).minorGrid.template.setAll({
          strokeOpacity: 0.3,
          strokeDasharray: [2, 2],
        });
      }

      // Create Y-axis with proper range
      const yRange = displayMax - displayMin;
      const yPadding = yRange * 0.15 || 10; // 15% padding or minimum 10

      const yAxis = xyChart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          min: displayMin - yPadding,
          max: displayMax + yPadding,
          renderer: am5xy.AxisRendererY.new(root, {
            minGridDistance: 40,
            minorGridEnabled: true,
            inside: false,
          }),
          numberFormat: "#.##",
        })
      );
      yAxisRef.current = yAxis as am5xy.ValueAxis<am5xy.AxisRendererY>;

      // Style minor grid lines for Y-axis (if available)
      const yRenderer = yAxis.get("renderer") as am5xy.AxisRendererY;
      if ((yRenderer as any).minorGrid) {
        (yRenderer as any).minorGrid.template.setAll({
          strokeOpacity: 0.3,
          strokeDasharray: [2, 2],
        });
      }

      // Style Y-axis labels
      yAxis.get("renderer").labels.template.setAll({
        fontSize: 11,
      });

      // Add Y-axis label (unit)
      yAxis.children.unshift(
        am5.Label.new(root, {
          rotation: -90,
          text: chart.unit || "Value",
          y: am5.p50,
          centerX: am5.p50,
          fontWeight: "600",
          fontSize: 12,
          paddingRight: 10,
        })
      );

      // Create series with smooth curved lines using SmoothedXLineSeries
      const series = xyChart.series.push(
        am5xy.SmoothedXLineSeries.new(root, {
          name: chart.name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: "value",
          valueXField: "date",
          stroke: am5.color(color),
          fill: am5.color(color),
          connect: true,
          tooltip: am5.Tooltip.new(root, {
            pointerOrientation: "up",
            getFillFromSprite: false,
            getStrokeFromSprite: false,
            labelText: `{valueX.formatDate('dd MMM yyyy HH:mm:ss')}\n[bold fill="${color}"]{name}[/]: {valueY.formatNumber('#.##')} ${chart.unit}`,
            animationDuration: 200,
            forceInactive: false,
            keepTargetHover: true, // Keep tooltip when hovering
          }),
        } as any) // Use 'as any' to allow sortByX which may not be in types but works at runtime
      );

      // Ensure data is sorted by X (date) axis
      (series as any).sortByX = true;

      // Style tooltip to appear above with rounded corners - make it clearly visible
      const tooltip = series.get("tooltip")!;
      const tooltipBg = tooltip.get("background")!;

      // Set colors and styling based on theme - ensure high contrast for visibility
      if (isDark) {
        tooltipBg.setAll({
          fill: am5.color(0x1a1a1a),
          fillOpacity: 0.98,
          stroke: am5.color(0x666666),
          strokeWidth: 2,
        });
      } else {
        tooltipBg.setAll({
          fill: am5.color(0xffffff),
          fillOpacity: 0.98,
          stroke: am5.color(0x999999),
          strokeWidth: 2,
        });
      }

      // Apply rounded corners for better appearance
      if ((tooltipBg as any).cornerRadius !== undefined) {
        (tooltipBg as any).cornerRadius = 6;
      }

      // Configure tooltip label styling - make text more visible
      tooltip.label.setAll({
        fontSize: 13,
        paddingTop: 8,
        paddingBottom: 8,
        paddingLeft: 10,
        paddingRight: 10,
        fill: isDark ? am5.color(0xffffff) : am5.color(0x000000),
        fontWeight: "500",
      });

      // Ensure tooltip appears clearly above the point with better positioning
      tooltip.set("dy", -15);
      // Ensure tooltip appears above other elements
      if ((tooltip as any).zIndex !== undefined) {
        (tooltip as any).zIndex = 1000;
      }

      // Improve tooltip for dense second-level data in live mode
      if (isLive) {
        // Enable tooltip for line segments (hover over line shows nearest point)
        (series as any).tooltipLocation = 0.5; // Show tooltip at middle of line segment
        // Ensure tooltip works with cursor - make it more responsive
        tooltip.set("animationDuration", 150); // Faster for live updates
        tooltip.set("forceInactive", false); // Ensure tooltip can be shown

        // Make series interactive to show tooltips on line hover
        series.set("interactive", true);

        // Configure tooltip to show on both bullets and line segments
        tooltip.set("getStrokeFromSprite", false);
        tooltip.set("getFillFromSprite", false);

        // Ensure tooltip shows on hover
        series.strokes.template.set("interactive", true);
      }
      seriesRef.current = series;

      // Style the line - ensure smooth appearance like reference image
      series.strokes.template.setAll({
        strokeWidth: 2.5,
        strokeLinecap: "round",
        strokeLinejoin: "round",
      } as any);

      // Add subtle fill under line
      series.fills.template.setAll({
        visible: true,
        fillOpacity: 0.05,
      });

      // Add bullets (data points) - styled to match reference image
      // Configure bullets to trigger the series tooltip properly
      series.bullets.push(() => {
        const bulletSprite = am5.Circle.new(root, {
          radius: 4.5,
          fill: series.get("fill"),
          stroke: root.interfaceColors.get("background"),
          strokeWidth: 2.5,
          cursorOverStyle: "pointer", // Show pointer cursor on hover
        });

        const bullet = am5.Bullet.new(root, {
          sprite: bulletSprite,
        });

        // Make bullet sprite interactive to trigger series tooltip
        bulletSprite.set("interactive", true);

        return bullet;
      });

      // Set initial data - ensure it's sorted and deduplicated
      const sortedInitialData = [...displayData].sort((a, b) => a.date - b.date);
      const dedupedInitialData = new Map<number, ChartDataPoint>();
      sortedInitialData.forEach(point => {
        dedupedInitialData.set(point.date, point);
      });
      const finalInitialData = Array.from(dedupedInitialData.values()).sort((a, b) => a.date - b.date);
      series.data.setAll(finalInitialData);

      // Add cursor with snapping for better tooltip display
      const cursor = xyChart.set("cursor", am5xy.XYCursor.new(root, {
        behavior: "zoomX",
        xAxis: xAxis,
        snapToSeries: [series],
        snapToSeriesBy: "x", // Snap to series by X value for better tooltip accuracy
      }));

      cursor.lineY.set("visible", false);

      // Improve tooltip display for dense data points - ensure tooltips work for both live and recorded modes
      // Ensure cursor shows tooltip when hovering over series
      (series as any).showTooltipOn = "hover";

      // Make series and strokes interactive for tooltip display
      series.set("interactive", true);
      series.strokes.template.set("interactive", true);

      if (isLive) {
        // For live mode with second-level data, ensure tooltip works well
        (cursor as any).snapDistance = 15; // Increase snap distance for better hover detection
      } else {
        // For recorded mode, use standard snap distance but ensure tooltips are enabled
        (cursor as any).snapDistance = 10;
      }

      // Add scrollbar for panning
      const scrollbar = xyChart.set("scrollbarX", am5.Scrollbar.new(root, {
        orientation: "horizontal",
      }));
      scrollbar.set("height", 10);

      // Live Graph page: show a single bottom (axis) tooltip with date + param/value/unit
      // This matches the "black block" tooltip shown in the screenshot.
      if (isLiveMode && isLive) {
        const axisTooltip = xAxis.get("tooltip");
        if (axisTooltip) {
          // Make it a clear black tooltip
          axisTooltip.get("background")?.setAll({
            fill: am5.color(0x000000),
            fillOpacity: 0.85,
            strokeOpacity: 0,
            cornerRadius: 8,
          } as any);
          axisTooltip.setAll({
            pointerOrientation: "up",
            dy: -22,
          } as any);
          axisTooltip.label.setAll({
            fill: am5.color(0xffffff),
            fontSize: 14,
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 12,
            paddingRight: 12,
            textAlign: "center",
            lineHeight: 1.25,
          });
        }

        // Hide the series tooltip to avoid double-tooltips in live graph route
        const seriesTooltip = series.get("tooltip");
        if (seriesTooltip) {
          (seriesTooltip as any).set?.("forceHidden", true);
          // fallback if set() isn't present on types
          (seriesTooltip as any).forceHidden = true;
        }

        cursor.events.on("cursormoved", () => {
          const axisTooltipLocal = xAxis.get("tooltip");
          if (!axisTooltipLocal) return;

          const dataItem = series.get("tooltipDataItem");
          if (!dataItem) return;

          const valueX = (dataItem as any).get?.("valueX") ?? (dataItem as any).get?.("valueXWorking");
          const valueY = (dataItem as any).get?.("valueY") ?? (dataItem as any).get?.("valueYWorking");
          if (valueX == null || valueY == null) return;

          const dateText = root.dateFormatter.format(new Date(valueX), "dd MMM yyyy HH:mm:ss");
          const valueText = root.numberFormatter.format(valueY, "#.##");
          const unitText = chart.unit ? ` ${chart.unit}` : "";
          axisTooltipLocal.label.set("text", `${dateText}\n${chart.name} : ${valueText}${unitText}`);
          // Ensure tooltip stays readable and not clipped by the plot area
          (axisTooltipLocal as any).show?.();
        });
      }

      // Remove axis corner icon/image at the intersection of Y-axis and X-axis
      // Hide corner sprites from both axes after chart is fully initialized
      setTimeout(() => {
        const xRenderer = xAxis.get("renderer") as am5xy.AxisRendererX;
        const yRenderer = yAxis.get("renderer") as am5xy.AxisRendererY;

        // Hide corner sprite from X-axis renderer
        if ((xRenderer as any).axisCorner) {
          (xRenderer as any).axisCorner.set("visible", false);
        }

        // Hide corner sprite from Y-axis renderer
        if ((yRenderer as any).axisCorner) {
          (yRenderer as any).axisCorner.set("visible", false);
        }

        // Also try to hide through chart container if available
        if (xyChart.plotContainer) {
          xyChart.plotContainer.children.each((child: any) => {
            if (child && (child as any).get("name") === "axisCorner") {
              child.set("visible", false);
            }
          });
        }
      }, 100);

      // Animate on load
      series.appear(1000);
      xyChart.appear(1000, 100);

      // Update config ref
      chartConfigRef.current = {
        interval: chart.interval,
        name: chart.name,
        unit: chart.unit,
        color,
        isDark,
        isLive,
        isLiveMode
      };
      previousDataLengthRef.current = displayData.length;

      // Initialize previous axis range for zoom detection
      const initialXMin = axisMin;
      const initialXMax = axisMax;
      previousAxisRangeRef.current = { min: initialXMin, max: initialXMax };
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
        seriesRef.current = null;
        xAxisRef.current = null;
        yAxisRef.current = null;
        xyChartRef.current = null;
      }
    };
  }, [chart.interval, chart.name, chart.unit, color, isDark, isLive, isLiveMode]);

  // Update data without recreating chart (preserves zoom)
  // IMPORTANT: useEffect (not useLayoutEffect) so this runs AFTER paint, keeping the
  // UI responsive. useLayoutEffect was blocking the browser thread synchronously
  // across all chart instances when the interval changed.
  useEffect(() => {
    if (!seriesRef.current || !xAxisRef.current || !yAxisRef.current) return;

    // Calculate new data range
    // Use reduce instead of spread to avoid RangeError on large arrays
    const dataMin = displayData.length > 0
      ? displayData.reduce((a, d) => (d.date < a ? d.date : a), displayData[0].date)
      : Date.now();
    const dataMax = displayData.length > 0
      ? displayData.reduce((a, d) => (d.date > a ? d.date : a), displayData[0].date)
      : Date.now();
    const range = dataMax - dataMin;
    // Use appropriate buffer: 5 seconds for live mode
    const bufferSizeMs = 5000;
    let buffer = Math.max(range * 0.05, bufferSizeMs);

    // If aggregation is active, align buffer to the aggregation interval
    if (isLive && paramAggregationSeconds && paramAggregationSeconds > 0) {
      const bucketSizeMs = paramAggregationSeconds * 1000;
      buffer = bucketSizeMs; // Use one bucket as buffer
    }

    let fullXMin = dataMin - buffer;
    let fullXMax = dataMax + buffer;

    // Align axis min and max to grid boundaries when aggregation is active
    if (isLive && paramAggregationSeconds && paramAggregationSeconds > 0) {
      const bucketSizeMs = paramAggregationSeconds * 1000;
      // Align min to bucket boundary (floor)
      fullXMin = Math.floor(fullXMin / bucketSizeMs) * bucketSizeMs;
      // Align max to bucket boundary (ceil)
      fullXMax = Math.ceil(fullXMax / bucketSizeMs) * bucketSizeMs;
    }

    // Get current visible range
    const currentXMin = xAxisRef.current.get("min") ?? fullXMin;
    const currentXMax = xAxisRef.current.get("max") ?? fullXMax;
    const currentRange = currentXMax - currentXMin;
    const newFullRange = fullXMax - fullXMin;

    // Check if user has manually zoomed/panned
    // Compare current range to what the full range should be
    // In live mode, use a stricter threshold (80%) to detect zoom, so we show latest data by default
    const zoomThreshold = 0.80;
    const isZoomed = previousAxisRangeRef.current !== null &&
      newFullRange > 0 &&
      (currentRange / newFullRange) < zoomThreshold;

    // Update Y-axis range if needed (but only adjust, don't reset)
    const yRange = displayMax - displayMin;
    const yPadding = yRange * 0.15 || 10;
    const newYMin = displayMin - yPadding;
    const newYMax = displayMax + yPadding;

    // Only update Y-axis if the range has changed significantly
    const currentYMin = yAxisRef.current.get("min");
    const currentYMax = yAxisRef.current.get("max");
    const yRangeChanged = Math.abs((currentYMin || 0) - newYMin) > 0.01 ||
      Math.abs((currentYMax || 0) - newYMax) > 0.01;

    if (yRangeChanged) {
      yAxisRef.current.set("min", newYMin);
      yAxisRef.current.set("max", newYMax);
    }

    // Update series data without animation (animationDuration=0 prevents heavy canvas redraws
    // that were contributing to the freeze on interval changes)
    if (displayData.length > 0) {
      const sortedData = [...displayData].sort((a, b) => a.date - b.date);
      // Remove duplicate timestamps (keep last value)
      const dedupedData = new Map<number, ChartDataPoint>();
      sortedData.forEach(point => {
        dedupedData.set(point.date, point);
      });
      const finalData = Array.from(dedupedData.values()).sort((a, b) => a.date - b.date);
      // Disable transition animation for data updates to avoid heavy repaints
      (seriesRef.current as any).set("animationDuration", 0);
      seriesRef.current.data.setAll(finalData);
    } else {
      (seriesRef.current as any).set("animationDuration", 0);
      seriesRef.current.data.setAll([]);
    }

    // Update X-axis: preserve zoom in live mode if user has zoomed, otherwise show latest data
    if (isLive && isZoomed && previousDataLengthRef.current > 0) {
      // In live mode with zoom: DON'T update axis min/max - preserve user's zoom
      // Just update the data and let the chart render with existing zoom
      // This allows new data to appear while maintaining the zoomed view
    } else {
      // No zoom or not in live mode: update to show all data (latest 50 points in live mode)
      // In live mode, always show the latest data by updating to full range
      xAxisRef.current.set("min", fullXMin);
      xAxisRef.current.set("max", fullXMax);
      previousAxisRangeRef.current = { min: fullXMin, max: fullXMax };
    }

    previousDataLengthRef.current = displayData.length;
  }, [displayData, displayMin, displayMax, isLive, paramAggregationSeconds]);

  // Update X-axis configuration when parameter interval settings change in live mode
  useEffect(() => {
    if (!isLive || !xAxisRef.current || !rootRef.current) return;

    // If no parameter interval is set (Default mode), reset to default base interval
    if (!parameterInterval) {
      // Reset to default configuration for raw data display
      const defaultInterval = { timeUnit: 'second' as am5.time.TimeUnit, count: 10 };
      xAxisRef.current.set("baseInterval", defaultInterval);
      // Don't set gridIntervals - let minGridDistance control label spacing
      // This prevents label overlap

      // Update the renderer to ensure proper label spacing
      const renderer = xAxisRef.current.get("renderer");
      if (renderer) {
        renderer.set("minGridDistance", 120); // Ensure sufficient spacing for default mode
      }

      // Update date formats for second-level precision
      const dateFormats = xAxisRef.current.get("dateFormats")!;
      dateFormats["second"] = "dd MMM yyyy HH:mm:ss";
      dateFormats["minute"] = "dd MMM yyyy HH:mm";
      dateFormats["hour"] = "dd MMM yyyy HH:mm";

      // Force axis to recalculate
      xAxisRef.current.markDirtyExtremes();
      xAxisRef.current.markDirtySize();
      return;
    }

    const timeUnitMap = {
      'seconds': 'second' as am5.time.TimeUnit,
      'minutes': 'minute' as am5.time.TimeUnit,
      'hours': 'hour' as am5.time.TimeUnit,
    };

    const newBaseInterval = {
      timeUnit: timeUnitMap[parameterInterval.unit],
      count: parameterInterval.value
    };

    // Update the X-axis baseInterval only — do NOT call markDirtyExtremes or
    // markDirtySize as those force a full synchronous chart-layout recalculation
    // which was the primary cause of the "page not responsive" freeze.
    xAxisRef.current.set("baseInterval", newBaseInterval);
    xAxisRef.current.set("gridIntervals", [newBaseInterval]);

    // Update date formats based on the time unit
    const dateFormats = xAxisRef.current.get("dateFormats")!;
    if (parameterInterval.unit === 'seconds') {
      dateFormats["second"] = "dd MMM yyyy HH:mm:ss";
      dateFormats["minute"] = "dd MMM yyyy HH:mm";
      dateFormats["hour"] = "dd MMM yyyy HH:mm";
    } else if (parameterInterval.unit === 'minutes') {
      dateFormats["second"] = "dd MMM yyyy HH:mm:ss";
      dateFormats["minute"] = "dd MMM yyyy HH:mm";
      dateFormats["hour"] = "dd MMM yyyy HH:mm";
    } else if (parameterInterval.unit === 'hours') {
      dateFormats["minute"] = "dd MMM yyyy HH:mm";
      dateFormats["hour"] = "dd MMM yyyy HH:mm";
      dateFormats["day"] = "dd MMM yyyy";
    }
  }, [parameterInterval, isLive]);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Chart Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-border bg-muted/30">
        {/* Left: Title & Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
            {chart.name}
            {isLive && (
              <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full font-medium">
                ● Live
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">Unit:</span> <span className="font-medium">{chart.unit || "N/A"}</span>
            {" | "}<span className="font-semibold text-foreground">Range:</span> <span className="font-medium">{displayMin.toFixed(2)} - {displayMax.toFixed(2)}</span>
            {" | "}<span className="font-semibold text-foreground">Data Points:</span> <span className="font-medium">{displayData.length}</span>
            {paramAggregationSeconds && paramAggregationSeconds > 0 && (
              <span className="text-xs ml-2 bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                ⏱ Aggregated: {parameterInterval?.value} {parameterInterval?.unit}
              </span>
            )}
          </p>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Loading Spinner */}
          {chart.loading && (
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
          )}

          {/* Aggregation Interval Dropdown - Only show in live mode */}
          {isLive && onParameterIntervalChange && (
            <>
              {/* <label className="text-sm font-medium text-muted-foreground">Data Aggregation:</label> */}
              <label className="text-sm font-medium text-muted-foreground">X-axis interval:</label>
              <div className="relative" ref={paramIntervalDropdownRef}>
                <button
                  onClick={() => setIsParamIntervalOpen(!isParamIntervalOpen)}
                  disabled={chart.loading}
                  className="h-9 px-3 text-sm font-medium bg-background border border-border rounded-lg hover:bg-accent disabled:opacity-50 flex items-center gap-2 min-w-[110px] justify-between"
                >
                  <span>
                    {parameterInterval
                      ? `${parameterInterval.value} ${parameterInterval.unit === 'seconds' ? 'sec' : parameterInterval.unit === 'minutes' ? 'min' : 'hr'}`
                      : 'Default'
                    }
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isParamIntervalOpen ? "rotate-180" : ""}`} />
                </button>
                {isParamIntervalOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-popover border border-border rounded-lg shadow-lg z-10 overflow-hidden">
                    <button
                      onClick={() => {
                        onParameterIntervalChange(null, null);
                        setIsParamIntervalOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${!parameterInterval
                        ? 'bg-accent font-medium'
                        : ''
                        }`}
                    >
                      Default
                    </button>
                    <button
                      onClick={() => {
                        onParameterIntervalChange(30, 'seconds');
                        setIsParamIntervalOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${parameterInterval?.value === 30 && parameterInterval?.unit === 'seconds'
                        ? 'bg-accent font-medium'
                        : ''
                        }`}
                    >
                      30 seconds
                    </button>
                    <button
                      onClick={() => {
                        onParameterIntervalChange(1, 'minutes');
                        setIsParamIntervalOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${parameterInterval?.value === 1 && parameterInterval?.unit === 'minutes'
                        ? 'bg-accent font-medium'
                        : ''
                        }`}
                    >
                      1 minute
                    </button>
                    <button
                      onClick={() => {
                        onParameterIntervalChange(30, 'minutes');
                        setIsParamIntervalOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${parameterInterval?.value === 30 && parameterInterval?.unit === 'minutes'
                        ? 'bg-accent font-medium'
                        : ''
                        }`}
                    >
                      30 minutes
                    </button>
                    <button
                      onClick={() => {
                        onParameterIntervalChange(1, 'hours');
                        setIsParamIntervalOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${parameterInterval?.value === 1 && parameterInterval?.unit === 'hours'
                        ? 'bg-accent font-medium'
                        : ''
                        }`}
                    >
                      1 hour
                    </button>
                  </div>
                )}
              </div>
            </>
          )}




        </div>
      </div>

      {/* Chart Container */}
      <div className="p-4 relative">
        <div ref={chartRef} style={{ width: "100%", height: "350px" }} />
        {chart.data.length === 0 && !chart.loading && (
          <div className="flex items-center justify-center h-[350px] bg-muted/20 rounded-lg border border-dashed border-border absolute top-4 left-4 right-4">
            <div className="text-center">
              <p className="text-muted-foreground font-medium">No data available</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting the date range or time scale
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 pb-3 text-xs text-muted-foreground text-center border-t border-border pt-3">
        <>
          Total Records: <span className="font-medium">{chart.pagination.totalRecords}</span>
          {" • "}
          Data Points: <span className="font-medium">{chart.data.length}</span>
          {" • "}
          Scale: <span className="font-medium">Raw Data (per second)</span>
        </>
      </div>
    </div>
  );
}




