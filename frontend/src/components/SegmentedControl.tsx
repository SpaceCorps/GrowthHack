import React from "react";

export type SegmentedControlVariant = "emerald" | "cyan" | "indigo" | "secondary";
export type SegmentedControlSize = "xs" | "sm" | "md";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: (SegmentedControlOption<T> | T)[];
  value: T;
  onChange: (value: T) => void;
  variant?: SegmentedControlVariant;
  size?: SegmentedControlSize;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

const activeVariantClasses: Record<SegmentedControlVariant, string> = {
  emerald:
    "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm font-semibold",
  cyan: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm font-semibold",
  indigo: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm font-semibold",
  secondary: "bg-slate-800 text-slate-200 border border-slate-700 shadow-sm font-semibold",
};

const focusRingClasses: Record<SegmentedControlVariant, string> = {
  emerald: "focus:ring-emerald-500",
  cyan: "focus:ring-cyan-500",
  indigo: "focus:ring-indigo-500",
  secondary: "focus:ring-slate-500",
};

const inactiveClasses =
  "bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200 hover:border-slate-700 font-medium";

const sizeClasses: Record<SegmentedControlSize, string> = {
  xs: "px-2.5 py-1 text-[11px] rounded-md gap-1",
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-xs sm:text-sm rounded-xl gap-2",
};

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  variant = "emerald",
  size = "sm",
  className = "",
  ariaLabel,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`flex flex-wrap gap-2 ${className}`.trim()}
    >
      {options.map((opt) => {
        const optionObj: SegmentedControlOption<T> = typeof opt === "string" ? { value: opt } : opt;
        const isSelected = optionObj.value === value;
        const isOptionDisabled = Boolean(disabled || optionObj.disabled);

        const stateClasses = isSelected ? activeVariantClasses[variant] : inactiveClasses;

        const buttonClasses = [
          "inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1",
          focusRingClasses[variant],
          sizeClasses[size],
          stateClasses,
        ].join(" ");

        return (
          <button
            key={optionObj.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isOptionDisabled}
            onClick={() => {
              if (!isOptionDisabled && onChange) {
                onChange(optionObj.value);
              }
            }}
            className={buttonClasses}
          >
            {optionObj.icon && <span className="shrink-0">{optionObj.icon}</span>}
            {optionObj.label ?? optionObj.value}
            {optionObj.hint && (
              <span className="text-[10px] opacity-75 font-normal ml-1">{optionObj.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
