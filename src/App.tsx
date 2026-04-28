import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Layers, Sun, Moon, RotateCcw, Box, HelpCircle, X, Volume2, VolumeX } from 'lucide-react';

type Vec2 = { x: number; y: number };
type Point = { id: string; x: number; y: number };

const SHAPE_TYPES = [
  { id: 'trapezoid', name: '사다리꼴', emoji: '⏢' },
  { id: 'parallelogram', name: '평행사변형', emoji: '▱' },
  { id: 'rhombus', name: '마름모', emoji: '◊' },
  { id: 'rectangle', name: '직사각형', emoji: '▭' },
  { id: 'square', name: '정사각형', emoji: '□' },
] as const;

type ShapeType = typeof SHAPE_TYPES[number]['id'];

const getDistance = (p1: Vec2, p2: Vec2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const getAngle = (p1: Vec2, p2: Vec2, p3: Vec2) => {
  const a = getDistance(p1, p2);
  const b = getDistance(p2, p3);
  const c = getDistance(p1, p3);
  if (a === 0 || b === 0) return 0;
  const cos = (a * a + b * b - c * c) / (2 * a * b);
  return Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
};

// Intersection of L1(p1, p2) and L2(p3, p4)
const getLineIntersection = (p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null => {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (denominator === 0) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;
  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y)
  };
};

const VALUE_COLORS = [
  '#3b82f6', // 파랑
  '#f59e0b', // 주황
  '#8b5cf6', // 보라
  '#ec4899', // 분홍
  '#10b981', // 초록
];

const getGroupedColor = (value: number, allValues: number[], tolerance: number) => {
  const groups: number[] = [];
  allValues.forEach(v => {
    if (!groups.some(g => Math.abs(g - v) < tolerance)) {
      groups.push(v);
    }
  });
  groups.sort((a, b) => a - b);
  const groupIdx = groups.findIndex(g => Math.abs(g - value) < tolerance);
  return VALUE_COLORS[groupIdx % VALUE_COLORS.length];
};

const DEFAULT_POINTS: Record<ShapeType, Point[]> = {
  trapezoid: [{ id: '0', x: 250, y: 200 }, { id: '1', x: 550, y: 200 }, { id: '2', x: 650, y: 450 }, { id: '3', x: 150, y: 450 }],
  parallelogram: [{ id: '0', x: 250, y: 200 }, { id: '1', x: 550, y: 200 }, { id: '2', x: 650, y: 450 }, { id: '3', x: 350, y: 450 }],
  rhombus: [{ id: '0', x: 400, y: 150 }, { id: '1', x: 600, y: 350 }, { id: '2', x: 400, y: 550 }, { id: '3', x: 200, y: 350 }],
  rectangle: [{ id: '0', x: 200, y: 200 }, { id: '1', x: 600, y: 200 }, { id: '2', x: 600, y: 420 }, { id: '3', x: 200, y: 420 }],
  square: [{ id: '0', x: 250, y: 150 }, { id: '1', x: 550, y: 150 }, { id: '2', x: 550, y: 450 }, { id: '3', x: 250, y: 450 }],
};

