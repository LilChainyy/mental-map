import { useState, useRef, useEffect } from 'react';
import { useGraphStore } from '../store';

export function MapSwitcher() {
  const maps = useGraphStore((s) => s.maps);
  const currentMapId = useGraphStore((s) => s.currentMapId);
  const isGenerating = useGraphStore((s) => s.isGenerating);
  const isStitching = useGraphStore((s) => s.isStitching);
  const switchMap = useGraphStore((s) => s.switchMap);
  const createMap = useGraphStore((s) => s.createMap);
  const renameMap = useGraphStore((s) => s.renameMap);
  const deleteMap = useGraphStore((s) => s.deleteMap);

  const [isOpen, setIsOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newMapName, setNewMapName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const newMapInputRef = useRef<HTMLInputElement>(null);

  const currentMap = maps.find((m) => m.id === currentMapId);
  const isBusy = isGenerating || isStitching;

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setRenamingId(null);
        setIsCreating(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Focus rename input
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  // Focus new map input
  useEffect(() => {
    if (isCreating) newMapInputRef.current?.focus();
  }, [isCreating]);

  function startRename(mapId: string, currentName: string) {
    setRenamingId(mapId);
    setRenameValue(currentName);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      renameMap(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }

  function commitCreate() {
    const name = newMapName.trim();
    if (name) {
      createMap(name);
      setIsOpen(false);
    }
    setIsCreating(false);
    setNewMapName('');
  }

  function handleDelete(mapId: string, mapName: string) {
    if (confirm(`Delete "${mapName}"? All its nodes and edges will be permanently removed.`)) {
      deleteMap(mapId);
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isBusy}
        className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="max-w-48 truncate">{currentMap?.name ?? 'Loading...'}</span>
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {maps.map((map) => (
            <div
              key={map.id}
              className={`group flex items-center px-3 py-1.5 text-sm ${
                map.id === currentMapId
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {renamingId === map.id ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="flex-1 min-w-0 px-1.5 py-0.5 text-sm border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
                />
              ) : (
                <>
                  <button
                    onClick={() => {
                      switchMap(map.id);
                      setIsOpen(false);
                    }}
                    disabled={isBusy}
                    className="flex-1 text-left truncate cursor-pointer disabled:cursor-not-allowed"
                  >
                    {map.name}
                  </button>
                  <div className="hidden group-hover:flex items-center gap-0.5 ml-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(map.id, map.name);
                      }}
                      className="p-0.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                      title="Rename"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                      </svg>
                    </button>
                    {maps.length > 1 && map.id !== currentMapId && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(map.id, map.name);
                        }}
                        className="p-0.5 text-gray-400 hover:text-red-500 cursor-pointer"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          <div className="border-t border-gray-100 mt-1 pt-1">
            {isCreating ? (
              <div className="px-3 py-1.5">
                <input
                  ref={newMapInputRef}
                  value={newMapName}
                  onChange={(e) => setNewMapName(e.target.value)}
                  onBlur={commitCreate}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitCreate();
                    if (e.key === 'Escape') {
                      setIsCreating(false);
                      setNewMapName('');
                    }
                  }}
                  placeholder="Map name..."
                  className="w-full px-1.5 py-0.5 text-sm border border-blue-300 rounded outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 text-left cursor-pointer"
              >
                + New Map
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
