import type { GraphNode, EdgeColor } from '../types';
import { EDGE_COLORS } from '../types';

export interface PendingConnection {
  targetId: string;
  color: EdgeColor;
}

interface ConnectionPickerProps {
  existingNodes: GraphNode[];
  selectedConnections: PendingConnection[];
  onChange: (connections: PendingConnection[]) => void;
}

export function ConnectionPicker({ existingNodes, selectedConnections, onChange }: ConnectionPickerProps) {
  const toggleNode = (nodeId: string) => {
    const existing = selectedConnections.find((c) => c.targetId === nodeId);
    if (existing) {
      onChange(selectedConnections.filter((c) => c.targetId !== nodeId));
    } else {
      onChange([...selectedConnections, { targetId: nodeId, color: 'blue' }]);
    }
  };

  const toggleColor = (nodeId: string) => {
    onChange(
      selectedConnections.map((c) =>
        c.targetId === nodeId
          ? { ...c, color: (c.color === 'blue' ? 'red' : 'blue') as EdgeColor }
          : c
      )
    );
  };

  return (
    <div>
      <label className="block text-sm text-gray-600 mb-1">Connect to</label>
      <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 space-y-1">
        {existingNodes.map((node) => {
          const connection = selectedConnections.find((c) => c.targetId === node.id);
          return (
            <div key={node.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!connection}
                onChange={() => toggleNode(node.id)}
                className="accent-blue-600"
              />
              <span className="flex-1 text-gray-700 truncate">{node.label}</span>
              {connection && (
                <button
                  type="button"
                  onClick={() => toggleColor(node.id)}
                  className="text-xs px-2 py-0.5 rounded text-white cursor-pointer"
                  style={{ backgroundColor: EDGE_COLORS[connection.color] }}
                >
                  {connection.color === 'blue' ? 'Related' : 'Conflicts'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
