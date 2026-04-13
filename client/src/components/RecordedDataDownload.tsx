import React from "react";
import { CiSaveDown2 } from "react-icons/ci"; // Download icon
import { formatDate } from "../utils/dateTime";

interface ChartDataPoint {
    category: string;
    value: number;
}

interface RecordedDataDownloadProps {
    selectedDevice: string;
    selectedParameter: string;
    parameterUnit: string;
    hourlyData: ChartDataPoint[];
    dailyData: ChartDataPoint[];
    monthlyData: ChartDataPoint[];
    hourlyDate: string;
    dailyMonth: string;
    monthlyYear: string;
}

export default function RecordedDataDownload({
    selectedDevice,
    selectedParameter,
    parameterUnit,
    hourlyData,
    dailyData,
    monthlyData,
    hourlyDate,
    dailyMonth,
    monthlyYear,
}: RecordedDataDownloadProps) {
    const isDisabled = !selectedDevice || !selectedParameter;

    const handleDownloadExcel = () => {
        const csvRows: string[] = [];
        csvRows.push(`${selectedDevice} - ${selectedParameter} - Recorded Data`);
        csvRows.push("");

        if (hourlyData.length > 0) {
            csvRows.push(`Hourly Data,Date: ${hourlyDate}`);
            csvRows.push(`Hour,Value (${parameterUnit || "units"})`);
            hourlyData.forEach((item) => csvRows.push(`${item.category},${item.value.toFixed(2)}`));
            csvRows.push("");
        }

        if (dailyData.length > 0) {
            csvRows.push(`Daily Data,Month: ${dailyMonth}`);
            csvRows.push(`Day,Value (${parameterUnit || "units"})`);
            dailyData.forEach((item) => csvRows.push(`${item.category},${item.value.toFixed(2)}`));
            csvRows.push("");
        }

        if (monthlyData.length > 0) {
            csvRows.push(`Monthly Data,Year: ${monthlyYear}`);
            csvRows.push(`Month,Value (${parameterUnit || "units"})`);
            monthlyData.forEach((item) => csvRows.push(`${item.category},${item.value.toFixed(2)}`));
            csvRows.push("");
        }

        if (csvRows.length <= 2) {
            alert("No data available to download.");
            return;
        }

        // Add UTF-8 BOM for better Excel compatibility
        const BOM = "\uFEFF";
        const csvContent = BOM + csvRows.join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const currentDate = formatDate(new Date()).replace(/\//g, "-");
        a.download = `${selectedDevice}_${selectedParameter}_${currentDate}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="relative flex items-center justify-center text-foreground cursor-pointer hover:bg-accent transition-colors group h-9 sm:h-10 w-9 sm:w-10 rounded-full bg-card border border-border shadow-sm">
            <button
                onClick={() => {
                    if (isDisabled) {
                        alert("Please select a sensor and parameter first.");
                        return;
                    }
                    handleDownloadExcel();
                }}
                className="focus:outline-none w-full h-full flex items-center justify-center"
            >
                <CiSaveDown2
                    className={`text-xl sm:text-2xl transition-colors ${isDisabled ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                        }`}
                />
            </button>

            <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-popover-foreground bg-popover rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-border shadow-lg z-50 whitespace-nowrap">
                Download Excel
            </span>
        </div>
    );
}
