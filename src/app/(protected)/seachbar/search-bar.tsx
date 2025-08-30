'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "~/components/ui/input";

export function SearchBar({ projects }: { projects: { id: string; name: string }[] }) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const router = useRouter();

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative w-full max-w-md">
      <Input
        type="text"
        placeholder="Search for a project..."
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        className="w-full px-4 py-2 rounded-xl border-none outline-none bg-white/20 backdrop-blur-md shadow-lg text-base text-blue-900 placeholder:text-blue-400 focus:ring-2 focus:ring-blue-300"
        style={{
          boxShadow: "0 4px 32px 0 rgba(30, 64, 175, 0.10)",
          border: "1px solid rgba(30, 64, 175, 0.10)",
        }}
      />
      {showDropdown && query.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 rounded-xl bg-white/40 backdrop-blur-md shadow-lg border border-blue-100 z-10">
          {filtered.length > 0 ? (
            filtered.map(project => (
              <button
                key={project.id}
                className="w-full text-left px-4 py-3 hover:bg-blue-100/60 transition-colors text-blue-900 font-medium rounded-xl"
                onMouseDown={() => {
                  router.push(`/dashboard?projectId=${project.id}`);
                  setShowDropdown(false);
                  setQuery("");
                }}
              >
                {project.name}
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-blue-700">No projects found</div>
          )}
        </div>
      )}
    </div>
  );
}