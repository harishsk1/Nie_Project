import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useScrollLock } from "../hooks/useScrollLock";
import { IoMdAdd } from "react-icons/io";
import { MdArrowBackIosNew, MdOutlineArrowForwardIos } from "react-icons/md";
import { ImFilesEmpty } from "react-icons/im";
import { ChevronDown, Search, X } from "lucide-react";

import CheckboxFilter from "../components/CheckboxFilter";
import TimeDateFilter from "../components/TimeDateFilter";
import DownloadButton from "../components/DownloadButton";
import { useTheme } from "../contexts/ThemeContext";
import { deviceApi } from "../api/deviceApi";
import { dataApi, SensorQueryParams } from "../api/dataApi";
import { formatDateTime } from "../utils/dateTime";



interface Row {
  id: number;
  name: string;
  value: number;
  unit: string;
  status: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

const LIMIT = 10;
const LIVE_LIMIT = 5000; // Increase buffer to 5000 to cover all params fully
// const LIVE_RECORDS_PER_PARAM = 100; // Show latest 100 records per parameter
const LIVE_RECORDS_PER_PARAM = 50; // Show latest 100 records per parameter
const LIVE_PAGE_LIMIT = 10; // 10 records per page as requested
const CHART_HISTORY_HOURS = 16;
const LIVE_POLL_INTERVAL = 5000; // Poll every 5 seconds in live mode

const SENSOR_PARAMETERS: Record<string, string[]> = {
  EE872: ["CO2", "Temperature", "Humidity", "Pressure", "Dew Point"],
  EE895: ["CO2", "Temperature", "Pressure"],
  "MQ4": ["Methane", "Sensor Resistance"],
  NPK: ["Nitrogen", "Phosphorus", "Potassium"],
};

const tableHeaders = ["Sl.No", "parameter", "Value", "Unit", "Status", "Updated"];

const ALL_POSSIBLE_PARAMETERS = [
  "CO2", "Temperature", "Humidity", "Pressure", "Dew Point",
  "Methane", "Sensor Resistance", "Nitrogen", "Phosphorus",
  "Potassium", "Altitude", "Air Quality", "Voltage", "Current", "Power"
];

export default function SensorPage() {
  const { resolvedTheme } = useTheme();
  const location = useLocation();
  const isDark = resolvedTheme === "dark";

  // Check if we're in Live mode via query parameter
  const isLiveMode = new URLSearchParams(location.search).get("mode") === "live";

  // Theme-aware scrollbar colors
  const scrollbarTrackColor = isDark ? '#1f2937' : '#f1f5f9';
  const scrollbarThumbColor = isDark ? '#4b5563' : '#94a3b8';
  const scrollbarThumbHoverColor = isDark ? '#6b7280' : '#64748b';
  const scrollbarColor = isDark ? '#4b5563 #1f2937' : '#94a3b8 #f1f5f9';

  const [devices, setDevices] = useState<string[]>([]);
  const [activeDevice, setActiveDevice] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: LIMIT,
    totalRecords: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedParams, setSelectedParams] = useState<string[]>([]);
  // Use a Ref for the polling closure to always see the latest selection
  const selectedParamsRef = useRef<string[]>([]);
  const currentPageRef = useRef<number>(1);

  useEffect(() => {
    selectedParamsRef.current = selectedParams;
  }, [selectedParams]);

  useEffect(() => {
    currentPageRef.current = pagination.page;
  }, [pagination.page]);

  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [availableParams, setAvailableParams] = useState<string[]>([]);

  // Ref for live mode polling interval
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Store all fetched data for client-side pagination in live mode
  const [allLiveData, setAllLiveData] = useState<Row[]>([]);
  // Store all fetched data for PDF download in recorded mode
  const [allRecordedData, setAllRecordedData] = useState<Row[]>([]);

  const tableRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  useScrollLock(isDropdownOpen);


  // console.log(rows, "rows")
  // console.log(activeDevice, "activeDevice")
  // console.log(chartRows, "chartRows")
  // console.log(pagination, "chartRows")
  // console.log(selectedParams, "selectedParams")
  // console.log(dateRange, "dateRange")



  const fallbackParams =
    SENSOR_PARAMETERS[activeDevice.trim() as keyof typeof SENSOR_PARAMETERS] || [];


