import { Graph3D } from './components/Graph3D';
import { Toolbar } from './components/Toolbar';
import { DetailPanel } from './components/DetailPanel';
import { AddConceptModal } from './components/AddConceptModal';
import { SearchBar } from './components/SearchBar';
import { LoadingOverlay } from './components/LoadingOverlay';
import { useGraphStore } from './store';
import { useKeyboard } from './hooks/useKeyboard';
import { useEffect } from 'react';

export default function App() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const nodes = useGraphStore((s) => s.nodes);
  const loadFromDB = useGraphStore((s) => s.loadFromDB);
  const isSwitchingMap = useGraphStore((s) => s.isSwitchingMap);

  useKeyboard();

  useEffect(() => {
    loadFromDB();
  }, [loadFromDB]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white">
      <Toolbar />
      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative">
          {isSwitchingMap ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-400 text-sm">Loading map...</p>
            </div>
          ) : (
            <>
              <Graph3D />
              {nodes.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-gray-400 text-sm">Search a concept to get started</p>
                </div>
              )}
            </>
          )}
        </div>
        {selectedNodeId && <DetailPanel nodeId={selectedNodeId} />}
      </div>
      <AddConceptModal />
      <SearchBar />
      <LoadingOverlay />
    </div>
  );
}
