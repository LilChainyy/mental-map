import { useState, useEffect, useCallback } from 'react';
import { useGraphStore } from '../store';
import { EDGE_COLORS } from '../types';
import { ColorPicker } from './ColorPicker';

interface DetailPanelProps {
  nodeId: string;
}

export function DetailPanel({ nodeId }: DetailPanelProps) {
  const nodes = useGraphStore((s) => s.nodes);
  const updateNode = useGraphStore((s) => s.updateNode);
  const deleteNode = useGraphStore((s) => s.deleteNode);
  const selectNode = useGraphStore((s) => s.selectNode);
  const getConnectionCount = useGraphStore((s) => s.getConnectionCount);
  const getConnectedEdges = useGraphStore((s) => s.getConnectedEdges);

  const node = nodes.find((n) => n.id === nodeId);

  const [description, setDescription] = useState(node?.description ?? '');
  const [notes, setNotes] = useState(node?.notes ?? '');
  const [links, setLinks] = useState(node?.links?.join('\n') ?? '');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (node) {
      setDescription(node.description ?? '');
      setNotes(node.notes ?? '');
      setLinks(node.links?.join('\n') ?? '');
      setShowDeleteConfirm(false);
    }
  }, [nodeId, node?.description, node?.notes, node?.links]);

  const handleSave = useCallback(() => {
    if (!node) return;
    updateNode(nodeId, {
      description,
      notes,
      links: links.split('\n').map((l) => l.trim()).filter(Boolean),
    });
  }, [nodeId, description, notes, links, updateNode, node]);

  const handleColorChange = useCallback(
    (color: string) => {
      updateNode(nodeId, { color });
    },
    [nodeId, updateNode]
  );

  const handleDelete = useCallback(() => {
    const connCount = getConnectionCount(nodeId);
    if (connCount > 0 && !showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    deleteNode(nodeId);
    selectNode(null);
  }, [nodeId, deleteNode, selectNode, getConnectionCount, showDeleteConfirm]);

  if (!node) return null;

  const connectionCount = getConnectionCount(nodeId);
  const connectedEdges = getConnectedEdges(nodeId);

  return (
    <div className="w-80 border-l border-gray-200 bg-white p-4 overflow-y-auto shrink-0">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-gray-800 truncate pr-2">{node.label}</h2>
        <button
          onClick={() => selectNode(null)}
          className="text-gray-400 hover:text-gray-600 text-lg shrink-0 cursor-pointer"
        >
          &times;
        </button>
      </div>

      <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-3 ${node.isUserAdded ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
        {node.isUserAdded ? 'User added' : 'AI generated'}
      </span>

      <label className="block text-xs text-gray-500 mb-1">Color</label>
      <div className="mb-3">
        <ColorPicker value={node.color} onChange={handleColorChange} />
      </div>

      <label className="block text-xs text-gray-500 mb-1">Description</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={handleSave}
        rows={4}
        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm mb-3 resize-none"
        placeholder="Short explanation or notes..."
      />

      <label className="block text-xs text-gray-500 mb-1">Notes</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleSave}
        rows={3}
        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm mb-3 resize-none"
        placeholder="Personal notes..."
      />

      <label className="block text-xs text-gray-500 mb-1">Links (one per line)</label>
      <textarea
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        onBlur={handleSave}
        rows={3}
        className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm mb-3 resize-none"
        placeholder="https://..."
      />

      {connectedEdges.length > 0 && (
        <div className="mb-3">
          <label className="block text-xs text-gray-500 mb-1">Connections</label>
          <div className="space-y-1">
            {connectedEdges.map((edge) => {
              const otherId = edge.source === nodeId ? edge.target : edge.source;
              const otherNode = nodes.find((n) => n.id === otherId);
              if (!otherNode) return null;
              return (
                <div key={edge.id} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: EDGE_COLORS[edge.color] }}
                  />
                  <button
                    onClick={() => selectNode(otherId)}
                    className="text-gray-700 hover:text-blue-600 truncate text-left cursor-pointer"
                  >
                    {otherNode.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-400 mb-4">
        {connectionCount} connection{connectionCount !== 1 ? 's' : ''} &middot; Created {new Date(node.createdAt).toLocaleDateString()}
      </div>

      {showDeleteConfirm ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm">
          <p className="text-red-700 mb-2">This node has {connectionCount} connection(s). Delete anyway?</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="bg-red-600 text-white text-xs px-3 py-1 rounded-md cursor-pointer"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="text-gray-500 text-xs px-3 py-1 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleDelete}
          className="text-red-500 text-xs hover:text-red-700 cursor-pointer"
        >
          Delete node
        </button>
      )}
    </div>
  );
}
