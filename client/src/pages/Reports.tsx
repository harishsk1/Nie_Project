import React, { useEffect, useState, useRef, useCallback } from "react";
import { useScrollLock } from "../hooks/useScrollLock";
import { createPortal } from "react-dom";
import jsPDF from "jspdf";
import { formatDateTime as formatDateTimeStandard } from "../utils/dateTime";
import { deviceApi } from "../api/deviceApi";
import { dataApi } from "../api/dataApi";
import { FileText, Download, Calendar, TrendingUp, ChevronDown, Search, X, Check } from "lucide-react";
import TimeDateFilter from "../components/TimeDateFilter";

interface ReportData {
  deviceName: string;
  totalRecords: number;
  latestUpdate: string;
  parameters: Array<{
    name: string;
    avgValue: number;
    minValue: number;
    maxValue: number;
    unit: string;
  }>;
}

interface MultiDeviceReportData {
  devices: Array<{
    deviceName: string;
    totalRecords: number;
    latestUpdate: string;
    parameters: Array<{
      name: string;
      avgValue: number;
      minValue: number;
      maxValue: number;
      unit: string;
      latestUpdate: string;
      totalEntries: number;
    }>;
  }>;
  totalRecords: number;
  totalParameters: number;
}

export default function Reports() {
  const [devices, setDevices] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [reportData, setReportData] = useState<MultiDeviceReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownButtonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Download dropdown state
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const downloadButtonRef = useRef<HTMLDivElement>(null);
  const downloadDropdownRef = useRef<HTMLDivElement>(null);
  const [downloadDropdownPos, setDownloadDropdownPos] = useState({ top: 0, left: 0 });

  useScrollLock(isDropdownOpen || showDownloadDropdown);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const result = await deviceApi.getAll();
        setDevices(result);
        // Select all devices by default
        if (result.length > 0 && selectedDevices.length === 0) {
          setSelectedDevices(result.map((device) => device.name));
        }
      } catch (err) {
        console.error("Failed to load devices", err);
      }
    };
    loadDevices();
  }, []);

  // Filter devices based on search query
  const filteredDevices = devices.filter((device) =>
    device.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const dropdownElement = document.querySelector('[data-reports-dropdown-portal]') as HTMLElement;

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
          top: rect.bottom + 4,   // viewport-relative
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

  // Position download dropdown
  useEffect(() => {
    if (showDownloadDropdown && downloadButtonRef.current) {
      const rect = downloadButtonRef.current.getBoundingClientRect();
      setDownloadDropdownPos({
        top: rect.bottom + 4,        // viewport-relative; no scrollY
        left: rect.right - 192,
      });
    }
  }, [showDownloadDropdown]);

  // Close download dropdown on outside click + reposition on scroll
  useEffect(() => {
    if (!showDownloadDropdown) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (downloadButtonRef.current && downloadButtonRef.current.contains(target)) return;
      if (downloadDropdownRef.current && downloadDropdownRef.current.contains(target)) return;
      setShowDownloadDropdown(false);
    };
    const updatePos = () => {
      if (downloadButtonRef.current) {
        const rect = downloadButtonRef.current.getBoundingClientRect();
        setDownloadDropdownPos({ top: rect.bottom + 4, left: rect.right - 192 });
      }
    };
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [showDownloadDropdown]);

  const generateReport = useCallback(async () => {
    if (selectedDevices.length === 0) return;
    setLoading(true);
    try {
      // Don't use aggregation for reports - we need raw data for accurate statistics
      const baseParams: any = {
        limit: 1000, // Max allowed by backend
        // No interval - fetch raw data for accurate min/max/avg calculations
      };
      if (dateRange.from) baseParams.from = dateRange.from;
      if (dateRange.to) baseParams.to = dateRange.to;

      // Fetch data for all selected devices in parallel
      const deviceReports = await Promise.all(
        selectedDevices.map(async (deviceName) => {
          // OPTIMIZATION: Fetch multiple pages in parallel instead of sequentially
          // First, get total pages to know how many requests we need
          let firstResponse;
          try {
            firstResponse = await dataApi.fetchSensorData(deviceName, {
              ...baseParams,
              page: 1,
            });
          } catch (err) {
            console.error(`Error fetching data for ${deviceName}:`, err);
            return {
              deviceName,
              totalRecords: 0,
              latestUpdate: "N/A",
              parameters: [],
            };
          }

          const firstParameters = Array.isArray(firstResponse.parameters)
            ? firstResponse.parameters
            : [];

          const pagination = firstResponse.pagination;
          const totalPages = pagination?.totalPages ?? 1;
          const deviceTotalRecords = pagination?.totalRecords ?? firstParameters.length;

          // OPTIMIZATION: For large datasets, limit to first 10 pages to prevent excessive requests
          // This ensures reports load quickly. For full reports, consider adding a "Load All" option.
          const maxPagesToFetch = Math.min(totalPages, 10);
          const pagesToFetch = maxPagesToFetch > 1
            ? Array.from({ length: maxPagesToFetch - 1 }, (_, i) => i + 2) // Pages 2, 3, 4...
            : [];

          // Fetch remaining pages in parallel (batched for performance)
          const batchSize = 5; // Fetch 5 pages at a time
          let allParameters = [...firstParameters];
          const deviceTimestamps: number[] = []; // Store timestamps as numbers for efficiency

          // Collect timestamps from first page
          firstParameters.forEach((p: any) => {
            if (p.created_at) {
              const ts = new Date(p.created_at).getTime();
              if (!isNaN(ts)) deviceTimestamps.push(ts);
            }
          });

          // Fetch remaining pages in batches
          for (let i = 0; i < pagesToFetch.length; i += batchSize) {
            const batch = pagesToFetch.slice(i, i + batchSize);
            const batchResponses = await Promise.all(
              batch.map(page =>
                dataApi.fetchSensorData(deviceName, {
                  ...baseParams,
                  page,
                }).catch(err => {
                  console.error(`Error fetching page ${page} for ${deviceName}:`, err);
                  return { parameters: [], pagination: null };
                })
              )
            );

            batchResponses.forEach(response => {
              const parameters = Array.isArray(response.parameters) ? response.parameters : [];
              allParameters = allParameters.concat(parameters);

              // Collect timestamps efficiently
              parameters.forEach((p: any) => {
                if (p.created_at) {
                  const ts = new Date(p.created_at).getTime();
                  if (!isNaN(ts)) deviceTimestamps.push(ts);
                }
              });
            });
          }

          const parameters = allParameters;

          // OPTIMIZATION: Single-pass statistics calculation
          const paramStats = new Map<string, {
            values: number[];
            unit: string;
            maxTimestamp: number;
            count: number;
          }>();

          // Single pass through parameters to collect statistics
          parameters.forEach((param: any) => {
            const name = param.name;
            const value = parseFloat(param.value);

            if (!isNaN(value)) {
              if (!paramStats.has(name)) {
                paramStats.set(name, {
                  values: [],
                  unit: param.unit || "",
                  maxTimestamp: 0,
                  count: 0,
                });
              }

              const stats = paramStats.get(name)!;
              stats.values.push(value);
              stats.count += 1;

              // Track latest timestamp efficiently
              if (param.created_at) {
                const ts = new Date(param.created_at).getTime();
                if (!isNaN(ts) && ts > stats.maxTimestamp) {
                  stats.maxTimestamp = ts;
                }
              }
            }
          });

          // Calculate statistics efficiently (using single sort per parameter)
          const reportParams = Array.from(paramStats.entries()).map(([name, stats]) => {
            // Sort only once for min/max
            const sorted = stats.values.sort((a, b) => a - b);
            const sum = stats.values.reduce((a, b) => a + b, 0);

            return {
              name,
              avgValue: sum / stats.values.length,
              minValue: sorted[0],
              maxValue: sorted[sorted.length - 1],
              unit: stats.unit,
              latestUpdate: formatDateTime(
                stats.maxTimestamp > 0 ? new Date(stats.maxTimestamp) : null
              ),
              totalEntries: stats.count,
            };
          });

          // Find latest timestamp efficiently
          const deviceLatestTimestampMs = deviceTimestamps.length > 0
            ? Math.max(...deviceTimestamps)
            : 0;
          const latestUpdate = formatDateTime(
            deviceLatestTimestampMs > 0 ? new Date(deviceLatestTimestampMs) : null
          );

          return {
            deviceName,
            totalRecords: deviceTotalRecords || parameters.length,
            latestUpdate,
            parameters: reportParams,
          };
        })
      );

      // Calculate totals
      const totalRecords = deviceReports.reduce((sum, report) => sum + report.totalRecords, 0);
      // Calculate total parameters: sum of parameter counts for each device
      const totalParameters = deviceReports.reduce((sum, report) => sum + report.parameters.length, 0);

      setReportData({
        devices: deviceReports,
        totalRecords,
        totalParameters,
      });
    } catch (err) {
      console.error("Error generating report:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDevices, dateRange]);

  // Debounce report generation to prevent excessive API calls
  useEffect(() => {
    if (selectedDevices.length === 0) {
      setReportData(null);
      return;
    }

    // Debounce date range changes to avoid too many API calls
    const timeoutId = setTimeout(() => {
      generateReport();
    }, 300); // 300ms debounce for date range changes

    return () => clearTimeout(timeoutId);
  }, [selectedDevices, dateRange, generateReport]);

  const handleExport = () => {
    if (!reportData || reportData.devices.length === 0) return;

    // Helper function to escape CSV values properly
    const escapeCSV = (value: any): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows: string[] = [];

    // Add header
    csvRows.push(["Multi-Device Sensor Report", "", "", "", "", "", "", ""].map(escapeCSV).join(","));
    csvRows.push(["Total Devices", reportData.devices.length.toString(), "", "", "", "", "", ""].map(escapeCSV).join(","));
    csvRows.push(["Total Records", reportData.totalRecords.toString(), "", "", "", "", "", ""].map(escapeCSV).join(","));
    csvRows.push(["Total Parameters", reportData.totalParameters.toString(), "", "", "", "", "", ""].map(escapeCSV).join(","));
    csvRows.push("");

    // Add data for each device
    reportData.devices.forEach((deviceReport) => {
      csvRows.push(["", "", "", "", "", "", "", ""].map(escapeCSV).join(","));
      csvRows.push([`Device: ${deviceReport.deviceName}`, "", "", "", "", "", "", ""].map(escapeCSV).join(","));
      csvRows.push(["Total Records", deviceReport.totalRecords.toString(), "", "", "", "", "", ""].map(escapeCSV).join(","));
      csvRows.push(["Latest Update", deviceReport.latestUpdate, "", "", "", "", "", ""].map(escapeCSV).join(","));
      csvRows.push("");
      csvRows.push(["Sl. No.", "Parameter", "Average", "Min", "Max", "Unit", "Latest Update", "Total Records"].map(escapeCSV).join(","));
      deviceReport.parameters.forEach((p, index) => {
        csvRows.push([
          index + 1,
          p.name,
          p.avgValue.toFixed(2),
          p.minValue.toFixed(2),
          p.maxValue.toFixed(2),
          p.unit,
          p.latestUpdate,
          p.totalEntries,
        ].map(escapeCSV).join(","));
      });
      csvRows.push("");
    });

    // Add UTF-8 BOM for better Excel compatibility
    const BOM = "\uFEFF";
    const csvContent = BOM + csvRows.join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const deviceNames = reportData.devices.map(d => d.deviceName).join("_");
    a.download = `sensor_report_${deviceNames}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleDevice = (deviceName: string) => {
    setSelectedDevices((prev) =>
      prev.includes(deviceName)
        ? prev.filter((name) => name !== deviceName)
        : [...prev, deviceName]
    );
  };

  const selectAllDevices = () => {
    setSelectedDevices(devices.map((d) => d.name));
  };

  const unselectAllDevices = () => {
    setSelectedDevices([]);
  };

  const isAllSelected = selectedDevices.length === devices.length && devices.length > 0;

  const formatDateTime = (date: Date | null) => {
    if (!date || isNaN(date.getTime())) return "N/A";
    return formatDateTimeStandard(date);
  };

  const handleExportPDF = () => {
    if (!reportData || reportData.devices.length === 0) return;

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 12;
    let currentY = margin;
    const exportBg = { r: 248, g: 250, b: 252 }; // light neutral background (matches UI "muted" feel)
    const headerBg = { r: 230, g: 232, b: 235 };

    // Page background (first page)
    pdf.setFillColor(exportBg.r, exportBg.g, exportBg.b);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    const headerFont = () => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(20, 20, 20);
    };

    const subTextFont = () => {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(90, 90, 90);
    };

    const tableHeader = (startY: number) => {
      const headers = ["Sl. No.", "Parameter", "Avg", "Min", "Max", "Unit", "Latest Update", "Total Records"];
      const colWidths = [14, 34, 16, 16, 16, 16, 48, 24];
      const startX = margin;

      pdf.setFillColor(230, 232, 235);
      pdf.rect(startX, startY, pageWidth - 2 * margin, 9, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(20, 20, 20);

      let currentX = startX;
      headers.forEach((header, idx) => {
        const colCenterX = currentX + colWidths[idx] / 2;
        pdf.text(header, colCenterX, startY + 6, { align: "center" });
        currentX += colWidths[idx];
      });

      return { nextY: startY + 9, colWidths, startX };
    };

    const ensureSpace = (needed: number) => {
      if (currentY + needed > pageHeight - margin) {
        pdf.addPage();
        // Page background for each new page
        pdf.setFillColor(exportBg.r, exportBg.g, exportBg.b);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");
        currentY = margin;
      }
    };

    // Title banner (adds top spacing + background for readability)
    currentY += 6;
    pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
    pdf.rect(margin, currentY, pageWidth - 2 * margin, 16, "F");

    headerFont();
    pdf.setFontSize(16);
    pdf.text("Sensor Report", pageWidth / 2, currentY + 11, { align: "center" });
    currentY += 22;

    subTextFont();
    pdf.text(
      `Total Devices: ${reportData.devices.length} | Total Records: ${reportData.totalRecords.toLocaleString()} | Total Parameters: ${reportData.totalParameters}`,
      pageWidth / 2,
      currentY,
      { align: "center" }
    );
    currentY += 10;

    reportData.devices.forEach((device, deviceIdx) => {
      ensureSpace(32);

      // Device header block (sensor name + meta in one background for clean separation)
      currentY += 6; // reduced top margin above sensor block
      pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
      const deviceHeaderHeight = 20;
      const deviceHeaderPadX = 2; // inner padding from the left/right edge
      pdf.rect(margin, currentY, pageWidth - 2 * margin, deviceHeaderHeight, "F");

      headerFont();
      pdf.setFontSize(13);
      // Sensor name (centered)
      pdf.text(`${device.deviceName}`, pageWidth / 2, currentY + 8, { align: "center" });

      subTextFont();
      pdf.setFontSize(10);
      // Meta row inside the same background block
      const metaY = currentY + 16;
      pdf.text(
        `Total Records: ${device.totalRecords.toLocaleString()}`,
        margin + deviceHeaderPadX,
        metaY
      );
      pdf.text(`Latest update: ${device.latestUpdate}`, pageWidth - margin - deviceHeaderPadX, metaY, {
        align: "right",
      });
      currentY += deviceHeaderHeight + 6;

      const { nextY, colWidths, startX } = tableHeader(currentY);
      currentY = nextY;

      const rowHeight = 8;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(20, 20, 20);

      device.parameters.forEach((param, rowIdx) => {
        ensureSpace(rowHeight + 4);
        if (currentY === margin) {
          const headerResult = tableHeader(currentY);
          currentY = headerResult.nextY;
        }

        // alternate row background
        if (rowIdx % 2 === 0) {
          pdf.setFillColor(248, 249, 251);
          pdf.rect(startX, currentY, pageWidth - 2 * margin, rowHeight, "F");
        }

        let currentX = startX;
        const cells = [
          String(rowIdx + 1),
          param.name,
          param.avgValue.toFixed(2),
          param.minValue.toFixed(2),
          param.maxValue.toFixed(2),
          param.unit,
          param.latestUpdate,
          param.totalEntries.toLocaleString(),
        ];

        cells.forEach((cell, idx) => {
          const colCenterX = currentX + colWidths[idx] / 2;
          pdf.text(String(cell), colCenterX, currentY + 5, { align: "center" });
          currentX += colWidths[idx];
        });

        currentY += rowHeight;
      });

      // Spacing between devices
      currentY += 6;

      // Page break between devices if needed
      if (deviceIdx !== reportData.devices.length - 1) {
        ensureSpace(12);
      }
    });

    const dateStamp = new Date().toISOString().split("T")[0];
    pdf.save(`sensor_report_${dateStamp}.pdf`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto min-h-[calc(100vh-3.5rem)] sm:min-h-[calc(100vh-4rem)] bg-background py-8 px-4 sm:px-6 lg:px-8 space-y-8 overflow-x-hidden box-border">
      <style>{`
        .date-filter-label {
          line-height: 1.2;
          display: block;
          top: -0.5rem;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
          <FileText className="text-primary h-8 w-8" />
          Sensor Reports
        </h1>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 sm:p-6 overflow-visible box-border">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 items-start lg:items-center w-full">
          {/* Select Sensor Dropdown */}
          <div className="relative w-full lg:w-auto lg:min-w-[200px] lg:max-w-[300px] flex-shrink-0" ref={dropdownRef}>
            <label className="absolute -top-2 left-3 bg-card px-1 text-xs font-medium text-foreground z-20 pointer-events-none date-filter-label">
              Select Sensor
            </label>
            <div className="relative w-full">
              <button
                ref={dropdownButtonRef}
                type="button"
                onClick={() => {
                  if (dropdownButtonRef.current) {
                    const rect = dropdownButtonRef.current.getBoundingClientRect();
                    setDropdownPosition({
                      top: rect.bottom + 4,   // viewport-relative; no scrollY
                      left: rect.left,
                      width: rect.width
                    });
                  }
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className="w-full h-9 sm:h-10 flex items-center justify-between gap-2 px-3 sm:px-4 text-sm font-semibold bg-background border-2 border-input rounded-md shadow-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors min-w-0"
                aria-label="Select sensor"
                aria-expanded={isDropdownOpen}
                aria-haspopup="listbox"
              >
                <span className={`${selectedDevices.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"} truncate flex-1 text-left min-w-0`}>
                  {selectedDevices.length === 0
                    ? "Select sensors"
                    : selectedDevices.length === 1
                      ? selectedDevices[0]
                      : `${selectedDevices.length} sensors selected`}
                </span>
                <ChevronDown
                  className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${isDropdownOpen ? "transform rotate-180" : ""
                    }`}
                />
              </button>

              {isDropdownOpen && createPortal(
                <div
                  data-reports-dropdown-portal
                  className="fixed z-[9999] bg-popover border-2 border-border rounded-lg shadow-xl"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`,
                    maxHeight: 'calc(100vh - 20px)',
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

                  {/* Select All / Unselect All */}
                  {filteredDevices.length > 0 && (
                    <div className="border-b border-border px-4 py-2 flex items-center justify-between bg-muted/50">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isAllSelected) {
                            unselectAllDevices();
                          } else {
                            selectAllDevices();
                          }
                        }}
                        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        {isAllSelected ? "Unselect All" : "Select All"}
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {selectedDevices.length} of {devices.length} selected
                      </span>
                    </div>
                  )}

                  {/* Device List */}
                  <div className="rounded-b-lg max-h-[300px] overflow-y-auto">
                    {devices.length === 0 ? (
                      <div className="px-4 py-3 text-muted-foreground text-sm text-center">
                        Loading devices...
                      </div>
                    ) : filteredDevices.length === 0 ? (
                      <div className="px-4 py-3 text-muted-foreground text-sm text-center">
                        No sensors found matching "{searchQuery}"
                      </div>
                    ) : (
                      filteredDevices.map((device) => {
                        const isSelected = selectedDevices.includes(device.name);
                        return (
                          <button
                            key={device.id || device.name}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleDevice(device.name);
                            }}
                            className={`w-full text-left px-4 py-3 text-sm sm:text-base font-medium transition-colors cursor-pointer flex items-center gap-3 ${isSelected
                              ? "bg-primary/10 text-primary border-l-4 border-primary font-semibold"
                              : "text-foreground hover:bg-accent"
                              }`}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className={`flex-shrink-0 w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${isSelected
                              ? "bg-primary border-primary"
                              : "border-input bg-background"
                              }`}>
                              {isSelected && (
                                <Check className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                            <span className="flex-1">{device.name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Center-aligned Date Filters */}
          <div className="flex-1 flex justify-center min-w-0 px-2 lg:px-2 flex-shrink-1 overflow-visible">
            <TimeDateFilter
              from={dateRange.from}
              to={dateRange.to}
              setFrom={(value: string | ((prev: string) => string)) => {
                if (typeof value === 'function') {
                  setDateRange(prev => ({ ...prev, from: value(prev.from) }));
                } else {
                  setDateRange(prev => ({ ...prev, from: value }));
                }
              }}
              setTo={(value: string | ((prev: string) => string)) => {
                if (typeof value === 'function') {
                  setDateRange(prev => ({ ...prev, to: value(prev.to) }));
                } else {
                  setDateRange(prev => ({ ...prev, to: value }));
                }
              }}
              clearAllFilters={() => {
                setDateRange({ from: "", to: "" });
              }}
            />
          </div>
          {reportData && (
            <div ref={downloadButtonRef} className="w-full lg:w-auto mt-4 lg:mt-0 flex-shrink-0">
              <button
                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                className="w-full lg:w-auto inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-5 gap-2 shadow-sm"
              >
                <Download className="h-4 w-4" />
                <span>Export Data</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${showDownloadDropdown ? "rotate-180" : ""}`} />
              </button>

              {/* Download dropdown rendered via portal */}
              {showDownloadDropdown &&
                createPortal(
                  <div
                    ref={downloadDropdownRef}
                    className="fixed w-48 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
                    style={{ top: `${downloadDropdownPos.top}px`, left: `${downloadDropdownPos.left}px`, zIndex: 99999 }}
                  >
                    <button
                      onClick={() => {
                        setShowDownloadDropdown(false);
                        handleExportPDF();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <span className="font-medium">PDF Download</span>
                    </button>
                    <div className="border-t border-border" />
                    <button
                      onClick={() => {
                        setShowDownloadDropdown(false);
                        handleExport();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                      <FileText className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="font-medium">Excel Download</span>
                    </button>
                  </div>,
                  document.body
                )}
            </div>
          )}
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border shadow-sm min-h-[400px]">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-muted"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
            <FileText className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="text-lg font-semibold text-foreground">Generating Report...</p>
          <p className="text-sm text-muted-foreground mt-1">Fetching and crunching data for selected sensors.</p>
        </div>
      ) : reportData ? (
        <div className="bg-card rounded-2xl border border-border shadow-md p-5 sm:p-8 space-y-8 overflow-x-hidden box-border">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2 pb-4 border-b border-border/40">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {reportData.devices.length === 1
                  ? `${reportData.devices[0].deviceName} Report`
                  : `Combined Sensor Report`}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Generated on <span className="font-semibold text-foreground">{formatDateTime(new Date())}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-background rounded-2xl border border-border/60 shadow-sm p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full pointer-events-none transition-transform duration-500 group-hover:scale-110"></div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Records</p>
              <p className="text-3xl font-black text-foreground">{reportData.totalRecords.toLocaleString()}</p>
            </div>
            <div className="bg-background rounded-2xl border border-border/60 shadow-sm p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none transition-transform duration-500 group-hover:scale-110"></div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Sensors</p>
              <p className="text-3xl font-black text-foreground">{reportData.devices.length}</p>
            </div>
            <div className="bg-background rounded-2xl border border-border/60 shadow-sm p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none transition-transform duration-500 group-hover:scale-110"></div>
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Total Parameters</p>
              <p className="text-3xl font-black text-foreground">{reportData.totalParameters}</p>
            </div>
          </div>

          {reportData.devices.length > 0 ? (
            <div className="space-y-6">
              {reportData.devices.map((deviceReport, deviceIdx) => (
                <div key={deviceIdx} className="bg-background rounded-2xl border border-border/60 shadow-sm overflow-hidden group hover:shadow-md hover:border-primary/30 transition-all duration-300">
                  {/* Device Header */}
                  <div className="p-5 border-b border-border/60 bg-muted/10 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-foreground">{deviceReport.deviceName}</h3>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                          Total Records: <span className="text-foreground">{deviceReport.totalRecords.toLocaleString()}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Latest Update</span>
                      <span className="text-sm font-semibold text-foreground">{deviceReport.latestUpdate}</span>
                    </div>
                  </div>

                  {/* Device Parameters Table */}
                  {deviceReport.parameters.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                          <tr className="bg-muted/5 border-b border-border/60">
                            <th className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider w-12 text-center">#</th>
                            <th className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Parameter</th>
                            <th className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Avg</th>
                            <th className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Min</th>
                            <th className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Max</th>
                            <th className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Unit</th>
                            <th className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Records</th>
                            <th className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Latest Update</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 bg-background">
                          {deviceReport.parameters.map((param, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-5 py-4 text-sm font-medium text-muted-foreground text-center">
                                {idx + 1}
                              </td>
                              <td className="px-5 py-4 text-sm font-bold text-foreground">
                                {param.name}
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-foreground text-right">
                                {param.avgValue.toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-foreground text-right">
                                {param.minValue.toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-sm font-semibold text-foreground text-right">
                                {param.maxValue.toFixed(2)}
                              </td>
                              <td className="px-5 py-4 text-xs font-bold text-muted-foreground uppercase">
                                {param.unit}
                              </td>
                              <td className="px-5 py-4 text-sm font-medium text-foreground text-right">
                                {param.totalEntries.toLocaleString()}
                              </td>
                              <td className="px-5 py-4 text-xs font-medium text-muted-foreground text-right whitespace-nowrap">
                                {param.latestUpdate}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center p-8 border-t border-dashed border-border/60 bg-muted/5">
                      <p className="text-sm font-medium text-muted-foreground italic">No data available for {deviceReport.deviceName} in the selected date range.</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No data available for the selected devices and date range.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-dashed border-border shadow-sm p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <FileText className="h-10 w-10 text-primary opacity-80" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Ready to Generate Report</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Select one or more sensors and specify a date range to generate a comprehensive analysis report.
          </p>
        </div>
      )}
    </div>
  );
}

