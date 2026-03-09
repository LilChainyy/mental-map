import { useState, useCallback, useRef, useEffect } from 'react';
import { useGraphStore } from '../store';
import { useGenerateGraph } from '../hooks/useGenerateGraph';

export function SearchBar() {
  const isSearchOpen = useGraphStore((s) => s.isSearchOpen);
  const toggleSearch = useGraphStore((s) => s.toggleSearch);
  const nodes = useGraphStore((s) => s.nodes);
  const selectNode = useGraphStore((s) => s.selectNode);
  const setFocusNode = useGraphStore((s) => s.setFocusNode);
  const { generate } = useGenerateGraph();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredNodes = nodes.filter((n) =>
    n.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isSearchOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearchOpen]);

  const handleSelect = useCallback(
    (nodeId: string) => {
      setFocusNode(nodeId);
      selectNode(nodeId);
      toggleSearch();
    },
    [setFocusNode, selectNode, toggleSearch]
  );

  const handleGenerate = useCallback(() => {
    if (!query.trim()) return;
    toggleSearch();
    generate(query.trim());
  }, [query, toggleSearch, generate]);

  if (!isSearchOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-start justify-center pt-24 z-50" onClick={toggleSearch}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search concepts or generate new..."
          className="w-full px-4 py-3 text-sm border-b border-gray-200 rounded-t-lg focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Escape') toggleSearch();
            if (e.key === 'Enter' && filteredNodes.length > 0) {
              handleSelect(filteredNodes[0].id);
            }
          }}
        />
        <ul className="max-h-60 overflow-y-auto">
          {filteredNodes.map((node) => (
            <li key={node.id}>
              <button
                onClick={() => handleSelect(node.id)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                {node.label}
              </button>
            </li>
          ))}
          {query.trim() && (
            <li>
              <button
                onClick={handleGenerate}
                className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 cursor-pointer border-t border-gray-100"
              >
                Generate graph for &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
          {filteredNodes.length === 0 && !query && (
            <li className="px-4 py-3 text-sm text-gray-400">Type to search or generate</li>
          )}
        </ul>
      </div>
    </div>
  );
}
