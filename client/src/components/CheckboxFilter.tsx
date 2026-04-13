

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { IoFilter } from "react-icons/io5";
import { AiOutlineClose } from "react-icons/ai";
import { useScrollLock } from "../hooks/useScrollLock";

interface CheckboxFilterProps {
  availableParams: string[];
  names: string[];
  toggle: (name: string) => void;
  selectAll: () => void;
  unselectAll: () => void;
  isAllSelected: boolean;
  isNoneSelected: boolean;
  showTags?: boolean;
}

export default function CheckboxFilter({
  availableParams,
  names,
  toggle,
  selectAll,
  unselectAll,
  isAllSelected,
  isNoneSelected,
  showTags = true,
}: CheckboxFilterProps) {
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useScrollLock(showFilterDropdown);

  // Measure button position and update on scroll/resize
  useEffect(() => {
    if (!showFilterDropdown) return;

    const computePos = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPos({
          top: rect.bottom + 4,    // viewport-relative (fixed positioning)
          left: rect.left,
          width: Math.max(rect.width, 160),
        });
      }
    };

    // Initial measurement
    computePos();

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      if (dropdownRef.current && dropdownRef.current.contains(target)) return;
      setShowFilterDropdown(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", computePos, true);
    window.addEventListener("resize", computePos);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", computePos, true);
      window.removeEventListener("resize", computePos);
    };
  }, [showFilterDropdown]);

  return (
    <div className="flex flex-col space-y-2 w-full sm:w-auto min-w-0 flex-shrink-0">
      {/* Selected Parameters Tags - Only show if showTags is true */}
      {showTags && names.length > 0 && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center max-w-full">
          {names.map((name) => (
            <div
              key={name}
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs sm:text-sm font-medium border border-primary/20"
            >
              <span className="truncate max-w-[120px] sm:max-w-[150px]">{name}</span>
              <button
                onClick={() => toggle(name)}
                className="flex-shrink-0 text-primary hover:text-primary/80 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                aria-label={`Remove ${name}`}
                title={`Remove ${name}`}
              >
                <AiOutlineClose className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex justify-center group">
        <button
          ref={buttonRef}
          onClick={() => setShowFilterDropdown((v) => !v)}
          className="w-12 h-9 sm:w-12 sm:h-10 flex items-center justify-center border-border rounded-full bg-background text-foreground hover:bg-accent transition-colors"
        >
          <IoFilter className="text-lg sm:text-xl lg:text-2xl text-foreground font-semibold" />
        </button>

        {/* Tooltip */}
        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 px-2 py-1 text-xs text-popover-foreground bg-popover rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none border border-border shadow-lg z-50 whitespace-nowrap">
          Filter
        </span>

        {/* Portal dropdown — stays anchored to button; never scrolls with page */}
        {showFilterDropdown &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed bg-popover rounded-lg shadow-xl border border-border"
              style={{
                top: `${dropdownPos.top}px`,
                left: `${dropdownPos.left}px`,
                minWidth: `${dropdownPos.width}px`,
                zIndex: 99999,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-2 sm:p-3 border-b border-border">
                <label className="text-xs sm:text-sm font-medium text-popover-foreground">
                  Filter Parameters
                </label>
                <button
                  onClick={() => setShowFilterDropdown(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <AiOutlineClose className="text-sm sm:text-lg font-bold" />
                </button>
              </div>
              <div className="p-1 sm:p-2 max-h-60 overflow-y-auto parameter-filter-dropdown">
                {availableParams.map((param) => {
                  const isChecked = names.includes(param);
                  return (
                    <button
                      key={param}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggle(param);
                      }}
                      className="w-full flex items-center justify-between p-2 hover:bg-accent rounded-sm group transition-colors text-left"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${isChecked
                              ? "bg-primary border-primary"
                              : "border-input bg-background"
                            }`}
                        >
                          {isChecked && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium text-popover-foreground">
                          {param}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-border p-1.5 sm:p-2">
                <div className="flex gap-1 sm:gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAll();
                    }}
                    disabled={isAllSelected}
                    className={`flex-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded-md transition-colors ${isAllSelected
                        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                        : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                      }`}
                  >
                    Select All
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      unselectAll();
                    }}
                    disabled={isNoneSelected}
                    className={`flex-1 px-1.5 sm:px-2 py-1 text-xs font-medium rounded-sm transition-colors ${isNoneSelected
                        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                        : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
                      }`}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
