import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { useMemo } from "react";
import { useScrollLock } from "../hooks/useScrollLock";

interface Device {
  id: number;
  name: string;
}

interface SensorDropdownProps {
  devices: Device[];
  selectedDevice: string;
  onSelect: (deviceName: string) => void;
  /** Optional placeholder text when no device is selected */
  placeholder?: string;
}

/**
 * Searchable sensor picker dropdown.
 * Uses a portal so the dropdown is always viewport-relative (position: fixed)
 * and will never scroll with its parent container.
 */
export default function SensorDropdown({
  devices,
  selectedDevice,
  onSelect,
  placeholder = "Select a sensor",
}: SensorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useScrollLock(isOpen);

  const filteredDevices = useMemo(() => {
    if (!searchQuery.trim()) return devices;
    const q = searchQuery.toLowerCase();
    return devices.filter((d) => d.name.toLowerCase().includes(q));
  }, [devices, searchQuery]);

  // Measure and reposition whenever open + on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const measure = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,    // viewport-relative (fixed positioning)
          left: rect.left,
          width: rect.width,
        });
      }
    };

    measure(); // initial

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      setIsOpen(false);
      setSearchQuery("");
    };

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", measure, true);   // capture phase catches nested scrollers
    window.addEventListener("resize", measure);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [isOpen]);

  return (
    <div
      className="relative w-full sm:w-[180px] lg:w-[200px] flex-shrink-0"
      ref={containerRef}
    >
      <label className="absolute -top-2 left-3 bg-card px-1 text-xs font-medium text-foreground z-20 pointer-events-none">
        Select Sensor
      </label>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full h-9 sm:h-10 flex items-center justify-between gap-2 px-3 text-sm font-semibold bg-background border-2 border-input rounded-md shadow-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors min-w-0"
      >
        <span
          className={`${selectedDevice ? "text-foreground font-medium" : "text-muted-foreground"
            } truncate flex-1 text-left min-w-0`}
        >
          {selectedDevice || placeholder}
        </span>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""
            }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-popover border-2 border-border rounded-lg shadow-xl"
            style={{
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              width: `${dropdownPos.width}px`,
              maxHeight: "300px",
              overflowY: "auto",
              zIndex: 99999,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search bar */}
            <div className="relative p-0 h-9 border-b border-border rounded-t-lg bg-popover sticky top-0 z-10">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sensors..."
                className="w-full h-9 pl-10 pr-10 text-sm border-0 rounded-t-lg focus:outline-none focus:ring-0 bg-popover text-popover-foreground placeholder:text-muted-foreground"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Options list */}
            <div className="rounded-b-lg">
              {devices.length === 0 ? (
                <div className="px-4 py-3 text-muted-foreground text-sm text-center">
                  Loading sensors...
                </div>
              ) : filteredDevices.length === 0 ? (
                <div className="px-4 py-3 text-muted-foreground text-sm text-center">
                  No sensors found
                </div>
              ) : (
                filteredDevices.map((device) => (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => {
                      onSelect(device.name);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors cursor-pointer ${selectedDevice === device.name
                        ? "bg-primary/10 text-primary border-l-4 border-primary font-semibold"
                        : "text-foreground hover:bg-accent"
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
  );
}
