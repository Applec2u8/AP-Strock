import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";

interface FormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional sticky footer content (Save/Cancel buttons) */
  footer?: ReactNode;
  /** Show loading overlay on content */
  isLoading?: boolean;
  /** lg = 600px wide on desktop (use for forms with image upload), default = 520px */
  size?: "default" | "lg";
}

/**
 * Responsive Form Drawer
 * - Desktop (lg+): slides in from the right as a side drawer
 * - Mobile      : slides up from the bottom as a bottom sheet
 *
 * Usage:
 *   <FormDrawer isOpen={open} onClose={() => setOpen(false)} title="ເພີ່ມສິນຄ້າ">
 *     <MyForm />
 *   </FormDrawer>
 */
export function FormDrawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  isLoading = false,
  size = "default",
}: FormDrawerProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  // Handle mount/unmount animations
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // Delay visibility slightly to allow DOM to update first
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // Wait for transition duration before unmounting
      const timer = setTimeout(() => setIsRendered(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll when drawer is visible
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isVisible]);

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  const widthClass = size === "lg" ? "lg:w-[600px]" : "lg:w-[520px]";

  return createPortal(
    <>
      {/* ── Backdrop ─────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        className={[
          "fixed inset-0 z-[9998]",
          "bg-black/40 backdrop-blur-[2px]",
          "transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
      />

      {/* ── Panel ────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          // Base
          "fixed z-[9999] flex flex-col",
          "bg-white dark:bg-gray-900",
          "shadow-2xl",

          // ── Mobile: Bottom Sheet ──
          "bottom-0 left-0 right-0",
          "max-h-[90vh]",
          "rounded-t-3xl",

          // ── Desktop: Right Side Drawer ──
          "lg:top-0 lg:right-0 lg:left-auto lg:bottom-0",
          "lg:h-screen lg:max-h-screen",
          "lg:rounded-none lg:rounded-l-2xl",
          widthClass,

          // ── Transitions ──
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isVisible
            ? "translate-y-0 lg:translate-x-0"
            : "translate-y-full lg:translate-x-full lg:translate-y-0",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="lg:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
        </div>

        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate pr-4">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ປິດ"
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {/* ── Scrollable Content ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70">
              <svg
                className="animate-spin h-8 w-8 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}
          <div className="p-5">{children}</div>
        </div>

        {/* ── Sticky Footer ────────────────────────────────────── */}
        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-5 py-4 bg-white dark:bg-gray-900">
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
