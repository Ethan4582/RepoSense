import React from "react";

export function StatusBar({ status, progress }: { status: string; progress?: number }) {
  return (
    <div className="fixed bottom-0 left-0 w-full z-50 bg-white/80 border-t border-gray-200 shadow-sm flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700">
      <span>
        {status}
        {typeof progress === "number" && (
          <span className="ml-2 text-xs text-gray-500">
            {progress}% complete
          </span>
        )}
      </span>
      <div className="h-2 w-32 bg-gray-200 rounded overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${progress ?? 0}%` }}
        />
      </div>
    </div>
  );
}