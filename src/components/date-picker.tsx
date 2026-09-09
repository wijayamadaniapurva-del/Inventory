"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function toIso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseIso(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pilih tanggal",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const parsed = parseIso(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(parsed?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.m ?? today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const displayLabel = parsed
    ? `${parsed.d} ${MONTH_LABELS[parsed.m]} ${parsed.y}`
    : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={"flex w-full items-center justify-between text-left font-normal " + (parsed ? "" : "text-stone-400") + (className ? " " + className : "")}
      >
        {displayLabel}
        <CalendarDays size={16} className="shrink-0 text-stone-400" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-64 rounded-lg border border-stone-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={goToPrevMonth} className="!h-7 !w-7 !border-0 !p-0 text-stone-500">
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-medium text-stone-800">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </p>
            <button type="button" onClick={goToNextMonth} className="!h-7 !w-7 !border-0 !p-0 text-stone-500">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-400">
            {DAY_LABELS.map((d) => (
              <span key={d} className="py-1">
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              const isSelected = day != null && parsed && parsed.y === viewYear && parsed.m === viewMonth && parsed.d === day;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={day == null}
                  onClick={() => {
                    if (day == null) return;
                    onChange(toIso(viewYear, viewMonth, day));
                    setOpen(false);
                  }}
                  className={
                    "!h-8 !w-8 !border-0 !p-0 text-sm " +
                    (day == null
                      ? "invisible"
                      : isSelected
                        ? "!bg-accent-600 !text-white"
                        : "!bg-transparent text-stone-700 hover:!bg-stone-100")
                  }
                >
                  {day}
                </button>
              );
            })}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full !border-0 text-xs text-stone-400 hover:text-stone-600"
            >
              Hapus tanggal
            </button>
          )}
        </div>
      )}
    </div>
  );
}
