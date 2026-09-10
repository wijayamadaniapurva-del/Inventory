"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface ItemPickerOption {
  id: string;
  name: string;
  subtitle?: string;
}

export function ItemPicker({
  options,
  value,
  onChange,
  placeholder = "Pilih item",
}: {
  options: ItemPickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left font-normal"
      >
        <span className={selected ? "" : "text-stone-400"}>{selected ? selected.name : placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-stone-400" />
      </button>

      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={
                "!h-auto !rounded-none !border-0 !border-b !border-stone-100 last:!border-0 flex w-full items-center justify-between px-3 py-2 text-left text-sm font-normal " +
                (o.id === value ? "!bg-accent-50 !text-accent-700" : "!bg-white text-stone-700 hover:!bg-stone-50")
              }
            >
              <span>{o.name}</span>
              {o.subtitle && <span className="figure text-stone-400">{o.subtitle}</span>}
            </button>
          ))}
          {options.length === 0 && <p className="px-3 py-2 text-sm text-stone-400">Tidak ada item.</p>}
        </div>
      )}
    </div>
  );
}
