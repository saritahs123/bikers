"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  badge?: string;
  sublabel?: string;
}

export interface SearchableSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allOption?: SearchableSelectOption | null;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

function normalizeStr(str: string): string {
  return (str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "No se encontraron resultados",
  allOption = null,
  className = "",
  disabled = false,
  allowClear = true,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Combine allOption with regular options if present
  const fullOptionsList = useMemo(() => {
    if (allOption) {
      return [allOption, ...options];
    }
    return options;
  }, [allOption, options]);

  // Current selected option
  const selectedOption = useMemo(() => {
    return fullOptionsList.find((opt) => String(opt.value) === String(value));
  }, [fullOptionsList, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return fullOptionsList;
    const q = normalizeStr(search);
    return fullOptionsList.filter((opt) => {
      const matchLabel = normalizeStr(opt.label).includes(q);
      const matchSub = opt.sublabel ? normalizeStr(opt.sublabel).includes(q) : false;
      const matchBadge = opt.badge ? normalizeStr(opt.badge).includes(q) : false;
      return matchLabel || matchSub || matchBadge;
    });
  }, [fullOptionsList, search]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
      };
    }
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(-1);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearch("");
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (val: string | number) => {
    onChange(String(val));
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allOption) {
      onChange(String(allOption.value));
    } else {
      onChange("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (filteredOptions.length === 1) {
        handleSelect(filteredOptions[0].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearch("");
    }
  };

  const isDefaultSelected =
    value === undefined ||
    value === null ||
    (allOption && String(value) === String(allOption.value)) ||
    String(value) === "TODOS" ||
    String(value) === "";

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full bg-surface-subtle border ${
          isOpen ? "border-primary/60 ring-1 ring-primary/20" : "border-border"
        } text-foreground rounded-lg px-2.5 py-1.5 text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer hover:border-primary/40 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span
          className={`truncate text-left ${
            selectedOption ? "text-foreground font-medium" : "text-foreground-muted"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <div className="flex items-center gap-1 shrink-0 text-foreground-muted">
          {allowClear && !isDefaultSelected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 hover:text-foreground hover:bg-hover rounded transition-colors"
              title="Restablecer filtro"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-primary" : ""
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1 w-full min-w-[220px] max-w-sm bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden font-mono text-xs animate-in fade-in zoom-in-95 duration-100"
          onKeyDown={handleKeyDown}
        >
          {/* Search Box */}
          <div className="p-2 border-b border-border/80 bg-surface/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(-1);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 bg-surface-subtle border border-border rounded-lg text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:border-primary/60 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto custom-scrollbar p-1 space-y-0.5"
          >
            {filteredOptions.length === 0 ? (
              <div className="py-4 px-2 text-center text-foreground-muted text-[11px]">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = highlightedIndex === idx;

                return (
                  <button
                    type="button"
                    key={String(opt.value)}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary/15 text-primary font-bold"
                        : isHighlighted
                        ? "bg-hover text-foreground"
                        : "text-foreground hover:bg-hover"
                    }`}
                  >
                    <div className="truncate min-w-0 pr-2">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-foreground-muted truncate">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && !isSelected && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-surface border border-border rounded text-foreground-muted font-normal">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
