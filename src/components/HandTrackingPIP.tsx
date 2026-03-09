import { useGraphStore } from '../store';

interface HandTrackingPIPProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export function HandTrackingPIP({ videoRef, canvasRef }: HandTrackingPIPProps) {
  const isEnabled = useGraphStore((s) => s.isHandTrackingEnabled);

  if (!isEnabled) return null;

  return (
    <div className="absolute bottom-4 right-4 z-50 rounded-lg overflow-hidden shadow-lg border border-gray-300 bg-black"
      style={{ width: 192, height: 144 }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        width={192}
        height={144}
        className="absolute inset-0 w-full h-full"
        style={{ transform: 'scaleX(-1)' }}
      />
      <div className="absolute top-1.5 left-1.5 bg-green-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
        Hand Control
      </div>
    </div>
  );
}
