import { useGraphStore } from '../store';
import { useStitchEdges } from '../hooks/useStitchEdges';
import { MapSwitcher } from './MapSwitcher';

export function Toolbar() {
  const openAddModal = useGraphStore((s) => s.openAddModal);
  const toggleSearch = useGraphStore((s) => s.toggleSearch);
  const nodes = useGraphStore((s) => s.nodes);
  const isStitching = useGraphStore((s) => s.isStitching);
  const isHandTrackingEnabled = useGraphStore((s) => s.isHandTrackingEnabled);
  const setHandTracking = useGraphStore((s) => s.setHandTracking);
  const { manualStitch } = useStitchEdges();

  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center px-4 gap-3 shrink-0">
      <div className="mr-auto">
        <MapSwitcher />
      </div>
      {nodes.length >= 2 && (
        <button
          onClick={manualStitch}
          disabled={isStitching}
          className="text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-md px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStitching ? 'Stitching...' : 'Find connections'}
        </button>
      )}
      <button
        onClick={() => setHandTracking(!isHandTrackingEnabled)}
        className={`text-sm border rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
          isHandTrackingEnabled
            ? 'bg-green-500 text-white border-green-500 hover:bg-green-600'
            : 'text-gray-500 hover:text-gray-800 border-gray-300'
        }`}
      >
        Hand Control
      </button>
      <button
        onClick={toggleSearch}
        className="text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-md px-2.5 py-1 transition-colors cursor-pointer"
      >
        Search <kbd className="ml-1 text-xs text-gray-400">&#8984;K</kbd>
      </button>
      <button
        onClick={openAddModal}
        className="text-sm bg-blue-600 text-white rounded-md px-3 py-1 hover:bg-blue-700 transition-colors cursor-pointer"
      >
        + Add Concept
      </button>
    </div>
  );
}
