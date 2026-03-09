import { useGraphStore } from '../store';

export function LoadingOverlay() {
  const isGenerating = useGraphStore((s) => s.isGenerating);
  const isStitching = useGraphStore((s) => s.isStitching);

  if (!isGenerating && !isStitching) return null;

  const message = isGenerating
    ? 'Generating knowledge graph...'
    : 'Finding cross-cluster connections...';

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-40 pointer-events-none">
      <div className="bg-white rounded-lg shadow-xl px-6 py-4 flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-700">{message}</span>
      </div>
    </div>
  );
}