function solveConstraints(type: ShapeType, pts: Point[], dragIdx: number, newPos: Vec2): Point[] {
  const next = JSON.parse(JSON.stringify(pts));
  const tx = Math.max(80, Math.min(720, newPos.x));
  const ty = Math.max(80, Math.min(520, newPos.y));

  if (type === 'square') {
    const center = pts.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.y / 4 }), { x: 0, y: 0 });
    const side = Math.max(100, Math.max(Math.abs(tx - center.x), Math.abs(ty - center.y)) * 2);
    next[0] = { ...next[0], x: center.x - side / 2, y: center.y - side / 2 };
    next[1] = { ...next[1], x: center.x + side / 2, y: center.y - side / 2 };
    next[2] = { ...next[2], x: center.x + side / 2, y: center.y + side / 2 };
    next[3] = { ...next[3], x: center.x - side / 2, y: center.y + side / 2 };
  } else if (type === 'rectangle') {
    next[dragIdx] = { ...next[dragIdx], x: tx, y: ty };
    if (dragIdx === 0) { next[1].y = ty; next[3].x = tx; }
    else if (dragIdx === 1) { next[0].y = ty; next[2].x = tx; }
    else if (dragIdx === 2) { next[1].x = tx; next[3].y = ty; }
    else if (dragIdx === 3) { next[0].x = tx; next[2].y = ty; }
  } else if (type === 'parallelogram') {
    next[dragIdx] = { ...next[dragIdx], x: tx, y: ty };
    if (dragIdx === 0) { next[2].x = pts[1].x + pts[3].x - tx; next[2].y = pts[1].y + pts[3].y - ty; }
    else if (dragIdx === 1) { next[3].x = pts[0].x + pts[2].x - tx; next[3].y = pts[0].y + pts[2].y - ty; }
    else if (dragIdx === 2) { next[0].x = pts[1].x + pts[3].x - tx; next[0].y = pts[1].y + pts[3].y - ty; }
    else if (dragIdx === 3) { next[1].x = pts[0].x + pts[2].x - tx; next[1].y = pts[0].y + pts[2].y - ty; }
  } else if (type === 'rhombus') {
    const center = { x: 400, y: 350 };
    const dist = getDistance(center, { x: tx, y: ty });
    const angle = Math.atan2(ty - center.y, tx - center.x);
    if (dragIdx % 2 === 0) {
      next[0] = { ...next[0], x: center.x + Math.cos(angle) * dist, y: center.y + Math.sin(angle) * dist };
      next[2] = { ...next[2], x: center.x - Math.cos(angle) * dist, y: center.y - Math.sin(angle) * dist };
    } else {
      next[1] = { ...next[1], x: center.x + Math.cos(angle) * dist, y: center.y + Math.sin(angle) * dist };
      next[3] = { ...next[3], x: center.x - Math.cos(angle) * dist, y: center.y - Math.sin(angle) * dist };
    }
  } else if (type === 'trapezoid') {
    next[dragIdx] = { ...next[dragIdx], x: tx, y: ty };
    if (dragIdx === 0 || dragIdx === 1) { next[0].y = next[1].y = ty; }
    else { next[2].y = next[3].y = ty; }
  }
  return next;
}

