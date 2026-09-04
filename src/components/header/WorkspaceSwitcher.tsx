import { useState, useRef, useEffect } from "react";
import { useUser } from "../../context/UserContext";

export default function WorkspaceSwitcher() {
  const { user, workspaces, switchWorkspace } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!workspaces || workspaces.length <= 1) return null;

  // Convert to string for safe comparison (bigint vs string)
  const activeWsId = user?.active_workspace_id
    ? String(user.active_workspace_id)
    : String(user?.id);

  const activeWorkspace = workspaces.find(
    (w) => String(w.owner_id) === activeWsId
  ) || workspaces[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
      >
        {/* Workspace icon */}
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <span className="truncate max-w-[130px]">
          {activeWorkspace?.name || "Workspace"}
        </span>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-[9999] w-60 mt-2 origin-top-right bg-white border border-gray-200 rounded-xl shadow-xl dark:bg-gray-900 dark:border-gray-800">
          <div className="p-2">
            <div className="px-3 py-2 text-xs font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
              ເລືອກພື້ນທີ່ເຮັດວຽກ
            </div>
            {workspaces.map((ws) => {
              const isActive = String(ws.owner_id) === activeWsId;
              return (
                <button
                  key={ws.owner_id}
                  onClick={() => {
                    switchWorkspace(ws.is_mine ? null : String(ws.owner_id));
                    setIsOpen(false);
                  }}
                  className={`flex items-center w-full gap-3 px-3 py-2.5 text-sm text-left rounded-lg transition-colors ${isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400 font-medium"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                  <div className="flex-1 truncate">{ws.name}</div>
                  {isActive && (
                    <svg className="w-4 h-4 flex-shrink-0 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

