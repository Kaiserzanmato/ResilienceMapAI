"use client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const setSelected = useAppStore((s) => s.setSelected);
  const ref = useRef<HTMLDivElement>(null);

  // Debounced search per performance requirements
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["geocode", debounced],
    queryFn: () => api.geocode(debounced),
    enabled: debounced.trim().length >= 2,
  });

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const results = data?.results ?? [];

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="glass-strong flex h-11 items-center gap-2.5 rounded-2xl px-4">
        {isFetching ? (
          <Loader2 size={16} className="animate-spin text-[var(--accent)]" aria-hidden="true" />
        ) : (
          <Search size={16} className="text-[var(--fg-muted)]" aria-hidden="true" />
        )}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search a location…"
          aria-label="Search a location"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls="location-search-results"
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--fg-muted)]"
        />
      </div>

      {open && results.length > 0 && (
        <ul
          id="location-search-results"
          role="listbox"
          aria-label="Search results"
          className="glass-strong absolute inset-x-0 top-13 z-50 max-h-72 overflow-y-auto rounded-2xl p-1.5"
        >
          {results.map((r) => (
            <li key={`${r.name}-${r.lat}`}>
              <button
                role="option"
                aria-selected="false"
                onClick={() => {
                  setSelected({ lat: r.lat, lng: r.lng, name: r.name });
                  setQuery(r.name);
                  setOpen(false);
                }}
                className="focus-ring flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]"
              >
                <MapPin size={14} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
                <span className="font-medium">{r.name}</span>
                <span className="ml-auto text-xs text-[var(--fg-muted)]">{r.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