export default function App() {
  const [activeType, setActiveType] = useState<ShapeType>('parallelogram');
  const [points, setPoints] = useState<Point[]>(DEFAULT_POINTS.parallelogram);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevPerp = useRef(false);
  const prevAllEqual = useRef(false);

  useEffect(() => {
    // 첫 진입 시 가이드 애니메이션 (메뉴가 우측으로 살짝 이동했다 돌아옴)
    if (scrollContainerRef.current) {
      const el = scrollContainerRef.current;
      setTimeout(() => {
        if (el.scrollWidth > el.clientWidth) {
          el.scrollTo({ left: 40, behavior: 'smooth' });
          setTimeout(() => {
            el.scrollTo({ left: 0, behavior: 'smooth' });
          }, 300);
        }
      }, 500);
    }
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const maxScroll = target.scrollWidth - target.clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(target.scrollLeft / maxScroll);
    } else {
      setScrollProgress(0);
    }
  }, []);

  const playSound = useCallback((type: 'tick' | 'ding' | 'chime') => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      
      if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'ding') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'chime') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1760, now + 0.1);
        gain2.gain.setValueAtTime(0.05, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.6);
      }
    } catch (e) {
      console.warn("Audio play failed", e);
    }
  }, [soundEnabled]);

  const handlePointerDown = useCallback((idx: number, e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraggingIdx(idx);
    playSound('tick');
  }, [playSound]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingIdx === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 800;
    const y = ((e.clientY - rect.top) / rect.height) * 600;
    setPoints(prev => solveConstraints(activeType, prev, draggingIdx, { x, y }));
  }, [draggingIdx, activeType]);

  const stats = useMemo(() => {
    const p = points;
    const sides = p.map((pt, i) => getDistance(pt, p[(i + 1) % 4]));
    const angles = p.map((pt, i) => getAngle(p[(i + 3) % 4], pt, p[(i + 1) % 4]));
    const diag1 = getDistance(p[0], p[2]);
    const diag2 = getDistance(p[1], p[3]);

    const v1 = { x: p[2].x - p[0].x, y: p[2].y - p[0].y };
    const v2 = { x: p[3].x - p[1].x, y: p[3].y - p[1].y };
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    const cosTheta = (mag1 * mag2 === 0) ? 1 : Math.abs(dot / (mag1 * mag2));
    const isPerpendicular = cosTheta < Math.sin(2 * Math.PI / 180); // within 2 degrees

    const formulas = [];
    if (activeType === 'trapezoid') formulas.push('AB ∥ CD (마주보는 한 쌍의 변이 평행해요)');
    if (['parallelogram', 'rhombus', 'rectangle', 'square'].includes(activeType)) {
      formulas.push('AB = CD, BC = DA (마주보는 변의 길이가 같아요)');
      formulas.push('∠A = ∠C, ∠B = ∠D (마주보는 각의 크기가 같아요)');
    }
    if (['rhombus', 'square'].includes(activeType)) {
      formulas.push('AB = BC = CD = DA (네 변의 길이가 모두 같아요)');
      formulas.push('AC ⊥ BD (두 대각선이 직각으로 만나요)');
    }
    if (['rectangle', 'square'].includes(activeType)) {
      formulas.push('∠A=∠B=∠C=∠D=90° (네 각이 모두 직각이에요)');
      formulas.push('AC = BD (두 대각선의 길이가 같아요)');
    }

    const intersection = getLineIntersection(p[0], p[2], p[1], p[3]);

    return { sides, angles, diag1, diag2, formulas, isPerpendicular, intersection };
  }, [points, activeType]);

  useEffect(() => {
    if (draggingIdx === null) return;
    
    // Play sound if properties changed
    if (stats.isPerpendicular && !prevPerp.current) {
      playSound('chime');
    }
    prevPerp.current = stats.isPerpendicular;

    const allEqual = Math.max(...stats.sides) - Math.min(...stats.sides) < 2;
    if (allEqual && !prevAllEqual.current && activeType !== 'square' && activeType !== 'rhombus') {
      playSound('ding');
    }
    prevAllEqual.current = allEqual;
  }, [stats.isPerpendicular, stats.sides, draggingIdx, playSound, activeType]);

  return (
    <div style={{ fontFamily: "'NanumSquareRound', 'Nunito', sans-serif" }} className={`min-h-[100dvh] w-full flex flex-col transition-colors duration-700 ${isDark ? 'bg-[#121212] text-zinc-100' : 'bg-[#fffefe] text-zinc-800'} safe-area-padding overflow-x-hidden`}>
      
      {/* 상단 통합 헤더 */}
      <header className={`w-full shrink-0 border-b ${isDark ? 'border-zinc-800 bg-[#121212]/90' : 'border-zinc-200/60 bg-[#ffffff]/90'} backdrop-blur-xl z-30 sticky top-0 px-4 py-3 md:px-8 md:py-5 shadow-sm`}>
        <div className="max-w-screen-xl mx-auto flex flex-col gap-4 md:gap-5 w-full">
          
          {/* 1. 타이틀 및 보조 버튼 */}
          <div className="flex items-start md:items-center justify-between w-full">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 md:w-8 md:h-8 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <Layers className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </div>
                <h1 className={`text-[18px] md:text-[24px] font-black tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`}>
                  사각형 탐구 연구소
                </h1>
              </div>
              <p className={`text-[12px] md:text-[14px] font-extrabold ml-1 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                도형을 요리조리 움직이며 성질을 찾아보세요!
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-2 mt-1 md:mt-0">
               <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-2.5 md:p-3 rounded-2xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${isDark ? 'bg-zinc-800/80 border-white/5 text-zinc-400 hover:bg-zinc-700' : 'bg-white border-zinc-100 text-zinc-500 hover:bg-zinc-50'}`}>
                  {soundEnabled ? <Volume2 className="w-4 h-4 mx-auto" /> : <VolumeX className="w-4 h-4 mx-auto" />}
               </button>
               <button onClick={() => setIsDark(!isDark)} className={`p-2.5 md:p-3 rounded-2xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 border ${isDark ? 'bg-zinc-800/80 border-white/5 text-zinc-400 hover:bg-zinc-700' : 'bg-white border-zinc-100 text-zinc-500 hover:bg-zinc-50'}`}>
                  {isDark ? <Sun className="w-4 h-4 mx-auto" /> : <Moon className="w-4 h-4 mx-auto" />}
               </button>
            </div>
          </div>

          {/* 2. 사각형 선택 메뉴 */}
          <div className="w-full min-w-0 relative flex flex-col items-center">
            <div className="w-full relative">
              <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex gap-2 md:gap-4 overflow-x-auto pb-4 pt-2 no-scrollbar justify-start flex-nowrap scroll-smooth snap-x relative z-10 pr-8" 
                style={{ scrollBehavior: 'smooth' }}
              >
                 {SHAPE_TYPES.map(shape => (
                   <div key={shape.id} className="relative flex flex-col items-center shrink-0 snap-center group">
                     {/* 메뉴별 배경 하이라이트 (시각적 구분 강화) */}
                     <div className={`absolute -inset-1.5 rounded-[2rem] transition-colors duration-300 -z-10 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800/50 opacity-0 group-hover:opacity-100`} />
                     
                     <button
                       onClick={(e) => { 
                         setActiveType(shape.id); 
                         setPoints(DEFAULT_POINTS[shape.id]); 
                         setShowProperties(false); 
                         e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                       }}
                       className={`whitespace-nowrap px-4 py-2 md:px-6 md:py-2.5 rounded-full border-2 text-[14px] md:text-[16px] font-black transition-all flex items-center gap-2 focus:outline-none relative ${activeType === shape.id 
                         ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/30' 
                         : isDark ? 'bg-zinc-800/60 border-transparent text-zinc-300 hover:text-zinc-100' : 'bg-white border-zinc-100 text-zinc-500 hover:text-zinc-700 shadow-[0_2px_8px_rgba(0,0,0,0.02)]'}`}
                     >
                       <span className="text-[16px] md:text-[18px] mb-[1px]">{shape.emoji}</span>
                       <span className="word-keep-all whitespace-nowrap">{shape.name}</span>
                     </button>
                     
                     {/* 선택된 탭 하단 인디케이터 */}
                     {activeType === shape.id && (
                       <motion.div
                         layoutId="activeShapeTab"
                         className="absolute -bottom-1.5 h-[6px] w-[80%] bg-emerald-500 rounded-full shadow-[0_2px_6px_rgba(16,185,129,0.4)]"
                         initial={false}
                         transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
                       />
                     )}
                   </div>
                 ))}
              </div>

              {/* 오른쪽 흐림 효과 */}
              <div 
                className={`absolute right-0 top-0 bottom-2 w-16 pointer-events-none transition-opacity duration-300 z-20 bg-gradient-to-l ${isDark ? 'from-[#121212] to-transparent' : 'from-[#fffefe] to-transparent'}`}
                style={{ opacity: scrollProgress < 0.95 ? 1 : 0 }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* 메인 탐구 영역 */}
      <main ref={containerRef} className="flex-1 relative flex flex-col min-h-0 bg-transparent">
        {/* 배경 그리드 */}
        <div className={`absolute inset-0 z-0 ${isDark ? 'bg-[radial-gradient(#ffffff10_1.5px,transparent_1.5px)]' : 'bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)]'} [background-size:40px_40px]`} />
        
        {/* 설명 성질 피드백 */}
        <div className="absolute top-4 left-4 md:top-6 md:left-6 z-40 pointer-events-none word-keep-all space-y-4 max-w-[calc(100vw-32px)] md:max-w-md">
           <AnimatePresence>
             {showProperties ? (
               <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`p-4 md:p-5 rounded-2xl shadow-2xl border pointer-events-auto backdrop-blur-3xl ${isDark ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-zinc-200'}`}>
                 <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                     <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none">도형의 특징</p>
                   </div>
                   <button onClick={() => setShowProperties(false)} className={`p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                     <X className="w-4 h-4" />
                   </button>
                 </div>
                 <div className="space-y-3">
                    {stats.formulas.map((f, i) => (
                      <div key={i} className={`flex items-start gap-3 text-[13px] md:text-sm font-bold tracking-tight leading-snug word-keep-all ${isDark ? 'text-zinc-100' : 'text-zinc-800'}`}>
                         <Box className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                         <span>{f}</span>
                      </div>
                    ))}
                 </div>
               </motion.div>
             ) : (
               <button onClick={() => setShowProperties(true)} className={`pointer-events-auto px-4 py-3 md:px-5 md:py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 transition-all active:scale-95 ${isDark ? 'bg-zinc-900/90 border-white/10 text-zinc-200 hover:bg-zinc-800' : 'bg-white/90 border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                 <HelpCircle className="w-5 h-5 text-emerald-500" />
                 <span className="text-[14px] md:text-[15px] font-black whitespace-nowrap">이 사각형의 성질 보기</span>
               </button>
             )}
           </AnimatePresence>
        </div>

        {/* 캔버스 영역 */}
        <div className="flex-1 relative flex items-center justify-center p-2 md:p-12 min-h-0 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox="0 0 800 600"
            className="w-full h-full max-w-[800px] max-h-[800px] overflow-visible touch-none drop-shadow-2xl"
            onPointerMove={handlePointerMove}
            onPointerUp={() => setDraggingIdx(null)}
            onPointerLeave={() => setDraggingIdx(null)}
          >
            {/* Shape Body */}
            <motion.path
              d={points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ') + ' Z'}
              fill={isDark ? "rgba(16, 185, 129, 0.12)" : "rgba(16, 185, 129, 0.05)"}
              stroke="#10b981"
              strokeWidth="8"
              strokeLinejoin="round"
              className="transition-colors duration-500"
            />

            {/* Diagonals */}
            <g className="opacity-40">
              <line x1={points[0].x} y1={points[0].y} x2={points[2].x} y2={points[2].y} stroke="#10b981" strokeWidth="4" strokeDasharray="16 12" strokeLinecap="round" />
              <line x1={points[1].x} y1={points[1].y} x2={points[3].x} y2={points[3].y} stroke="#10b981" strokeWidth="4" strokeDasharray="16 12" strokeLinecap="round" />
            </g>

            {/* Right Angle Symbol at Diagonal Intersection */}
            {stats.isPerpendicular && stats.intersection && (
              <g transform={`translate(${stats.intersection.x}, ${stats.intersection.y}) rotate(${Math.atan2(points[2].y - points[0].y, points[2].x - points[0].x) * 180 / Math.PI})`}>
                <path d="M 18 0 L 18 18 L 0 18" fill="transparent" stroke="#ef4444" strokeWidth="4" strokeLinejoin="miter" strokeLinecap="square" />
              </g>
            )}

            {/* Diagonal Labels */}
            <g>
              <g transform={`translate(${(points[0].x + points[2].x)/2}, ${(points[0].y + points[2].y)/2 - 35})`}>
                <rect x="-65" y="-20" width="130" height="40" rx="20" fill={isDark ? "rgba(24, 24, 27, 0.9)" : "rgba(255, 255, 255, 0.9)"} className="shadow-xl" />
                <text textAnchor="middle" dominantBaseline="middle" className={`text-[16px] md:text-[18px] font-black ${isDark ? 'fill-emerald-400' : 'fill-emerald-600'}`}>대각선: {(stats.diag1/40).toFixed(1)}cm</text>
              </g>
              <g transform={`translate(${(points[1].x + points[3].x)/2}, ${(points[1].y + points[3].y)/2 + 35})`}>
                <rect x="-65" y="-20" width="130" height="40" rx="20" fill={isDark ? "rgba(24, 24, 27, 0.9)" : "rgba(255, 255, 255, 0.9)"} className="shadow-xl" />
                <text textAnchor="middle" dominantBaseline="middle" className={`text-[16px] md:text-[18px] font-black ${isDark ? 'fill-emerald-400' : 'fill-emerald-600'}`}>대각선: {(stats.diag2/40).toFixed(1)}cm</text>
              </g>
            </g>

            {/* Sides Labels */}
            {points.map((p, i) => {
              const p2 = points[(i + 1) % 4];
              const midX = (p.x + p2.x) / 2;
              const midY = (p.y + p2.y) / 2;
              const angle = Math.atan2(p2.y - p.y, p2.x - p.x);
              const ox = Math.cos(angle - Math.PI / 2) * 60;
              const oy = Math.sin(angle - Math.PI / 2) * 60;
              const color = getGroupedColor(stats.sides[i], stats.sides, 2);
              return (
                <g key={`side-${i}`} transform={`translate(${midX + ox}, ${midY + oy})`}>
                  <rect x="-55" y="-22" width="110" height="44" rx="22" fill={color} className="shadow-2xl" />
                  <text textAnchor="middle" dominantBaseline="middle" className="text-[17px] md:text-[20px] font-black fill-white">
                    {(stats.sides[i] / 40).toFixed(1)} <tspan className="text-[14px]">cm</tspan>
                  </text>
                </g>
              );
            })}

            {/* Angle Indicators */}
            {points.map((p, i) => {
              const prev = points[(i + 3) % 4];
              const next = points[(i + 1) % 4];
              const a1 = Math.atan2(prev.y - p.y, prev.x - p.x);
              const a2 = Math.atan2(next.y - p.y, next.x - p.x);
              let mid = (a1 + a2) / 2;
              if (Math.abs(a1 - a2) > Math.PI) mid += Math.PI;
              const dist = 90;
              const ang = Math.round(stats.angles[i]);
              const color = getGroupedColor(ang, stats.angles, 1.5);
              return (
                <g key={`ang-${i}`} transform={`translate(${p.x + Math.cos(mid) * dist}, ${p.y + Math.sin(mid) * dist})`}>
                  <circle r="36" fill={color} opacity={isDark ? 0.25 : 0.2} />
                  <text textAnchor="middle" dominantBaseline="middle" style={{fill: color}} className="text-[20px] md:text-[24px] font-black italic tracking-tighter">
                    {ang}°
                  </text>
                </g>
              );
            })}

            {/* Corner Labels (A, B, C, D) */}
            {points.map((p, i) => {
              const prev = points[(i + 3) % 4];
              const next = points[(i + 1) % 4];
              const a1 = Math.atan2(prev.y - p.y, prev.x - p.x);
              const a2 = Math.atan2(next.y - p.y, next.x - p.x);
              let mid = (a1 + a2) / 2;
              if (Math.abs(a1 - a2) > Math.PI) mid += Math.PI;
              const offset = 48;
              const label = String.fromCharCode(65 + i);
              return (
                <g key={`label-${i}`} transform={`translate(${p.x + Math.cos(mid) * offset}, ${p.y + Math.sin(mid) * offset})`}>
                  <circle r="18" fill={isDark ? "#3f3f46" : "#fff"} stroke={isDark ? "#fff" : "#10b981"} strokeWidth="3" />
                  <text textAnchor="middle" dominantBaseline="middle" className={`text-[16px] xl:text-[18px] font-black ${isDark ? 'fill-white' : 'fill-emerald-700'}`}>
                    {label}
                  </text>
                </g>
              );
            })}

            {/* Drag Handles */}
            {points.map((p, i) => (
              <motion.g
                key={p.id}
                onPointerDown={(e) => handlePointerDown(i, e)}
                className="cursor-grab active:cursor-grabbing group"
              >
                <circle cx={p.x} cy={p.y} r={55} fill="transparent" />
                <motion.circle
                   cx={p.x} cy={p.y} r={22}
                   className={`transition-all duration-300 ${draggingIdx === i ? 'stroke-white stroke-[8px]' : 'stroke-white dark:stroke-zinc-800 stroke-[5px]'}`}
                   fill="#10b981"
                   initial={false}
                   animate={{ 
                     scale: draggingIdx === i ? 1.15 : 1,
                     fill: draggingIdx === i ? '#34d399' : '#10b981'
                   }}
                   whileHover={{ scale: 1.25 }}
                />
              </motion.g>
            ))}
          </svg>
        </div>



        {/* 하단 정보창 */}
        <div className="shrink-0 p-4 pb-6 md:pb-10 flex flex-col items-center gap-4 z-20">
           <div className={`px-5 py-3.5 md:px-8 md:py-5 rounded-full backdrop-blur-2xl border-2 flex flex-wrap justify-center items-center gap-4 md:gap-8 text-[14px] md:text-[16px] font-black shadow-2xl transition-all ${isDark ? 'bg-zinc-900/90 border-zinc-800' : 'bg-white/90 border-emerald-100 hover:border-emerald-200'}`}>
              <div className="flex items-center gap-2.5 md:gap-3">
                <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className={`word-keep-all whitespace-nowrap ${isDark ? 'text-zinc-200' : 'text-zinc-700'}`}>
                  색깔이 같으면 값도 같아요
                </span>
              </div>
              <div className={`w-1.5 h-1.5 rounded-full hidden sm:block ${isDark ? 'bg-zinc-700' : 'bg-emerald-200'}`} />
              <div className="flex items-center gap-2.5 md:gap-3">
                <button 
                   onClick={() => { setPoints(DEFAULT_POINTS[activeType]); setShowProperties(false); }}
                   className="flex items-center gap-2 md:gap-2.5 text-zinc-400 hover:text-emerald-500 transition-all font-black active:scale-95 px-3 py-1.5 rounded-2xl hover:bg-emerald-50 dark:hover:bg-zinc-800"
                >
                  <RotateCcw className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="word-keep-all whitespace-nowrap">다시 그리기</span>
                </button>
              </div>
           </div>
        </div>
      </main>

      <style>{`
        @font-face {
          font-family: 'NanumSquareRound';
          src: url('https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_two@1.0/NanumSquareRound.woff') format('woff');
          font-weight: 400 900;
          font-style: normal;
        }
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .word-keep-all { word-break: keep-all; }
        * { -webkit-tap-highlight-color: transparent; }
        .safe-area-padding {
          padding-top: env(safe-area-inset-top);
          padding-bottom: env(safe-area-inset-bottom);
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
        }
        svg {
          image-rendering: optimizeSpeed;
        }
      `}</style>
    </div>
  );
}