  const buildQueryParams = (
    page: number,
    limit = LIMIT,
    overrides: SensorQueryParams = {},
    options?: { ignoreDateFilters?: boolean }
  ): SensorQueryParams => {
    const { ignoreDateFilters = false } = options ?? {};
    // Always guarantee a 1-hour window in live mode, even if state was cleared
    let liveRange = { from: from || undefined, to: to || undefined };
    if (isLiveMode) {
      const { from: liveFrom, to: liveTo } = getLastHourRange();
      liveRange = {
        from: from || liveFrom,
        to: to || liveTo,
      };
      // Sync state if it was empty to keep UI consistent
      if (!from && !to) {
        setFrom(liveFrom);
        setTo(liveTo);
        setDateRange({ from: liveFrom, to: liveTo });
      }
    }

    return {
      page,
      // Use the provided limit (defaults to LIMIT=10 for pagination)
      limit: limit,
      names:
        overrides.names ??
        (selectedParams.length ? selectedParams : undefined),
      // If overrides are provided, use them; otherwise check ignoreDateFilters flag
      from: overrides.from !== undefined
        ? overrides.from
        : (ignoreDateFilters ? undefined : (liveRange.from)),
      to: overrides.to !== undefined
        ? overrides.to
        : (ignoreDateFilters ? undefined : (liveRange.to)),
    };
  };

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const result = await deviceApi.getAll();
        const names = result.map((device) => device.name);
        setDevices(names);
        if (names.length > 0) {
          setActiveDevice(names[0]);
        }
      } catch (err) {
        console.error("Failed to load devices", err);
        setDevices(["EE872", "EE895", "MQ4", "NPK"]); // fallback
        setActiveDevice("EE872");
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

  // When toggling live mode, always reset to last hour window
  useEffect(() => {
    if (!isLiveMode) return;
    const { from: from1h, to: to1h } = getLastHourRange();
    setFrom(from1h);
    setTo(to1h);
    setDateRange({ from: from1h, to: to1h });
  }, [isLiveMode]);

  // Parameter Discovery & Live Polling Setup
  useEffect(() => {
    if (!activeDevice) return;

    // In Live mode, auto-set to last 1 hour
    if (isLiveMode) {
      const { from: from1h, to: to1h } = getLastHourRange();
      setFrom(from1h);
      setTo(to1h);
      setDateRange({ from: from1h, to: to1h });
    } else {
      setFrom("");
      setTo("");
      setDateRange({ from: "", to: "" });
    }

    const initialParams = Array.from(new Set([...fallbackParams, ...ALL_POSSIBLE_PARAMETERS]));
    setAvailableParams(initialParams);
    setSelectedParams([]);

    // Discovery: Fetch a larger batch initially to discover all available parameters
    const discoverParams = async () => {
      try {
        const queryParams = isLiveMode
          ? buildQueryParams(1, LIVE_LIMIT, { names: undefined }, { ignoreDateFilters: true })
          : buildQueryParams(1, 1000, { names: undefined, from: undefined, to: undefined });

        const response = await dataApi.fetchSensorData(activeDevice, queryParams);
        const discoveredRows = Array.isArray(response.parameters) ? response.parameters : [];

        if (discoveredRows.length > 0) {
          const discoveredNames = Array.from(new Set(discoveredRows.map(r => r.name || (r as any).parameter)));
          setAvailableParams(prev => {
            const merged = Array.from(new Set([...prev, ...discoveredNames]));
            return merged;
          });
        }
      } catch (err) {
        console.error("Discovery failed", err);
      }
    };

    discoverParams();
    fetchTableData(1);

    // Setup polling for Live mode
    if (isLiveMode) {
      liveIntervalRef.current = setInterval(() => {
        fetchTableData(undefined, true);
      }, LIVE_POLL_INTERVAL);
    }

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    };
  }, [activeDevice, isLiveMode]);

  // Handle manual refetch when time range or parameters change
  useEffect(() => {
    if (!activeDevice) return;
    setPagination(p => ({ ...p, page: 1 }));
    // In Live Mode, we ignore date picking, but hitting this effect will force an immediate poll and client-side filter.
    // In Recorded Mode, it triggers a normal server filtered request.
    fetchTableData(1);
  }, [from, to, selectedParams.join(",")]);

  // Helper function to fetch all pages for PDF download in recorded mode
  const fetchAllPagesForPDF = async (
    device: string,
    baseQueryParams: SensorQueryParams,
    totalRecords: number
  ): Promise<Row[]> => {
    try {
      const allRows: Row[] = [];
      const PDF_FETCH_LIMIT = 1000;
      const totalPagesToFetch = Math.ceil(totalRecords / PDF_FETCH_LIMIT);

      const batchSize = 3;
      const pages = Array.from({ length: totalPagesToFetch }, (_, i) => i + 1);

      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const batchPromises = batch.map(pageNum =>
          dataApi.fetchSensorData(device, { ...baseQueryParams, page: pageNum, limit: PDF_FETCH_LIMIT })
        );
        const batchResponses = await Promise.all(batchPromises);

        batchResponses.forEach(response => {
          const responseRows = Array.isArray(response.parameters) ? response.parameters : [];
          allRows.push(...responseRows);
        });
      }

      // Sort by created_at descending (most recent first)
      const sortedRows = allRows.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      setAllRecordedData(sortedRows);
      return sortedRows;
    } catch (err: any) {
      console.error("Error fetching all pages for PDF:", err);
      throw err;
    }
  };

  const fetchTableData = async (pageArg?: number, isPolling = false) => {
    // If no pageArg is provided (e.g. from polling), use the latest page from the Ref
    const page = pageArg ?? currentPageRef.current;
    if (!activeDevice) return;
    if (!isPolling) {
      setLoading(true);
    }
    setError(null);

    try {
      let dataRows: Row[] = [];
      // Use latest selection from Ref for the filter
      const currentFilters = selectedParamsRef.current;

      if (isLiveMode) {
        // In Live Mode: Fetch a larger batch of latest data to ensure all parameters are covered
        // We fetch without 'names' filter to ensure new parameters are discovered dynamically
        const queryParams = buildQueryParams(1, LIVE_LIMIT, { names: undefined }, { ignoreDateFilters: true });

        const response = await dataApi.fetchSensorData(activeDevice, queryParams);
        const allFetchedRows = Array.isArray(response.parameters) ? response.parameters : [];

        // Dynamic Discovery: Update available parameters from the raw data stream itself
        if (allFetchedRows.length > 0) {
          const discoveredNames = Array.from(new Set(allFetchedRows.map(r => r.name)));
          setAvailableParams(prev => {
            const merged = Array.from(new Set([...prev, ...discoveredNames, ...fallbackParams]));
            return merged.length !== prev.length ? merged : prev;
          });
        }

        // Group rows by parameter name and limit to latest 50 each
        const groupedMap = new Map<string, Row[]>();
        allFetchedRows.forEach(row => {
          if (!groupedMap.has(row.name)) groupedMap.set(row.name, []);
          if (groupedMap.get(row.name)!.length < LIVE_RECORDS_PER_PARAM) {
            groupedMap.get(row.name)!.push(row);
          }
        });

        // Construct pool based on current selection
        const filteredPool = Array.from(groupedMap.entries())
          .filter(([name]) => currentFilters.length === 0 || currentFilters.includes(name))
          .flatMap(([, items]) => items)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Update allLiveData for PDF reporting parity
        setAllLiveData(filteredPool);

        // Apply pagination to the curated pool
        const startIndex = (page - 1) * LIVE_PAGE_LIMIT;
        const paginatedRows = filteredPool.slice(startIndex, startIndex + LIVE_PAGE_LIMIT);

        dataRows = paginatedRows;
        setRows(dataRows);
        setPagination({
          page: page,
          limit: LIVE_PAGE_LIMIT,
          totalRecords: filteredPool.length,
          totalPages: Math.ceil(filteredPool.length / LIVE_PAGE_LIMIT) || 1,
        });
      } else {
        // Recorded Mode: Use server-side pagination for the table view
        const queryParams = buildQueryParams(page, LIMIT);

        const response = await dataApi.fetchSensorData(
          activeDevice,
          queryParams
        );

        dataRows = Array.isArray(response.parameters)
          ? response.parameters
          : [];

        setRows(dataRows);

        // Fix pagination response
        const serverPage = response.pagination?.page ?? page;
        const serverLimit = response.pagination?.limit ?? LIMIT;
        const serverTotalRecords = response.pagination?.totalRecords ?? 0;
        const serverTotalPages = response.pagination?.totalPages ?? 1;

        setPagination({
          page: serverPage,
          limit: serverLimit,
          totalRecords: serverTotalRecords,
          totalPages: serverTotalPages > 0 ? serverTotalPages : 1,
        });

        // For PDF download: handle "latest 100 per parameter" by default or use selected range
        if (page === 1) {
          const hasDateFilter = Boolean(from || to);

          if (!hasDateFilter) {
            // DEFAULT MODE: Fetch latest 1000 total to derive latest 100 per parameter
            const defaultPDFQuery = buildQueryParams(1, 1000, { names: undefined, from: undefined, to: undefined });
            dataApi.fetchSensorData(activeDevice, defaultPDFQuery).then(res => {
              const resRows = Array.isArray(res.parameters) ? res.parameters : [];
              const grouped = new Map<string, Row[]>();
              resRows.forEach(row => {
                const pName = row.name || (row as any).parameter;
                if (!grouped.has(pName)) grouped.set(pName, []);
                if (grouped.get(pName)!.length < 100) {
                  grouped.get(pName)!.push(row);
                }
              });
              const pool = Array.from(grouped.values()).flat();
              setAllRecordedData(pool);
            }).catch(console.error);
          } else {
            // RANGE MODE: fetch everything in that range
            if (serverTotalPages > 1) {
              // Now uses serverTotalRecords for accurate count
              fetchAllPagesForPDF(activeDevice, queryParams, serverTotalRecords).catch(err => {
                console.error("Error fetching range data for PDF:", err);
                setAllRecordedData(dataRows);
              });
            } else {
              setAllRecordedData(dataRows);
            }
          }
        }
      }
    } catch (err: any) {
      console.error("Error fetching table data:", err);
      setError(err?.message || "Failed to fetch data");
      setRows([]);
      setPagination({
        page: 1,
        limit: LIMIT,
        totalRecords: 0,
        totalPages: 1,
      });
    } finally {
      if (!isPolling) {
        setLoading(false);
      }
    }
  };


  const badgeClass = (status: string) => {
    switch (status) {
      case "normal":
        return "bg-emerald-500/20 dark:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400";
      case "warning":
        return "bg-amber-500/20 dark:bg-amber-500/30 text-amber-600 dark:text-amber-400";
      case "critical":
      case "error":
        return "bg-destructive/20 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleDateRangeChange = (range: { from: string; to: string }) => {
    setDateRange(range);
    setFrom(range.from);
    setTo(range.to);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const renderedRows = useMemo(
    () =>
      rows.map((row, index) => (
        <tr
          key={row.id}
          className={`bg-card hover:bg-accent transition-colors duration-150 border-b border-border ${index > 0 ? "border-t" : ""
            }`}
        >
          <td className="px-4 sm:px-6 py-3 text-center text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
            {(pagination.page - 1) * pagination.limit + index + 1}
          </td>
          <td
            className="px-4 sm:px-6 py-3 text-center text-xs sm:text-sm font-medium text-foreground whitespace-nowrap max-w-[220px] truncate"
            title={row.name || (row as any).parameter}
          >
            {row.name || (row as any).parameter}
          </td>
          <td className="px-4 sm:px-6 py-3 text-center text-xs sm:text-sm font-medium text-foreground whitespace-nowrap">
            {row.value}
          </td>
          <td
            className="px-4 sm:px-6 py-3 text-center text-xs sm:text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap max-w-[120px] truncate"
            title={row.unit}
          >
            {row.unit}
          </td>
          <td className="px-4 sm:px-6 py-3 text-center hidden sm:table-cell whitespace-nowrap">
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${badgeClass(
                row.status
              )}`}
            >
              {row.status.toUpperCase()}
            </span>
          </td>
          <td
            className="px-4 sm:px-6 py-3 text-center text-xs sm:text-sm text-muted-foreground hidden lg:table-cell whitespace-nowrap max-w-[240px] truncate"
            title={formatDateTime(row.created_at)}
          >
            {formatDateTime(row.created_at)}
          </td>
        </tr>
      )),
    [rows, pagination]
  );

  const paginationNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= pagination.totalPages; i += 1) {
      if (
        i === 1 ||
        i === pagination.totalPages ||
        (i >= pagination.page - 1 && i <= pagination.page + 1)
      ) {
        pages.push(i);
      }
    }
    return pages;
  }, [pagination]);

  // Filter devices based on search query
  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) {
      return devices;
    }
    return devices.filter((device) =>
      device.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [devices, searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dropdownElement = document.querySelector('[data-dropdown-portal]') as HTMLElement;

      // Check if click is outside both the button and the portal dropdown
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        dropdownElement &&
        !dropdownElement.contains(target)
      ) {
        setIsDropdownOpen(false);
        setSearchQuery("");
      }
    };

    const measure = () => {
      if (dropdownButtonRef.current) {
        const rect = dropdownButtonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,        // viewport-relative (fixed positioning)
          left: rect.left,
          width: rect.width
        });
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [isDropdownOpen]);


  return (
    <>
      <style>{`
        .sensor-dropdown-scrollbar::-webkit-scrollbar {
          width: 8px;
          display: block;
        }
        .sensor-dropdown-scrollbar::-webkit-scrollbar-track {
          background: ${scrollbarTrackColor};
          border-radius: 4px;
        }
        .sensor-dropdown-scrollbar::-webkit-scrollbar-thumb {
          background: ${scrollbarThumbColor};
          border-radius: 4px;
        }
        .sensor-dropdown-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${scrollbarThumbHoverColor};
        }
        .sensor-dropdown-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: ${scrollbarColor};
        }
        
        /* Filter bar alignment improvements */
        .filter-bar-container {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          position: relative;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          overflow-x: hidden;
          overflow-y: visible;
        }
        
        @media (min-width: 1024px) {
          .filter-bar-container {
            flex-wrap: nowrap;
            align-items: center;
            justify-content: space-between;
          }
        }
        
        /* Ensure proper spacing and alignment */
        .sensor-dropdown-wrapper {
          min-width: 0;
          flex-shrink: 0;
          max-width: 100%;
          align-self: center;
          overflow: visible;
          position: relative;
        }
        
        @media (max-width: 1023px) {
          .sensor-dropdown-wrapper {
            width: 100%;
          }
        }
        
        @media (min-width: 1024px) {
          .sensor-dropdown-wrapper {
            flex-shrink: 0;
            min-width: 240px;
            max-width: 280px;
          }
        }
        
        /* Uniform alignment for filter elements */
        .filter-bar-container > * {
          min-width: 0;
          max-width: 100%;
          box-sizing: border-box;
        }
        
        /* Ensure labels are on same baseline with proper spacing */
        .date-filter-label {
          line-height: 1.2;
          display: block;
          top: -0.5rem;
        }
        
        /* Ensure dropdown is above other elements */
        .sensor-dropdown-wrapper {
          position: relative;
          z-index: 1000;
        }
        
        .sensor-dropdown-wrapper > div[class*="absolute"] {
          position: absolute !important;
          z-index: 1001 !important;
        }
        
        /* Table scrollbar styles */
        .sensor-table-container {
          overflow-x: auto;
          overflow-y: auto;
          max-height: calc(100vh - 320px);
          position: relative;
          isolation: isolate;
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }
        
        @media (max-width: 640px) {
          .sensor-table-container {
            max-height: calc(100vh - 360px);
          }
        }
        
        @media (min-width: 1024px) {
          .sensor-table-container {
            max-height: calc(100vh - 280px);
          }
        }
        
        .sensor-table-container::-webkit-scrollbar {
          width: 12px;
          height: 12px;
          display: block;
        }
        
        .sensor-table-container::-webkit-scrollbar-track {
          background: ${scrollbarTrackColor};
          border-radius: 6px;
        }
        
        .sensor-table-container::-webkit-scrollbar-thumb {
          background: ${scrollbarThumbColor};
          border-radius: 6px;
          border: 2px solid ${scrollbarTrackColor};
        }
        
        .sensor-table-container::-webkit-scrollbar-thumb:hover {
          background: ${scrollbarThumbHoverColor};
        }
        
        .sensor-table-container {
          scrollbar-width: thin;
          scrollbar-color: ${scrollbarColor};
        }
        
        /* Sensor dropdown scrollbar styles */
        .sensor-dropdown-list::-webkit-scrollbar {
          width: 8px;
          display: block;
        }
        .sensor-dropdown-list::-webkit-scrollbar-track {
          background: ${scrollbarTrackColor};
          border-radius: 4px;
        }
        .sensor-dropdown-list::-webkit-scrollbar-thumb {
          background: ${scrollbarThumbColor};
          border-radius: 4px;
        }
        .sensor-dropdown-list::-webkit-scrollbar-thumb:hover {
          background: ${scrollbarThumbHoverColor};
        }
        .sensor-dropdown-list {
          scrollbar-width: thin;
          scrollbar-color: ${scrollbarColor};
        }
        
        /* Parameter filter dropdown scrollbar styles */
        .parameter-filter-dropdown::-webkit-scrollbar {
          width: 8px;
          display: block;
        }
        .parameter-filter-dropdown::-webkit-scrollbar-track {
          background: ${scrollbarTrackColor};
          border-radius: 4px;
        }
        .parameter-filter-dropdown::-webkit-scrollbar-thumb {
          background: ${scrollbarThumbColor};
          border-radius: 4px;
        }
        .parameter-filter-dropdown::-webkit-scrollbar-thumb:hover {
          background: ${scrollbarThumbHoverColor};
        }
        .parameter-filter-dropdown {
          scrollbar-width: thin;
          scrollbar-color: ${scrollbarColor};
        }
      `}</style>
      {/* <div className="w-full max-w-full p-4 sm:p-5 lg:p-6 xl:p-8 bg-white border border-gray-200 rounded-lg space-y-4 sm:space-y-5 lg:space-y-6 shadow-lg overflow-visible box-border"> */}
      <div className="w-full max-w-full p-4 sm:p-5 lg:p-6 xl:p-8 bg-card border border-border rounded-lg space-y-4 sm:space-y-5 lg:space-y-6 shadow-lg overflow-visible box-border">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-5 lg:mb-6 w-full">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground truncate">{isLiveMode ? "Sensor Live Data" : "Sensor Table"}</h1>
          {isLiveMode && allLiveData.length > 0 && (
            <div className="flex flex-col sm:items-end gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">
                  ({allLiveData.length} records)
                </span>
              </div>
              <div className="text-xs sm:text-sm">
                From {formatDateTime(allLiveData[allLiveData.length - 1]?.created_at)} To {formatDateTime(allLiveData[0]?.created_at)}
              </div>
            </div>
          )}
        </div>



        {/* Filters */}
        <div className="filter-bar-container pt-5 sm:pt-5 pb-3 sm:pb-4 px-3 sm:px-4 flex flex-col lg:flex-row gap-3 sm:gap-4 lg:gap-6 items-start lg:items-center bg-card rounded-lg shadow-lg w-full max-w-full overflow-x-hidden overflow-y-visible box-border">
          {/* Searchable Sensor Dropdown - Left aligned */}
          <div className="sensor-dropdown-wrapper w-[300px] lg:w-auto lg:min-w-[200px] lg:max-w-[400px] relative min-w-0 flex-shrink-0" ref={dropdownRef}>
            <label className="absolute -top-2 left-3 bg-card px-1 text-xs font-medium text-foreground date-filter-label z-20 pointer-events-none">Select Sensor</label>
            <div className="relative w-full">
              <button
                ref={dropdownButtonRef}
                type="button"
                onClick={() => {
                  if (dropdownButtonRef.current) {
                    const rect = dropdownButtonRef.current.getBoundingClientRect();
                    setDropdownPosition({
                      top: rect.bottom + 4,   // viewport-relative; no scrollY for fixed positioning
                      left: rect.left,
                      width: rect.width
                    });
                  }
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className="w-[200px] h-9 sm:h-10 flex items-center justify-between gap-2 px-3 sm:px-4 text-sm font-semibold bg-background border-2 border-input rounded-md shadow-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors min-w-0"
                aria-label="Select sensor"
                aria-expanded={isDropdownOpen}
                aria-haspopup="listbox"
              >
                <span className={`${activeDevice ? "text-foreground font-medium" : "text-muted-foreground"} truncate flex-1 text-left min-w-0`}>
                  {activeDevice || "Select a sensor"}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${isDropdownOpen ? "transform rotate-180" : ""
                    }`}
                />
              </button>

              {isDropdownOpen && createPortal(
                <div
                  data-dropdown-portal
                  className="fixed z-[9999] bg-popover border-2 border-border rounded-lg shadow-xl sensor-dropdown-list"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`,
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Search */}
                  <div className="relative p-0 h-9 border-b border-border rounded-t-lg bg-popover sticky top-0 z-10" onClick={(e) => e.stopPropagation()}>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search sensors..."
                      value={searchQuery}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSearchQuery(e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-9 pl-10 pr-10 text-sm border-0 rounded-t-lg focus:outline-none focus:ring-0 bg-popover text-popover-foreground placeholder:text-muted-foreground"
                      autoFocus
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSearchQuery("");
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground z-10 cursor-pointer"
                        aria-label="Clear search"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Device List */}
                  <div className="rounded-b-lg">
                    {devices.length === 0 ? (
                      <div className="px-4 py-3 text-muted-foreground text-sm text-center">
                        Loading devices...
                      </div>
                    ) : filteredDevices.length === 0 ? (
                      <div className="px-4 py-3 text-muted-foreground text-sm text-center">
                        No sensors found matching "{searchQuery}"
                      </div>
                    ) : (
                      filteredDevices.map((device) => (
                        <button
                          key={device}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveDevice(device);
                            setIsDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className={`w-full text-left px-4 py-3 text-sm sm:text-base font-medium transition-colors cursor-pointer ${activeDevice === device
                            ? "bg-primary/10 text-primary border-l-4 border-primary font-semibold"
                            : "text-foreground hover:bg-accent"
                            }`}
                          role="option"
                          aria-selected={activeDevice === device}
                        >
                          {device}
                        </button>
                      ))
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Center-aligned Date Filters - Hidden in Live Mode */}
          {!isLiveMode && (
            <div className="flex-1 flex justify-center min-w-0 px-2 lg:px-2 flex-shrink-1 overflow-visible">
              <TimeDateFilter
                from={from}
                to={to}
                setFrom={setFrom}
                setTo={setTo}
                clearAllFilters={() => {
                  setFrom("");
                  setTo("");
                  setDateRange({ from: "", to: "" });
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
          )}

          {/* Action Icons - Right aligned */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 sm:gap-2.5 flex-shrink-0 min-w-0 w-full lg:w-auto justify-end lg:justify-start">


            <CheckboxFilter
              availableParams={availableParams}
              names={selectedParams}
              toggle={(name) =>
                setSelectedParams((prev) =>
                  prev.includes(name)
                    ? prev.filter((item) => item !== name)
                    : [...prev, name]
                )
              }
              selectAll={() => setSelectedParams([...availableParams])}
              unselectAll={() => setSelectedParams([])}
              isAllSelected={
                selectedParams.length === availableParams.length &&
                availableParams.length > 0
              }
              isNoneSelected={selectedParams.length === 0}
              showTags={false}
            />
            <DownloadButton
              load={loading}
              active={activeDevice}
              names={selectedParams}
              from={from}
              to={to}
              chartRef={tableRef}
              fallbackData={isLiveMode ? allLiveData : (allRecordedData.length > 0 ? allRecordedData : rows)}
              fetchAllData={
                !isLiveMode
                  ? async () => {
                    if (!activeDevice) return [];
                    const queryParams = buildQueryParams(1, LIMIT);
                    return await fetchAllPagesForPDF(activeDevice, queryParams, pagination.totalRecords);
                  }
                  : undefined
              }
            />




          </div>
        </div>

        {/* Table */}
        {loading && rows.length === 0 ? (
          <div className="flex justify-center items-center py-12">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              <span className="text-muted-foreground text-base">Loading sensor data...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-destructive/20 border border-destructive/50 text-destructive px-4 py-3 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <span className="text-base">Error: {error}</span>
              <button
                onClick={() => fetchTableData(pagination.page)}
                className="text-destructive underline hover:no-underline text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={tableRef}
            className={`bg-card border border-border rounded-md shadow-lg overflow-hidden w-full max-w-full box-border relative ${loading ? "opacity-60 pointer-events-none" : ""
              }`}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/40 z-10">
                <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-card border border-border shadow">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              </div>
            )}
            <div className="sensor-table-container w-full max-w-full">
              <table className="w-full table-fixed border-separate border-spacing-0 max-w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    {tableHeaders.map((header) => (
                      <th
                        key={header}
                        // className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider whitespace-nowrap ${
                        className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold text-foreground uppercase tracking-wider whitespace-nowrap sticky top-0 z-30 bg-muted border-b border-border text-center ${header === "Status" ? "hidden sm:table-cell" : ""
                          } ${header === "Unit" ? "hidden sm:table-cell" : ""} ${header === "Updated" ? "hidden lg:table-cell" : ""
                          } ${header === "Sl.No" ? "w-16" : ""
                          } ${header === "parameter" ? "w-[220px]" : ""} ${header === "Value" ? "w-28" : ""
                          } ${header === "Unit" ? "w-24" : ""} ${header === "Status" ? "w-32" : ""
                          } ${header === "Updated" ? "w-56" : ""}`}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-card">
                  {rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 sm:px-6 py-12 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <ImFilesEmpty className="text-3xl text-muted-foreground" />
                          <p className="text-lg font-medium text-foreground">
                            No Data Available
                          </p>
                          {(from || to || selectedParams.length > 0) && (
                            <span className="text-sm text-primary">
                              Try adjusting your filters or clear them to see all data.
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    renderedRows
                  )}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex justify-end items-center shadow-md p-3 border-t border-border rounded-b-md gap-2 bg-card">
                <button
                  onClick={() => {
                    if (!isLiveMode && loading) return;
                    const prevPage = Math.max(1, pagination.page - 1);
                    if (isLiveMode) {
                      // Use fetchTableData logic for slice/pagination
                      setPagination((p) => ({ ...p, page: prevPage }));
                      fetchTableData(prevPage, true); // true avoids loading spinner
                    } else {
                      setPagination((p) => ({ ...p, page: prevPage }));
                      fetchTableData(prevPage);
                    }
                  }}
                  disabled={pagination.page === 1 || (!isLiveMode && loading)}
                  className={`px-3 py-2 rounded-sm transition-colors font-medium ${pagination.page === 1 || (!isLiveMode && loading)
                    ? "text-muted-foreground cursor-not-allowed bg-muted opacity-50"
                    : "text-foreground hover:bg-accent hover:text-primary bg-background border border-border"
                    }`}
                  aria-label="Previous page"
                >
                  <MdArrowBackIosNew />
                </button>

                <div className="flex items-center gap-2">
                  {paginationNumbers.map((pageNumber, index, array) => {
                    const prev = array[index - 1];
                    const showDots = prev && pageNumber - prev > 1;
                    return (
                      <React.Fragment key={pageNumber}>
                        {showDots && <span className="px-2 text-muted-foreground font-medium">...</span>}
                        <button
                          onClick={() => {
                            if (!isLiveMode && loading) return;
                            if (isLiveMode) {
                              setPagination((p) => ({ ...p, page: pageNumber }));
                              fetchTableData(pageNumber, true);
                            } else {
                              setPagination((p) => ({ ...p, page: pageNumber }));
                              fetchTableData(pageNumber);
                            }
                          }}
                          disabled={!isLiveMode && loading}
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors min-w-[2.5rem] ${pagination.page === pageNumber
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-background text-foreground hover:bg-accent hover:text-primary border border-border"
                            } ${!isLiveMode && loading ? "opacity-50 cursor-not-allowed" : ""}`}
                          aria-label={`Go to page ${pageNumber}`}
                          aria-current={pagination.page === pageNumber ? "page" : undefined}
                        >
                          {pageNumber}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>

                <button
                  onClick={() => {
                    if (!isLiveMode && loading) return;
                    const nextPage = Math.min(
                      pagination.totalPages,
                      pagination.page + 1
                    );
                    if (isLiveMode) {
                      setPagination((p) => ({ ...p, page: nextPage }));
                      fetchTableData(nextPage, true);
                    } else {
                      setPagination((p) => ({ ...p, page: nextPage }));
                      fetchTableData(nextPage);
                    }
                  }}
                  disabled={pagination.page === pagination.totalPages || (!isLiveMode && loading)}
                  className={`px-3 py-2 rounded-sm transition-colors font-medium ${pagination.page === pagination.totalPages || (!isLiveMode && loading)
                    ? "text-muted-foreground cursor-not-allowed bg-muted opacity-50"
                    : "text-foreground hover:bg-accent hover:text-primary bg-background border border-border"
                    }`}
                  aria-label="Next page"
                >
                  <MdOutlineArrowForwardIos />
                </button>
              </div >
            )
            }
          </div >
        )
        }
      </div >
    </>
  );
}

