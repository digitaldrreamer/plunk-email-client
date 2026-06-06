"use client";

import React, { useRef, useCallback, KeyboardEvent, ClipboardEvent } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
}

export function OtpInput({ length = 6, value, onChange, disabled, className }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, "").slice(0, length).split("");

  const focus = (i: number) => refs.current[i]?.focus();

  const set = useCallback(
    (i: number, ch: string) => {
      const arr = digits.slice();
      arr[i] = ch;
      onChange(arr.join("").trimEnd());
    },
    [digits, onChange]
  );

  const handleChange = (i: number, raw: string) => {
    const ch = raw.replace(/\D/g, "").slice(-1);
    set(i, ch);
    if (ch && i < length - 1) focus(i + 1);
  };

  const handleKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        set(i, "");
      } else if (i > 0) {
        set(i - 1, "");
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault(); focus(i - 1);
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault(); focus(i + 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    onChange(pasted);
    focus(Math.min(pasted.length, length - 1));
  };

  return (
    <div className={cn("flex gap-2 justify-center", className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] ?? ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKey(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={cn(
            "w-10 h-12 text-center text-lg font-semibold rounded-md border border-input bg-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring",
            "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
            digits[i] ? "border-primary" : ""
          )}
        />
      ))}
    </div>
  );
}
