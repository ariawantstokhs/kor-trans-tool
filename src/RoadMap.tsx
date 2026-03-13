import { useMemo } from 'react';
import { cx } from './utils';

interface RoadMapProps {
  totalNodes: number;
  currentNodeIndex: number;
  phase: 'INPUT' | 'NAVIGATING' | 'ARRIVAL';
}

export function RoadMap({ totalNodes, currentNodeIndex, phase }: RoadMapProps) {
  const width = 900;
  const height = 120;

  const nodes = useMemo(() => {
    const numPoints = totalNodes + 2;
    const spacing = 800 / (numPoints - 1);
    return Array.from({ length: numPoints }).map((_, i) => ({
      x: 50 + (i * spacing),
      y: 60 + Math.sin(i * Math.PI) * 20,
      type: i === 0 ? 'start' : i === numPoints - 1 ? 'end' : 'move'
    }));
  }, [totalNodes]);

  const carIndex = phase === 'ARRIVAL' ? nodes.length - 1 : currentNodeIndex + 1;
  const carPosition = nodes[carIndex] || nodes[0];

  const generatePath = () => {
    if (nodes.length < 2) return '';
    let d = `M ${nodes[0].x} ${nodes[0].y}`;
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const cx = (prev.x + curr.x) / 2;
      d += ` C ${cx} ${prev.y}, ${cx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  };

  const pathD = generatePath();

  if (phase === 'INPUT') return null;

  return (
    <div className="w-full bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30 transition-all overflow-hidden flex justify-center py-4">
      <div className="relative" style={{ width, height }}>
        {/* Background Road */}
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
          <path d={pathD} fill="none" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
          <path d={pathD} fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 8" strokeLinecap="round" />
        </svg>

        {/* Progress Road (Blue) */}
        <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
          <defs>
            <clipPath id="progressClip">
              <rect x="0" y="0" width={carPosition.x} height={height} className="transition-all duration-700 ease-in-out" />
            </clipPath>
          </defs>
          <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="12" strokeLinecap="round" clipPath="url(#progressClip)" />
          <path d={pathD} fill="none" stroke="white" strokeWidth="2" strokeDasharray="8 8" strokeLinecap="round" clipPath="url(#progressClip)" />
        </svg>

        {/* Nodes */}
        {nodes.map((node, i) => {
          const isPassed = i <= carIndex;
          const isCurrent = i === carIndex;

          return (
            <div
              key={i}
              className="absolute flex flex-col items-center justify-start -translate-x-1/2 -translate-y-1/2"
              style={{ left: node.x, top: node.y }}
            >
              {node.type === 'start' && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 border-2 border-emerald-500 flex items-center justify-center text-xs font-bold shadow-sm z-10">
                  EN
                </div>
              )}
              {node.type === 'end' && (
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 border-2 border-emerald-500 flex items-center justify-center text-xs font-bold shadow-sm z-10">
                  KR
                </div>
              )}
              {node.type === 'move' && (
                <div className={cx(
                  "w-5 h-5 rounded-full border-4 shadow-sm z-10 transition-colors duration-500",
                  isPassed ? "bg-blue-500 border-blue-200" : "bg-white border-slate-300",
                  isCurrent && "ring-4 ring-blue-100 animate-pulse"
                )} />
              )}
              <div className={cx(
                "absolute top-8 whitespace-nowrap text-[11px] font-bold tracking-wider transition-colors duration-500",
                isPassed ? "text-slate-800" : "text-slate-400"
              )}>
                {node.type === 'move' ? `S${i}` : ''}
              </div>
            </div>
          );
        })}

        {/* Car */}
        <div
          className="absolute z-20 text-3xl transition-all duration-700 ease-in-out -translate-x-1/2 -translate-y-1/2"
          style={{
            left: carPosition.x,
            top: carPosition.y,
            transform: `translate(-50%, -50%) scaleX(-1) ${phase !== 'ARRIVAL' ? 'scale(1.1)' : 'scale(1)'}`
          }}
        >
          🚗
        </div>
      </div>
    </div>
  );
}
