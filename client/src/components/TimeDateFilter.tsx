



import React, { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "../utils/dateTime";

interface TimeDateFilterProps {
  from: string;
  to: string;
  setFrom: React.Dispatch<React.SetStateAction<string>>;
  setTo: React.Dispatch<React.SetStateAction<string>>;
  clearAllFilters: () => void;
}

export default function TimeDateFilter({
  from,
  to,
  setFrom,
  setTo,
  clearAllFilters,
}: TimeDateFilterProps) {
  const toDatetimeLocalValue = (value: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      // If already a datetime-local-ish string, try to normalize to seconds
      const m = value.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?/);
      if (m) {
        const [, date, hhmm, ss] = m;
        return `${date}T${hhmm}:${ss ?? "00"}`;
      }
      return "";
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  };

  const toIsoString = (datetimeLocal: string) => {
    if (!datetimeLocal) return "";
    const d = new Date(datetimeLocal);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString();
  };

  const [fromLocal, setFromLocal] = useState(() => toDatetimeLocalValue(from));
  const [toLocal, setToLocal] = useState(() => toDatetimeLocalValue(to));

  // Keep internal fields in sync if parent updates externally.
  useEffect(() => {
    setFromLocal(toDatetimeLocalValue(from));
  }, [from]);

  useEffect(() => {
    setToLocal(toDatetimeLocalValue(to));
  }, [to]);

  const fromPreview = useMemo(() => (from ? formatDateTime(from) : "—"), [from]);
  const toPreview = useMemo(() => (to ? formatDateTime(to) : "—"), [to]);


  const isRangeInvalid = useMemo(() => {
    if (!fromLocal || !toLocal) return false;
    return new Date(fromLocal) > new Date(toLocal);
  }, [fromLocal, toLocal]);

  return (
    <div className="w-full lg:w-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 max-w-full overflow-visible min-w-0 flex-shrink-0">
      {/* From DateTime */}
      <div className="relative w-full sm:w-auto min-w-[220px] sm:min-w-[240px] max-w-full flex-shrink-0 overflow-visible">
        <label className="absolute -top-2 left-3 bg-card px-1 text-xs font-medium text-foreground z-30 pointer-events-none whitespace-nowrap date-filter-label">
          From
        </label>
        <input
          type="datetime-local"
          step="1"
          value={fromLocal}
          onChange={(e) => {
            const next = e.target.value;
            setFromLocal(next);
            setFrom(next ? toIsoString(next) : "");
          }}
          className={`w-full h-9 sm:h-10 border-2 rounded-md px-3 text-sm font-medium text-foreground bg-background focus:outline-none focus:ring-0 transition-colors hover:border-primary ${isRangeInvalid ? "border-destructive focus:border-destructive" : "border-input focus:border-primary"
            }`}
        />
      </div>

      {/* To DateTime */}
      <div className="relative w-full sm:w-auto min-w-[220px] sm:min-w-[240px] max-w-full flex-shrink-0 overflow-visible">
        <label className="absolute -top-2 left-3 bg-card px-1 text-xs font-medium text-foreground z-30 pointer-events-none whitespace-nowrap date-filter-label">
          To
        </label>

        <input
          type="datetime-local"
          step="1"
          value={toLocal}
          onChange={(e) => {
            const next = e.target.value;
            setToLocal(next);
            setTo(next ? toIsoString(next) : "");
          }}
          className={`w-full h-9 sm:h-10 border-2 rounded-md px-3 text-sm font-medium text-foreground bg-background focus:outline-none focus:ring-0 transition-colors hover:border-primary ${isRangeInvalid ? "border-destructive focus:border-destructive" : "border-input focus:border-primary"
            }`}
        />
      </div>

      {/* Invalid range warning */}
      {isRangeInvalid && (
        <p className="text-xs text-destructive font-medium whitespace-nowrap self-center">
          ⚠ "From" must be before "To"
        </p>
      )}

      {/* Clear Button */}
      <div className="relative w-full sm:w-auto flex-shrink-0">
        <button
          onClick={clearAllFilters}
          className="w-full sm:w-auto h-9 sm:h-10 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-medium text-sm px-2.5 sm:px-3 rounded-md shadow-sm transition-all whitespace-nowrap"
        >
          Clear Dates
        </button>
      </div>
    </div>
  );
}


