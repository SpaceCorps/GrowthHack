import React from "react";
import { Loader2 } from "lucide-react";

export type ActionButtonVariant = "emerald" | "gradient" | "secondary" | "ghost";
export type ActionButtonSize = "xs" | "sm" | "md" | "lg";

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  loading?: boolean;
  loadingText?: React.ReactNode;
  icon?: React.ReactNode;
}

const variantClasses: Record<ActionButtonVariant, string> = {
  emerald:
    "bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-950/20 transition-all",
  gradient:
    "bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold shadow-md shadow-emerald-950/20 transition-all",
  secondary:
    "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-colors",
  ghost:
    "text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent font-medium transition-colors",
};

const sizeClasses: Record<ActionButtonSize, string> = {
  xs: "px-2.5 py-1 text-xs rounded-lg",
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-xs sm:text-sm rounded-xl",
  lg: "px-6 py-2.5 text-sm rounded-xl",
};

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      variant = "emerald",
      size = "sm",
      loading = false,
      loadingText,
      icon,
      className = "",
      disabled,
      children,
      type = "button",
      onClick,
      ...rest
    },
    ref,
  ) => {
    const isEffectivelyDisabled = Boolean(disabled || loading);
    const gapClass = size === "xs" || size === "sm" ? "gap-1.5" : "gap-2";
    const spinnerSize = size === "lg" || size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";

    const combinedClassName = [
      "inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
      gapClass,
      variantClasses[variant],
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isEffectivelyDisabled) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isEffectivelyDisabled}
        aria-busy={loading ? "true" : undefined}
        onClick={handleClick}
        className={combinedClassName}
        {...rest}
      >
        {loading ? (
          <>
            <Loader2 className={`${spinnerSize} animate-spin shrink-0`} />
            {loadingText ?? children}
          </>
        ) : (
          <>
            {icon}
            {children}
          </>
        )}
      </button>
    );
  },
);

ActionButton.displayName = "ActionButton";

export default ActionButton;
