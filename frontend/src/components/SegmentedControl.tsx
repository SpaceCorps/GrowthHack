import React, { useRef } from "react";

export type SegmentedControlVariant = "emerald" | "cyan" | "indigo" | "pink" | "secondary";
export type SegmentedControlSize = "xs" | "sm" | "md";
export type SegmentedControlAppearance = "pills" | "underline";

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: SegmentedControlVariant;
}

export interface SegmentedControlProps<T extends string = string> {
  options: (SegmentedControlOption<T> | T)[];
  value: T;
  onChange: (value: T) => void;
  appearance?: SegmentedControlAppearance;
  variant?: SegmentedControlVariant;
  size?: SegmentedControlSize;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

const activePillVariantClasses: Record<SegmentedControlVariant, string> = {
  emerald:
    "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm font-semibold",
  cyan: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm font-semibold",
  indigo: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 shadow-sm font-semibold",
  pink: "bg-pink-500/20 text-pink-300 border border-pink-500/50 shadow-sm font-semibold",
  secondary: "bg-slate-800 text-slate-200 border border-slate-700 shadow-sm font-semibold",
};

const activeUnderlineVariantClasses: Record<SegmentedControlVariant, string> = {
  emerald: "border-emerald-400 text-emerald-300",
  cyan: "border-cyan-400 text-cyan-300",
  indigo: "border-indigo-400 text-indigo-300",
  pink: "border-pink-400 text-pink-300",
  secondary: "border-slate-400 text-slate-200",
};

const focusRingClasses: Record<SegmentedControlVariant, string> = {
  emerald: "focus:ring-emerald-500",
  cyan: "focus:ring-cyan-500",
  indigo: "focus:ring-indigo-500",
  pink: "focus:ring-pink-500",
  secondary: "focus:ring-slate-500",
};

const inactivePillClasses =
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
  appearance = "pills",
  variant = "emerald",
  size = "sm",
  className = "",
  ariaLabel,
  disabled = false,
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const normalizedOptions: SegmentedControlOption<T>[] = options.map((opt) =>
    typeof opt === "string" ? { value: opt } : opt,
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isNavKey = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(
      e.key,
    );
    if (!isNavKey) return;

    const enabledOptions = normalizedOptions.filter((opt) => !disabled && !opt.disabled);
    if (enabledOptions.length === 0) return;

    const currentIndex = enabledOptions.findIndex((opt) => opt.value === value);
    let targetIndex = -1;

    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      targetIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % enabledOptions.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      targetIndex =
        currentIndex === -1
          ? enabledOptions.length - 1
          : (currentIndex - 1 + enabledOptions.length) % enabledOptions.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      targetIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      targetIndex = enabledOptions.length - 1;
    }

    if (targetIndex >= 0 && targetIndex < enabledOptions.length) {
      const targetOption = enabledOptions[targetIndex];
      onChange(targetOption.value);
      const targetButton = buttonRefs.current[targetOption.value];
      if (targetButton) {
        targetButton.focus();
      }
    }
  };

  const isUnderline = appearance === "underline";

  const containerRole = isUnderline ? "tablist" : "radiogroup";
  const containerClasses = isUnderline
    ? `flex items-center space-x-4 border-b border-slate-800 ${className}`.trim()
    : `flex flex-wrap gap-2 ${className}`.trim();

  return (
    <div
      role={containerRole}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={containerClasses}
    >
      {normalizedOptions.map((optionObj) => {
        const isSelected = optionObj.value === value;
        const isOptionDisabled = Boolean(disabled || optionObj.disabled);
        const effectiveVariant = optionObj.variant ?? variant;

        let buttonClasses: string;
        if (isUnderline) {
          const underlineState = isSelected
            ? `border-b-2 font-semibold pb-2.5 transition-colors flex items-center gap-1.5 ${activeUnderlineVariantClasses[effectiveVariant]}`
            : "border-b-2 border-transparent text-slate-400 hover:text-slate-200 pb-2.5 font-medium transition-colors flex items-center gap-1.5";

          buttonClasses = [
            "cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none text-xs",
            focusRingClasses[effectiveVariant],
            underlineState,
          ].join(" ");
        } else {
          const pillState = isSelected
            ? activePillVariantClasses[effectiveVariant]
            : inactivePillClasses;

          buttonClasses = [
            "inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1",
            focusRingClasses[effectiveVariant],
            sizeClasses[size],
            pillState,
          ].join(" ");
        }

        const itemRole = isUnderline ? "tab" : "radio";
        const ariaProps = isUnderline
          ? { "aria-selected": isSelected }
          : { "aria-checked": isSelected };

        return (
          <button
            key={optionObj.value}
            ref={(el) => {
              buttonRefs.current[optionObj.value] = el;
            }}
            type="button"
            role={itemRole}
            {...ariaProps}
            tabIndex={isSelected ? 0 : -1}
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
