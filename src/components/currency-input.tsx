"use client";

import { useEffect, useState } from "react";

function formatThousands(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function CurrencyInput({
  value,
  onChange,
  className = "",
  autoFocus = false,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const [display, setDisplay] = useState(formatThousands(String(value || "")));

  useEffect(() => {
    setDisplay(formatThousands(String(value || "")));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    setDisplay(formatThousands(digits));
    onChange(digits ? Number(digits) : 0);
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">Rp</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        autoFocus={autoFocus}
        className={"!pl-8" + (className ? " " + className : "")}
      />
    </div>
  );
}
