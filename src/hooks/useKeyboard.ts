import { useEffect } from 'react';
import { useGraphStore } from '../store';

export function useKeyboard() {
  const toggleSearch = useGraphStore((s) => s.toggleSearch);
  const deleteNode = useGraphStore((s) => s.deleteNode);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;
        e.preventDefault();
        deleteNode(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleSearch, deleteNode, selectedNodeId]);
}
