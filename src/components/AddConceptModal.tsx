import { useState, useCallback } from 'react';
import { useGraphStore } from '../store';
import { useGenerateGraph } from '../hooks/useGenerateGraph';
import { ConnectionPicker, type PendingConnection } from './ConnectionPicker';

export function AddConceptModal() {
  const isAddModalOpen = useGraphStore((s) => s.isAddModalOpen);
  const closeAddModal = useGraphStore((s) => s.closeAddModal);
  const addNode = useGraphStore((s) => s.addNode);
  const addEdge = useGraphStore((s) => s.addEdge);
  const recalcConnectionCounts = useGraphStore((s) => s.recalcConnectionCounts);
  const nodes = useGraphStore((s) => s.nodes);
  const { generate } = useGenerateGraph();

  const [label, setLabel] = useState('');
  const [connections, setConnections] = useState<PendingConnection[]>([]);

  const handleSubmit = useCallback(async () => {
    if (!label.trim()) return;
    const concept = label.trim();

    if (connections.length > 0) {
      // Manual connections specified: add node + edges without AI generation
      const newNode = await addNode(concept, { isUserAdded: true });
      for (const conn of connections) {
        await addEdge(newNode.id, conn.targetId, conn.color);
      }
      await recalcConnectionCounts();
    } else {
      // No manual connections: trigger AI generation (same as Search > Generate)
      generate(concept);
    }

    setLabel('');
    setConnections([]);
    closeAddModal();
  }, [label, connections, addNode, addEdge, recalcConnectionCounts, closeAddModal, generate]);

  const handleClose = useCallback(() => {
    setLabel('');
    setConnections([]);
    closeAddModal();
  }, [closeAddModal]);

  if (!isAddModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Add Concept</h2>

        <label className="block text-sm text-gray-600 mb-1">Name</label>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. Binary Search Tree"
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />

        {nodes.length > 0 && (
          <ConnectionPicker
            existingNodes={nodes}
            selectedConnections={connections}
            onChange={setConnections}
          />
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={handleClose}
            className="text-sm text-gray-500 px-3 py-1.5 cursor-pointer hover:text-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!label.trim()}
            className="text-sm bg-blue-600 text-white rounded-md px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
