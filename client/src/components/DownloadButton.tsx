import React, { useState, useRef, useEffect } from "react";
import { useScrollLock } from "../hooks/useScrollLock";
import { createPortal } from "react-dom";
import { CiSaveDown2 } from "react-icons/ci";
import { FiFileText, FiFile } from "react-icons/fi";
import jsPDF from "jspdf";
import { formatDate, formatDateTime, formatTime } from "../utils/dateTime";

interface Row {
    id: number;
    name: string;
    value: number;
    unit: string;
    status: string;
    created_at: string;
}

interface DownloadButtonProps {
    load: boolean;
    active: string;
    names: string[];
    from: string;
    to: string;
    chartRef: React.RefObject<HTMLDivElement | null>;
    fallbackData: Row[];
    fetchAllData?: () => Promise<Row[]>;
}

export default function DownloadButton({
    load,
    active,
    names,
    from,
    to,
    chartRef,
    fallbackData,
    fetchAllData,
}: DownloadButtonProps) {
    const [showDropdown, setShowDropdown] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const buttonRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

    useScrollLock(showDropdown);

    // Position the dropdown below the button
    useEffect(() => {
        if (showDropdown && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 4,
                left: rect.right - 192,
            });
        }
    }, [showDropdown]);

    // Close dropdown on outside click + reposition on scroll/resize
    useEffect(() => {
        if (!showDropdown) return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (buttonRef.current && buttonRef.current.contains(target)) return;
            if (dropdownRef.current && dropdownRef.current.contains(target)) return;
            setShowDropdown(false);
        };
        const updatePos = () => {
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setDropdownPos({
                    top: rect.bottom + 4,        // viewport-relative (fixed positioning)
                    left: rect.right - 192,
                });
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
    }, [showDropdown]);

    // Auto-hide toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const safeString = (value: any) => {
        if (value === null || value === undefined) return "N/A";
        return String(value).trim();
    };

    const handleDownloadPDF = async () => {
        setShowDropdown(false);
        setDownloading(true);

        try {
            let dataset = fallbackData;
            if (fetchAllData) {
                try {
                    const full = await fetchAllData();
                    if (Array.isArray(full) && full.length > 0) dataset = full;
                } catch (err) {
                    console.error("Error fetching full data for PDF:", err);
                }
            }

            if (!dataset.length) {
                alert("No data available to download.");
                setDownloading(false);
                return;
            }

            const pdf = new jsPDF("p", "mm", "a4");
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 12;
            let currentY = margin;
            const headerBg = { r: 230, g: 232, b: 235 };

            currentY += 6;
            pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
            pdf.rect(margin, currentY, pageWidth - 2 * margin, 16, "F");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(16);
            pdf.setTextColor(20, 20, 20);
            pdf.text(safeString(`${active} Sensor Data Report`), pageWidth / 2, currentY + 11, { align: "center" });
            currentY += 22;

            let actualFrom = from;
            let actualTo = to;
            if (dataset.length > 0) {
                const dates = dataset.map((row) => new Date(row.created_at).getTime());
                actualFrom = new Date(Math.min(...dates)).toISOString();
                actualTo = new Date(Math.max(...dates)).toISOString();
            }
            if (actualFrom || actualTo) {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(12);
                pdf.setTextColor(100, 100, 100);
                pdf.text(`From ${actualFrom ? formatDateTime(actualFrom) : "Start"} To ${actualTo ? formatDateTime(actualTo) : "End"}`, pageWidth / 2, currentY, { align: "center" });
                currentY += 8;
            }

            if (names.length > 0) {
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(11);
                pdf.setTextColor(80, 80, 80);
                pdf.text(`Filtered Parameters: ${names.join(", ")}`, pageWidth / 2, currentY, { align: "center" });
                currentY += 8;
            }

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(12);
            pdf.setTextColor(0, 100, 200);
            pdf.text(`Total Records: ${dataset.length}`, pageWidth / 2, currentY, { align: "center" });
            currentY += 12;

            const headers = ["No.", "Sensor", "Value", "Unit", "Status", "Updated"];
            const colWidths = [20, 35, 25, 25, 30, 45];
            const startX = margin;
            const rowHeight = 8;

            const drawTableHeader = () => {
                pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
                pdf.rect(startX, currentY, pageWidth - 2 * margin, 12, "F");
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(10);
                pdf.setTextColor(0, 0, 0);
                let x = startX + 2;
                headers.forEach((h, i) => { pdf.text(h, x, currentY + 8); x += colWidths[i]; });
                currentY += 12;
            };

            drawTableHeader();
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            let rowCount = 0;
            const maxRows = Math.floor((pageHeight - currentY - margin) / rowHeight);

            dataset.forEach((row, index) => {
                if (rowCount >= maxRows) {
                    pdf.addPage();
                    currentY = margin;
                    drawTableHeader();
                    pdf.setFont("helvetica", "normal");
                    pdf.setFontSize(9);
                    rowCount = 0;
                }
                if (index % 2 === 0) {
                    pdf.setFillColor(248, 248, 248);
                    pdf.rect(startX, currentY, pageWidth - 2 * margin, rowHeight, "F");
                }
                pdf.setTextColor(0, 0, 0);
                let x = startX + 2;
                pdf.text(safeString(index + 1), x, currentY + 6); x += colWidths[0];
                pdf.setFont("helvetica", "bold");
                pdf.text(safeString(row.name), x, currentY + 6);
                pdf.setFont("helvetica", "normal"); x += colWidths[1];
                pdf.setFont("helvetica", "bold"); pdf.setTextColor(0, 0, 200);
                pdf.text(safeString(row.value), x, currentY + 6);
                pdf.setFont("helvetica", "normal"); pdf.setTextColor(0, 0, 0); x += colWidths[2];
                pdf.text(safeString(row.unit), x, currentY + 6); x += colWidths[3];

                const status = safeString(row.status).toLowerCase();
                if (status === "normal") pdf.setTextColor(0, 150, 0);
                else if (status === "warning") pdf.setTextColor(200, 100, 0);
                else if (status === "critical" || status === "error") pdf.setTextColor(200, 0, 0);
                else pdf.setTextColor(100, 100, 100);
                pdf.setFont("helvetica", "bold");
                pdf.text(status.toUpperCase(), x, currentY + 6);
                pdf.setFont("helvetica", "normal"); pdf.setTextColor(0, 0, 0); x += colWidths[4];

                pdf.setFontSize(8); pdf.setTextColor(100, 100, 100);
                pdf.text(safeString(formatDateTime(row.created_at)), x, currentY + 6);
                pdf.setFontSize(9); pdf.setTextColor(0, 0, 0);

                currentY += rowHeight;
                rowCount++;
            });

            const lastPage = (pdf as any).internal.getNumberOfPages();
            pdf.setPage(lastPage);
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Generated on: ${formatDateTime(new Date())} | Total Pages: ${lastPage}`, pageWidth / 2, pageHeight - 10, { align: "center" });

            const currentDate = formatDate(new Date()).replace(/\//g, "-");
            const timeStamp = formatTime(new Date()).replace(/:/g, "-");
            pdf.save(`${safeString(active)}_Report_${currentDate}_${timeStamp}.pdf`);
            setToast("✅ PDF downloaded successfully!");
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert(`Error generating PDF: ${(error as Error).message}`);
        } finally {
            setDownloading(false);
        }
    };

    const handleDownloadExcel = async () => {
        setShowDropdown(false);
        setDownloading(true);

        try {
            let dataset = fallbackData;
            if (fetchAllData) {
                try {
                    const full = await fetchAllData();
                    if (Array.isArray(full) && full.length > 0) dataset = full;
                } catch (err) {
                    console.error("Error fetching full data for Excel:", err);
                }
            }

            if (!dataset.length) {
                alert("No data available to download.");
                setDownloading(false);
                return;
            }

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

            // Add header row
            csvRows.push(["Sl.No", "Parameter", "Value", "Unit", "Status", "Updated"].map(escapeCSV).join(","));

            // Add data rows
            dataset.forEach((row, index) => {
                csvRows.push([
                    index + 1,
                    row.name,
                    row.value,
                    row.unit,
                    row.status,
                    formatDateTime(row.created_at),
                ].map(escapeCSV).join(","));
            });

            // Add UTF-8 BOM for better Excel compatibility
            const BOM = "\uFEFF";
            const csvContent = BOM + csvRows.join("\n");

            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const currentDate = formatDate(new Date()).replace(/\//g, "-");
            a.download = `${active}_Data_${currentDate}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
            setToast("✅ Excel file downloaded successfully!");
        } catch (error) {
            console.error("Error generating Excel file:", error);
            alert(`Error generating Excel file: ${(error as Error).message}`);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <>
            <div ref={buttonRef}>
                <div className="relative flex items-center justify-center text-foreground cursor-pointer hover:bg-accent transition-colors group h-9 sm:h-10 w-9 sm:w-10 rounded-full bg-card border border-border shadow-sm">
                    <button
                        onClick={() => {
                            if (load || downloading) return;
                            setShowDropdown(!showDropdown);
                        }}
                        disabled={load || downloading}
                        className="focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed w-full h-full flex items-center justify-center"
                    >
                        {downloading ? (
                            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                        ) : (
                            <CiSaveDown2
                                className={`text-xl sm:text-2xl transition-colors ${load ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                                    }`}
                            />
                        )}
                    </button>

                    <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-popover-foreground bg-popover rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-border shadow-lg z-50 whitespace-nowrap">
                        Download
                    </span>
                </div>
            </div>

            {/* Dropdown rendered via portal so parent overflow won't clip it */}
            {showDropdown &&
                createPortal(
                    <div
                        ref={dropdownRef}
                        className="fixed w-48 bg-card border border-border rounded-lg shadow-xl overflow-hidden"
                        style={{ top: `${dropdownPos.top}px`, left: `${dropdownPos.left}px`, zIndex: 99999 }}
                    >
                        <button
                            onClick={handleDownloadPDF}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
                        >
                            <FiFileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                            <span className="font-medium">PDF Download</span>
                        </button>
                        <div className="border-t border-border" />
                        <button
                            onClick={handleDownloadExcel}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors"
                        >
                            <FiFile className="h-4 w-4 text-green-500 flex-shrink-0" />
                            <span className="font-medium">Excel Download</span>
                        </button>
                    </div>,
                    document.body
                )}

            {/* Toast notification */}
            {toast &&
                createPortal(
                    <div
                        className="fixed bottom-6 right-6 bg-card border border-border rounded-lg shadow-xl px-4 py-3 text-sm text-foreground"
                        style={{ zIndex: 99999 }}
                    >
                        {toast}
                    </div>,
                    document.body
                )}
        </>
    );
}


