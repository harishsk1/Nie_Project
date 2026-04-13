import React, { useState } from "react";
import { CiSaveDown2 } from "react-icons/ci";
import { FiCheck, FiX } from "react-icons/fi";
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

interface PDFDownloadProps {
  load: boolean;
  active: string;
  names: string[];
  from: string;
  to: string;
  chartRef: React.RefObject<HTMLDivElement | null>;
  fallbackData: Row[];
  fetchAllData?: () => Promise<Row[]>;
}

export default function PDFDownload({
  load,
  active,
  names,
  from,
  to,
  chartRef,
  fallbackData,
  fetchAllData,
}: PDFDownloadProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [generatedPDF, setGeneratedPDF] = useState<jsPDF | null>(null);
  const [recordCount, setRecordCount] = useState<number>(0);
  const [filename, setFilename] = useState<string>("");

  const downloadAllDataPDF = async () => {
    try {
      // Prefer full dataset if provided; otherwise use the passed dataset
      let dataset = fallbackData;
      if (fetchAllData) {
        try {
          const full = await fetchAllData();
          if (Array.isArray(full) && full.length > 0) dataset = full;
        } catch (err) {
          console.error("Error fetching full data for PDF:", err);
        }
      }
      const recordCount = dataset.length;

      if (!recordCount) {
        alert("No data available to download for the current filters.");
        return;
      }

      // 2. Create PDF with proper formatting
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      // const margin = 10;
      const margin = 12;
      let currentY = margin;

      // Shared header background (light muted)
      const headerBg = { r: 230, g: 232, b: 235 };

      // Helper function to safely convert values to strings
      const safeString = (value: any) => {
        if (value === null || value === undefined) return "N/A";
        return String(value).trim();
      };

      // 3. Add Header Banner + Large, Bold Text (extra top spacing)
      currentY += 6; // top margin above the sensor name/title
      pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
      pdf.rect(margin, currentY, pageWidth - 2 * margin, 16, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(20, 20, 20);
      pdf.text(safeString(`${active} Sensor Data Report`), pageWidth / 2, currentY + 11, {
        align: "center",
      });
      currentY += 22;

      // 4. Add Date Range - Format dates properly
      // For live mode, use actual data range; otherwise use provided from/to dates
      let actualFrom = from;
      let actualTo = to;
      
      if (dataset.length > 0) {
        // Get actual date range from the dataset
        const dates = dataset.map((row: Row) => new Date(row.created_at).getTime());
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        
        // For live mode or when dataset exists, use actual data range
        actualFrom = minDate.toISOString();
        actualTo = maxDate.toISOString();
      }
      
      if (actualFrom || actualTo) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.setTextColor(100, 100, 100);
        const fromDateFormatted = actualFrom ? formatDateTime(actualFrom) : "Start";
        const toDateFormatted = actualTo ? formatDateTime(actualTo) : "End";
        const dateText = `From ${fromDateFormatted} To ${toDateFormatted}`;
        pdf.text(dateText, pageWidth / 2, currentY, { align: "center" });
        currentY += 8;
      }

      // 5. Add Filtered Parameters (if any)
      if (names.length > 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11);
        pdf.setTextColor(80, 80, 80);
        const filterText = `Filtered Parameters: ${names.join(", ")}`;
        pdf.text(filterText, pageWidth / 2, currentY, { align: "center" });
        currentY += 8;
      }

      // 6. Add Total Records Count
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(0, 100, 200);
      pdf.text(`Total Records: ${recordCount}`, pageWidth / 2, currentY, {
        align: "center",
      });
      currentY += 15;

      // 7. Create Table Headers
      const headers = ["No.", "Sensor", "Value", "Unit", "Status", "Updated"];
      const colWidths = [20, 35, 25, 25, 30, 45];
      let startX = margin;

      // Draw table header background
      pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
      pdf.rect(startX, currentY, pageWidth - 2 * margin, 12, "F");

      // Add header text
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);

      let currentX = startX + 2;
      headers.forEach((header, index) => {
        pdf.text(safeString(header), currentX, currentY + 8);
        currentX += colWidths[index];
      });

      currentY += 12;

      // 8. Add Table Data
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      const rowHeight = 8;
      const maxRowsPerPage = Math.floor(
        (pageHeight - currentY - margin) / rowHeight
      );
      let rowCount = 0;

      dataset.forEach((row: Row, index: number) => {
        // Check if we need a new page
        if (rowCount >= maxRowsPerPage) {
          pdf.addPage();
          currentY = margin;

          // Redraw header on new page
          pdf.setFillColor(headerBg.r, headerBg.g, headerBg.b);
          pdf.rect(startX, currentY, pageWidth - 2 * margin, 12, "F");

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);

          currentX = startX + 2;
          headers.forEach((header, headerIndex) => {
            pdf.text(safeString(header), currentX, currentY + 8);
            currentX += colWidths[headerIndex];
          });

          currentY += 12;
          rowCount = 0;
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
        }

        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(startX, currentY, pageWidth - 2 * margin, rowHeight, "F");
        }

        pdf.setTextColor(0, 0, 0);
        currentX = startX + 2;

        // Serial Number
        pdf.text(safeString(index + 1), currentX, currentY + 6);
        currentX += colWidths[0];

        // Sensor Name (Bold)
        pdf.setFont("helvetica", "bold");
        pdf.text(safeString(row.name), currentX, currentY + 6);
        pdf.setFont("helvetica", "normal");
        currentX += colWidths[1];

        // Value (Bold, Blue)
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 200);
        pdf.text(safeString(row.value), currentX, currentY + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        currentX += colWidths[2];

        // Unit
        pdf.text(safeString(row.unit), currentX, currentY + 6);
        currentX += colWidths[3];

        // Status (with color coding)
        const status = safeString(row.status).toLowerCase();
        if (status === "normal") {
          pdf.setTextColor(0, 150, 0); // Green
        } else if (status === "warning") {
          pdf.setTextColor(200, 100, 0); // Orange
        } else if (status === "critical" || status === "error") {
          pdf.setTextColor(200, 0, 0); // Red
        } else {
          pdf.setTextColor(100, 100, 100); // Gray
        }
        pdf.setFont("helvetica", "bold");
        pdf.text(status.toUpperCase(), currentX, currentY + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        currentX += colWidths[4];

        // Updated Time (with safe date handling)
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);

        const dateText = formatDateTime(row.created_at);

        pdf.text(safeString(dateText), currentX, currentY + 6);
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);

        currentY += rowHeight;
        rowCount++;
      });

      // 9. Chart image removed - no longer included in PDF

      // 10. Add Footer
      const lastPage = (pdf as any).internal.getNumberOfPages();

      pdf.setPage(lastPage);

      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      const footerText = `Generated on: ${formatDateTime(new Date())} | Total Pages: ${lastPage}`;
      pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: "center" });

      // 11. Prepare filename (but don't save yet)
      // NOTE: Windows filenames cannot contain "/" or ":" so we use a safe variant for the filename.
      const currentDate = formatDate(new Date()).replace(/\//g, "-");
      const timeStamp = formatTime(new Date()).replace(/:/g, "-");
      const pdfFilename = `${safeString(
        active
      )}_Report_${currentDate}_${timeStamp}.pdf`;

      // Store PDF and show confirmation modal instead of saving immediately
      setGeneratedPDF(pdf);
      setRecordCount(recordCount);
      setFilename(pdfFilename);
      setShowConfirmModal(true);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`❌ Error generating PDF: ${(error as Error).message}`);
    }
  };

  const handleConfirmDownload = () => {
    if (generatedPDF && filename) {
      generatedPDF.save(filename);
      setShowConfirmModal(false);
      setGeneratedPDF(null);
      setFilename("");
      setRecordCount(0);
    }
  };

  const handleCancelDownload = () => {
    setShowConfirmModal(false);
    setGeneratedPDF(null);
    setFilename("");
    setRecordCount(0);
  };

  return (
    <>
      <div className="flex items-center justify-center text-foreground cursor-pointer hover:bg-accent transition-colors group relative h-9 sm:h-10 w-9 sm:w-10 rounded-full bg-card border border-border shadow-sm">
        <button
          onClick={downloadAllDataPDF}
          disabled={load}
          className="focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed w-full h-full flex items-center justify-center"
        >
          <CiSaveDown2
            className={`text-xl sm:text-2xl transition-colors ${
              load ? "text-muted-foreground " : "text-foreground group-hover:text-primary"
            }`}
          />
        </button>

        {/* Tooltip */}
        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-popover-foreground bg-popover rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-border shadow-lg z-50 whitespace-nowrap ">
          Download
        </span>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 transform transition-all overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border bg-muted">
              <h3 className="text-lg font-semibold text-foreground">
                PDF Generated Successfully
              </h3>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6 bg-muted/40">
              {/* Sensor name block (adds top margin + clear separation) */}
              <div className="mt-2 mb-4 rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">Sensor Name</p>
                <p className="mt-3 text-base font-semibold text-foreground truncate">{active}</p>
              </div>

              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-emerald-500/15 rounded-full flex items-center justify-center">
                  <FiCheck className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-foreground">
                    PDF generated successfully with {recordCount} records!
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Do you want to download the PDF?
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-card">
              <button
                onClick={handleCancelDownload}
                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-accent focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors duration-200"
              >
                <span className="flex items-center gap-2">
                  <FiX size={16} />
                  Cancel
                </span>
              </button>
              <button
                onClick={handleConfirmDownload}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors duration-200"
              >
                <span className="flex items-center gap-2">
                  <FiCheck size={16} />
                  OK
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
