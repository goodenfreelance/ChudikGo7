import React, { useState, useEffect } from 'react';
import { X, Plus, RotateCcw, Sparkles, Scale, Zap, Trash2, ArrowUp, ArrowRight, ArrowDown, ArrowLeft, ZoomIn, ZoomOut, Maximize2, Edit3, Crosshair, AlertTriangle } from 'lucide-react';
import { Creature, CreatureElement, ElementType } from '../types';
import { calculatePhysicsForces, getCreatureConnectivity } from '../utils/creatures';

interface CreatureEditorProps {
  isOpen: boolean;
  editingCreature?: Creature | null;
  token?: string | null;
  onClose: () => void;
  onSpawnCreature?: (name: string, elements: CreatureElement[], color: string, editingCreatureId?: string) => void;
  onSave?: (name: string, elements: CreatureElement[], color: string, editingCreatureId?: string) => void;
  onSaveToDB?: (name: string, elements: CreatureElement[], color: string) => void;
}

const ELEMENT_TOOLS: { type: ElementType | 'eraser'; label: string; symbol: string; weight: number; desc: string }[] = [
  {
    type: 'head',
    label: 'Голова / Переднеe направление (👁️)',
    symbol: '👁️',
    weight: 0,
    desc: 'Задает ВПЕРЕД для чудика и ориентацию глаз',
  },
  {
    type: 'joint',
    label: 'Шарнир (Узел)',
    symbol: '◯',
    weight: 0,
    desc: 'Узел вращения на пересечении клеток (Вес = 0)',
  },
  {
    type: 'edge-h',
    label: 'Ребро горизонтальное (—)',
    symbol: '—',
    weight: 1,
    desc: 'Каркасная балка длиной 1 клетка (Вес = 1)',
  },
  {
    type: 'edge-v',
    label: 'Ребро вертикальное (|)',
    symbol: '|',
    weight: 1,
    desc: 'Каркасная балка длиной 1 клетка (Вес = 1)',
  },
  {
    type: 'edge-d1',
    label: 'Ребро диагональное / (↙-↗)',
    symbol: '/',
    weight: 1,
    desc: 'Диагональ / (соединяет низ-лево и верх-право, Вес = 1)',
  },
  {
    type: 'edge-d2',
    label: 'Ребро диагональное \\ (↖-↘)',
    symbol: '\\',
    weight: 1,
    desc: 'Диагональ \\ (соединяет верх-лево и низ-право, Вес = 1)',
  },
  {
    type: 'muscle-left',
    label: 'Мышца сгиба влево (⟲)',
    symbol: '⟲',
    weight: 0,
    desc: 'Задает импульс вращения влево на шарнире',
  },
  {
    type: 'muscle-right',
    label: 'Мышца сгиба вправо (⟳)',
    symbol: '⟳',
    weight: 0,
    desc: 'Задает импульс вращения вправо на шарнире',
  },
  {
    type: 'muscle-random-left',
    label: 'Случайная мышца влево (🎲⟲)',
    symbol: '🎲⟲',
    weight: 0,
    desc: 'Сокращается со случайным шансом (5%-90%)',
  },
  {
    type: 'muscle-random-right',
    label: 'Случайная мышца вправо (🎲⟳)',
    symbol: '🎲⟳',
    weight: 0,
    desc: 'Сокращается со случайным шансом (5%-90%)',
  },
  {
    type: 'eraser',
    label: 'Удалить / Ластик (❌)',
    symbol: '❌',
    weight: 0,
    desc: 'Нажмите на любой элемент для его удаления',
  },
];

export const CreatureEditor: React.FC<CreatureEditorProps> = ({
  isOpen,
  editingCreature,
  token,
  onClose,
  onSpawnCreature,
  onSave,
  onSaveToDB,
}) => {
  const [name, setName] = useState<string>('Мой Физический Чудик');
  const [selectedTool, setSelectedTool] = useState<ElementType | 'eraser'>('head');
  const [selectedColor, setSelectedColor] = useState<string>('#6366f1');
  const [headAngle, setHeadAngle] = useState<number>(270); // 270 = Up (вверх)
  const [randomChance, setRandomChance] = useState<number>(35); // Настраиваемая вероятность случайных мышц (5% - 90%)
  
  // Editor Camera & Grid Radius State
  const [gridRadius, setGridRadius] = useState<number>(4); // Радиус сетки (4 = 9x9, 5 = 11x11, 6 = 13x13, 7 = 15x15)
  const [editorZoom, setEditorZoom] = useState<number>(1); // Масштабирование (0.3x - 3.0x)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 }); // Панорамирование камеры
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState<boolean>(false);

  // Hover & selection states for interactive element editing
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Interactive Node Grid Elements
  const [elements, setElements] = useState<CreatureElement[]>([]);

  // Rotate head angle (270 -> 0 -> 90 -> 180 -> 270)
  const handleRotateHead = (id: string) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === id && el.type === 'head') {
          const current = el.headAngle ?? 270;
          const nextAngle = current === 270 ? 0 : current === 0 ? 90 : current === 90 ? 180 : 270;
          return { ...el, headAngle: nextAngle };
        }
        return el;
      })
    );
  };

  // Change random muscle chance (+ / -)
  const handleChangeRandomChance = (id: string, delta: number) => {
    setElements((prev) =>
      prev.map((el) => {
        if (el.id === id && (el.type === 'muscle-random-left' || el.type === 'muscle-random-right')) {
          const current = el.randomChance ?? 35;
          const next = Math.min(95, Math.max(5, current + delta));
          return { ...el, randomChance: next };
        }
        return el;
      })
    );
  };

  // Click directly on an SVG element shape
  const handleElementClick = (el: CreatureElement) => {
    if (selectedTool === 'eraser') {
      handleDeleteElement(el.id);
      setSelectedElementId(null);
      return;
    }
    if (selectedTool === 'head' && el.type === 'head') {
      handleRotateHead(el.id);
      return;
    }
    if (
      (selectedTool === 'muscle-random-left' || selectedTool === 'muscle-random-right') &&
      el.type === selectedTool
    ) {
      handleChangeRandomChance(el.id, 2);
      return;
    }
    // Toggle selection on element click
    setSelectedElementId((prev) => (prev === el.id ? null : el.id));
  };

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const editingCreatureId = editingCreature?.id;

  // Non-passive wheel event listener for zoom in editor
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !isOpen) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setEditorZoom((z) => Math.min(3.0, z + 0.15));
      } else {
        setEditorZoom((z) => Math.max(0.3, z - 0.15));
      }
    };

    svg.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleWheelNative);
    };
  }, [isOpen]);

  // Load creature data & calculate optimal initial camera view
  useEffect(() => {
    if (isOpen) {
      let activeElements: CreatureElement[];
      if (editingCreature && Array.isArray(editingCreature.elements)) {
        setName(editingCreature.name);
        setSelectedColor(editingCreature.color);
        activeElements = JSON.parse(JSON.stringify(editingCreature.elements));
      } else {
        setName('Мой Физический Чудик');
        setSelectedColor('#6366f1');
        activeElements = [];
      }
      setElements(activeElements);

      // Auto-fit grid radius to contain creature elements
      let maxAbs = 3;
      activeElements.forEach((el) => {
        maxAbs = Math.max(maxAbs, Math.abs(el.relX), Math.abs(el.relY));
      });
      setGridRadius(Math.max(4, maxAbs + 1));

      // Reset camera & selection
      setPan({ x: 0, y: 0 });
      setEditorZoom(1);
      setSelectedElementId(null);
      setHoveredElementId(null);
    }
  }, [isOpen, editingCreatureId]);

  // Fit creature into view (Auto-center and zoom)
  const handleFitCreature = () => {
    if (elements.length === 0) {
      setPan({ x: 0, y: 0 });
      setEditorZoom(1);
      return;
    }
    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    elements.forEach((el) => {
      minX = Math.min(minX, el.relX);
      maxX = Math.max(maxX, el.relX);
      minY = Math.min(minY, el.relY);
      maxY = Math.max(maxY, el.relY);
    });
    const centerX = ((minX + maxX) / 2) * 40;
    const centerY = ((minY + maxY) / 2) * 40;
    const spanX = (maxX - minX + 2) * 40;
    const spanY = (maxY - minY + 2) * 40;
    const maxSpan = Math.max(spanX, spanY, 180);
    const targetZoom = Math.min(2.5, Math.max(0.4, 260 / maxSpan));
    setPan({ x: centerX, y: centerY });
    setEditorZoom(targetZoom);
  };

  if (!isOpen) return null;

  // Calculate real-time physics parameters of the drawn creature
  const physics = calculatePhysicsForces(elements, 0);
  const connectivity = getCreatureConnectivity(elements);

  // Toggle, edit or add element on node grid click
  const handleNodeClick = (relX: number, relY: number) => {
    if (selectedTool === 'eraser') {
      // Remove all elements at this location
      setElements((prev) => prev.filter((el) => !(el.relX === relX && el.relY === relY)));
      return;
    }

    // Check if an element of the exact same tool type exists at this node
    const existingSame = elements.find(
      (el) => el.relX === relX && el.relY === relY && el.type === selectedTool
    );

    if (existingSame) {
      if (selectedTool === 'head') {
        // Rotate head angle on click if same tool
        handleRotateHead(existingSame.id);
      } else {
        // Remove element if same tool clicked again
        handleDeleteElement(existingSame.id);
      }
      return;
    }

    // Add new element at this node location (joints, muscles, heads and edges can co-exist at a node)
    const toolDef = ELEMENT_TOOLS.find((t) => t.type === selectedTool);
    const isRandomMuscle = selectedTool === 'muscle-random-left' || selectedTool === 'muscle-random-right';
    const newEl: CreatureElement = {
      id: `el-${Date.now()}-${Math.random()}`,
      relX,
      relY,
      type: selectedTool as ElementType,
      weight: toolDef ? toolDef.weight : 1,
      headAngle: selectedTool === 'head' ? headAngle : undefined,
      randomChance: isRandomMuscle ? randomChance : undefined,
    };
    setElements((prev) => [...prev, newEl]);

    // Expand grid radius if clicked near border
    if (Math.abs(relX) >= gridRadius - 1 || Math.abs(relY) >= gridRadius - 1) {
      if (gridRadius < 7) setGridRadius((r) => Math.min(7, r + 1));
    }
  };

  const handleDeleteElement = (id: string) => {
    setElements((prev) => prev.filter((el) => el.id !== id));
  };

  const handleClear = () => {
    setElements([]);
  };

  const handleSaveAndSpawn = () => {
    if (elements.length === 0 || !connectivity.isConnected) return;
    const saveFn = onSpawnCreature || onSave;
    if (typeof saveFn === 'function') {
      saveFn(name, elements, selectedColor, editingCreature?.id);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/50 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                {editingCreature ? `Редактирование: ${editingCreature.name}` : 'Конструктор Физических Чудиков'}
              </h2>
              <p className="text-xs text-slate-400">
                {editingCreature ? 'Измените форму, мышцы и параметры этого чудика' : 'Задайте Голову (направление вперед), Шарниры (0), Ребра (1) и Мышцы'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Grid */}
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto flex-1 min-h-0">
          {/* Left Panel: Tools & Color */}
          <div className="md:col-span-5 flex flex-col gap-4">
            <div>
              <label className="block text-2xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Имя Чудика:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800/80 border border-slate-700/80 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Выбор инструмента:
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1">
                {ELEMENT_TOOLS.map((tool) => (
                  <button
                    key={tool.type}
                    onClick={() => setSelectedTool(tool.type)}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs text-left transition ${
                      selectedTool === tool.type
                        ? tool.type === 'eraser'
                          ? 'border-red-500 bg-red-950/50 text-red-300 font-semibold'
                          : 'border-indigo-500 bg-indigo-950/50 text-indigo-300 font-semibold shadow-xs'
                        : 'border-slate-800 hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 flex items-center justify-center bg-slate-800 rounded font-mono font-bold text-slate-200 border border-slate-700/50 shrink-0">
                        {tool.symbol}
                      </span>
                      <div>
                        <div>{tool.label}</div>
                        <div className="text-2xs text-slate-500">{tool.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Direction Selector for Head */}
            {selectedTool === 'head' && (
              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-xl">
                <label className="block text-2xs font-bold text-amber-400 uppercase tracking-widest mb-2">
                  Направление взгляда Головы (Перед):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    onClick={() => setHeadAngle(270)}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs transition ${
                      headAngle === 270 ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHeadAngle(0)}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs transition ${
                      headAngle === 0 ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHeadAngle(90)}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs transition ${
                      headAngle === 90 ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setHeadAngle(180)}
                    className={`flex items-center justify-center p-2 rounded-lg border text-xs transition ${
                      headAngle === 180 ? 'bg-amber-500 text-slate-950 font-bold border-amber-400' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Probability Selector for Random Muscle (5% - 90%) */}
            {(selectedTool === 'muscle-random-left' || selectedTool === 'muscle-random-right') && (
              <div className="p-3 bg-orange-950/40 border border-orange-800/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-2xs font-bold text-orange-400 uppercase tracking-widest">
                  <span>Вероятность срабатывания (🎲):</span>
                  <span className="text-sm font-mono font-bold text-orange-200">{randomChance}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={randomChance}
                  onChange={(e) => setRandomChance(Number(e.target.value))}
                  className="w-full accent-orange-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex items-center justify-between gap-1 pt-1">
                  {[
                    { label: '15% Редко', val: 15 },
                    { label: '35% Норма', val: 35 },
                    { label: '60% Часто', val: 60 },
                    { label: '85% Хаос', val: 85 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      onClick={() => setRandomChance(p.val)}
                      className={`text-3xs px-1.5 py-0.5 rounded font-mono border transition ${
                        randomChance === p.val
                          ? 'bg-orange-500 text-slate-950 border-orange-400 font-bold'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-2xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Цвет каркаса:
              </label>
              <div className="flex items-center gap-2">
                {['#6366f1', '#10b981', '#f43f5e', '#a855f7', '#f59e0b', '#38bdf8'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-7 h-7 rounded-full border-2 transition ${
                      selectedColor === c
                        ? 'border-white ring-2 ring-indigo-500 scale-110'
                        : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel: Interactive Blueprint SVG Canvas & Deletion List */}
          <div className="md:col-span-7 flex flex-col items-center justify-between bg-slate-950/60 border border-slate-800 rounded-xl p-4">
            {/* Warning banner if elements are disconnected */}
            {!connectivity.isConnected && (
              <div className="w-full bg-red-950/90 border border-red-500/80 rounded-xl p-3 mb-2 text-xs text-red-200 flex items-center gap-2.5 shadow-lg animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                <div>
                  <div className="font-bold text-red-300">Ошибка конструкции: Оторванные элементы!</div>
                  <div className="text-2xs text-red-200/90 mt-0.5">
                    {connectivity.disconnectedIds.size === 1
                      ? '1 деталь находится в воздухе и не связана с телом.'
                      : `${connectivity.disconnectedIds.size} дет. находятся в воздухе и не связаны с телом.`}
                    {' Все элементы чудика должны касаться друг друга.'}
                  </div>
                </div>
              </div>
            )}

            {/* Real-time Physics Readout Header */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-2 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold flex-wrap gap-2">
                <span className="flex items-center gap-1.5 text-indigo-400">
                  <Scale className="w-4 h-4" />
                  <span>Масса: {physics.totalMass}</span>
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400" title="Зависит от соотношения силы тяги к массе (Thrust / Mass)">
                  <Zap className="w-4 h-4" />
                  <span>
                    Скорость: {physics.forwardSpeed.toFixed(2)} кл/шаг
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-amber-400" title="Зависит от соотношения крутящего момента к массе (Torque / Mass)">
                  <span>🔄 Разворот: {Math.abs(physics.netRotationDeg).toFixed(1)}°/шаг</span>
                </span>
              </div>
              <div className="text-2xs text-slate-400 font-mono flex items-center justify-between border-t border-slate-800/80 pt-1.5 flex-wrap gap-1">
                <span>Плечи: L:{physics.leftMass} / R:{physics.rightMass}</span>
                <span>Сила мышц: L:{physics.leftTorque} / R:{physics.rightTorque}</span>
                <span className="text-slate-500 text-3xs">F = m·a (чем выше масса, тем больше нужна сила)</span>
              </div>
              {physics.jointsPhysics && physics.jointsPhysics.length > 0 && (
                <div className="text-3xs text-sky-400 font-mono border-t border-slate-800/60 pt-1 flex flex-wrap gap-2">
                  {physics.jointsPhysics.map((jp, i) => (
                    <span key={jp.jointId || i} className="bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                      ⚙️ Шарнир({jp.jx},{jp.jy}): масса L:{jp.leftEdgeMass} / R:{jp.rightEdgeMass}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Grid Size & Field Expansion Control Bar */}
            <div className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2 mb-3 flex flex-wrap items-center justify-between gap-2 text-2xs font-mono">
              <div className="flex items-center gap-1.5 text-slate-300">
                <span className="font-bold text-slate-400">Размер поля:</span>
                <span className="px-1.5 py-0.5 bg-indigo-950/80 border border-indigo-500/40 rounded text-indigo-300 font-bold">
                  {gridRadius * 2 + 1}x{gridRadius * 2 + 1}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[
                  { r: 2, label: '5x5' },
                  { r: 3, label: '7x7' },
                  { r: 4, label: '9x9' },
                  { r: 5, label: '11x11' },
                  { r: 6, label: '13x13' },
                  { r: 7, label: '15x15' },
                ].map((item) => (
                  <button
                    key={item.r}
                    onClick={() => setGridRadius(item.r)}
                    className={`px-2 py-0.5 rounded-lg border font-bold transition ${
                      gridRadius === item.r
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-900/40 scale-105'
                        : 'bg-slate-800/90 border-slate-700/80 text-slate-400 hover:text-slate-100 hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  onClick={() => setGridRadius((r) => Math.min(8, r + 1))}
                  className="px-2 py-0.5 rounded-lg border bg-indigo-950/60 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/80 transition font-bold"
                  title="Расширить поле на 1 круг узлов (+)"
                >
                  +
                </button>
              </div>
            </div>

            {/* Interactive Vector Blueprint SVG Canvas with Zoom, Pan, and Expanded Grid Controls */}
            <div className="relative w-full max-w-sm aspect-square border border-indigo-900/40 rounded-xl bg-slate-900/90 p-1 shadow-inner flex items-center justify-center my-auto overflow-hidden group">
              {/* Floating Zoom & Pan Controls for Constructor Canvas */}
              <div className="absolute top-3 right-3 z-20 flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 shadow-lg">
                <button
                  onClick={() => setEditorZoom((z) => Math.min(3.0, z + 0.25))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition text-slate-200"
                  title="Увеличить чертеж (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-2xs font-bold text-indigo-400 select-none">
                  {(editorZoom * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => setEditorZoom((z) => Math.max(0.3, z - 0.25))}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition text-slate-200"
                  title="Уменьшить чертеж (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setPan({ x: 0, y: 0 });
                    setEditorZoom(1);
                  }}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition text-slate-200"
                  title="Сбросить камеру в центр (🎯)"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleFitCreature}
                  className="p-1.5 hover:bg-slate-800 rounded-lg transition text-indigo-400 font-bold"
                  title="Вписать чудика в центр экрана (📐)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Hint banner */}
              <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none text-2xs text-slate-400/80 font-mono text-center bg-slate-950/70 backdrop-blur-xs py-0.5 px-2 rounded-lg border border-slate-800/50">
                💡 Перетаскивайте мышью для перемещения | Колесико — масштаб
              </div>

              {(() => {
                const maxGridPx = (gridRadius + 1) * 40;
                const viewBoxWidth = 300 / editorZoom;
                const viewBoxHeight = 300 / editorZoom;
                const viewBoxMinX = 150 + pan.x - viewBoxWidth / 2;
                const viewBoxMinY = 150 + pan.y - viewBoxHeight / 2;

                return (
                  <svg
                    ref={svgRef}
                    viewBox={`${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}`}
                    onMouseDown={(e) => {
                      setIsDragging(true);
                      setHasMoved(false);
                      setDragStart({ x: e.clientX, y: e.clientY });
                      setPanStart({ x: pan.x, y: pan.y });
                    }}
                    onMouseMove={(e) => {
                      if (!isDragging) return;
                      const dx = e.clientX - dragStart.x;
                      const dy = e.clientY - dragStart.y;
                      if (Math.hypot(dx, dy) > 4) setHasMoved(true);
                      const svgDx = -dx / editorZoom;
                      const svgDy = -dy / editorZoom;
                      setPan({ x: panStart.x + svgDx, y: panStart.y + svgDy });
                    }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    className="w-full h-full select-none cursor-grab active:cursor-grabbing overflow-visible transition-all duration-75"
                  >
                    <defs>
                      <pattern
                        id="blueprint-grid"
                        width="40"
                        height="40"
                        patternUnits="userSpaceOnUse"
                        x="10"
                        y="10"
                      >
                        <path
                          d="M 40 0 L 0 0 0 40"
                          fill="none"
                          stroke="rgba(56, 189, 248, 0.15)"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>

                    {/* Extended Grid Background Pattern */}
                    <rect
                      x={150 - maxGridPx}
                      y={150 - maxGridPx}
                      width={maxGridPx * 2}
                      height={maxGridPx * 2}
                      fill="url(#blueprint-grid)"
                      rx="12"
                    />

                    {/* Center Axes Lines */}
                    <line
                      x1={150}
                      y1={150 - maxGridPx}
                      x2={150}
                      y2={150 + maxGridPx}
                      stroke="rgba(56, 189, 248, 0.35)"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />
                    <line
                      x1={150 - maxGridPx}
                      y1={150}
                      x2={150 + maxGridPx}
                      y2={150}
                      stroke="rgba(56, 189, 248, 0.35)"
                      strokeDasharray="4 4"
                      strokeWidth="1.5"
                    />

                    {/* Render Placed Structural Elements */}
                    {elements.map((el) => {
                      const px = 150 + el.relX * 40;
                      const py = 150 + el.relY * 40;
                      const isHovered = hoveredElementId === el.id;
                      const isSelected = selectedElementId === el.id;
                      const isEraser = selectedTool === 'eraser';
                      const isDisconnected = connectivity.disconnectedIds.has(el.id);

                      const handleElClick = (e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (!hasMoved) {
                          handleElementClick(el);
                        }
                      };

                      const commonProps = {
                        className: "cursor-pointer group/el transition-all duration-150",
                        onClick: handleElClick,
                        onMouseEnter: () => setHoveredElementId(el.id),
                        onMouseLeave: () => setHoveredElementId(null),
                      };

                      const renderDisconnectedRing = () => {
                        if (!isDisconnected) return null;
                        return (
                          <g>
                            <circle
                              cx={px}
                              cy={py}
                              r="20"
                              fill="rgba(239, 68, 68, 0.2)"
                              stroke="#ef4444"
                              strokeWidth="2"
                              strokeDasharray="4 2"
                            />
                            <text x={px + 10} y={py - 10} fontSize="11" fill="#ef4444" fontWeight="bold">⚠️</text>
                          </g>
                        );
                      };

                      if (el.type === 'head') {
                        const angle = el.headAngle ?? 270;
                        const rad = (angle * Math.PI) / 180;
                        const pupilX = px + Math.cos(rad) * 6;
                        const pupilY = py + Math.sin(rad) * 6;
                        const arrowSymbol = angle === 270 ? '⬆️' : angle === 0 ? '➡️' : angle === 90 ? '⬇️' : '⬅️';

                        return (
                          <g key={el.id} {...commonProps}>
                            {/* Glow aura */}
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px}
                                cy={py}
                                r="18"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(250, 204, 21, 0.3)'}
                                stroke={isEraser ? '#ef4444' : '#eab308'}
                                strokeWidth="2"
                                strokeDasharray="3 3"
                              />
                            )}
                            <circle cx={px} cy={py} r="13" fill="#fef08a" stroke="#eab308" strokeWidth="2.5" />
                            {/* Direction pupil */}
                            <circle cx={pupilX} cy={pupilY} r="4.5" fill="#0f172a" />
                            <circle cx={pupilX - 1} cy={pupilY - 1} r="1.5" fill="#ffffff" />
                            <text x={px + 14} y={py + 4} fill="#fef08a" fontSize="10" fontWeight="bold">
                              {arrowSymbol}
                            </text>
                          </g>
                        );
                      }

                      if (el.type === 'edge-h') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <line
                                x1={px - 22}
                                y1={py}
                                x2={px + 22}
                                y2={py}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="10"
                                strokeOpacity="0.4"
                                strokeLinecap="round"
                              />
                            )}
                            <line
                              x1={px - 20}
                              y1={py}
                              x2={px + 20}
                              y2={py}
                              stroke={selectedColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'edge-v') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <line
                                x1={px}
                                y1={py - 22}
                                x2={px}
                                y2={py + 22}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="10"
                                strokeOpacity="0.4"
                                strokeLinecap="round"
                              />
                            )}
                            <line
                              x1={px}
                              y1={py - 20}
                              x2={px}
                              y2={py + 20}
                              stroke={selectedColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'edge-d1') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <line
                                x1={px - 22}
                                y1={py + 22}
                                x2={px + 22}
                                y2={py - 22}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="10"
                                strokeOpacity="0.4"
                                strokeLinecap="round"
                              />
                            )}
                            <line
                              x1={px - 20}
                              y1={py + 20}
                              x2={px + 20}
                              y2={py - 20}
                              stroke={selectedColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'edge-d2') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <line
                                x1={px - 22}
                                y1={py - 22}
                                x2={px + 22}
                                y2={py + 22}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="10"
                                strokeOpacity="0.4"
                                strokeLinecap="round"
                              />
                            )}
                            <line
                              x1={px - 20}
                              y1={py - 20}
                              x2={px + 20}
                              y2={py + 20}
                              stroke={selectedColor}
                              strokeWidth="5"
                              strokeLinecap="round"
                            />
                          </g>
                        );
                      }

                      if (el.type === 'joint') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px}
                                cy={py}
                                r="15"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.3)'}
                                stroke={isEraser ? '#ef4444' : '#38bdf8'}
                                strokeWidth="2"
                              />
                            )}
                            <circle
                              cx={px}
                              cy={py}
                              r="9"
                              fill="#0f172a"
                              stroke="#38bdf8"
                              strokeWidth="2.5"
                            />
                            <circle cx={px} cy={py} r="3" fill="#38bdf8" />
                          </g>
                        );
                      }

                      if (el.type === 'muscle-left') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px - 11}
                                cy={py + 6}
                                r="14"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(244, 63, 94, 0.3)'}
                              />
                            )}
                            <path
                              d={`M ${px} ${py} Q ${px - 16} ${py + 12} ${px - 22} ${py}`}
                              fill="none"
                              stroke="#f43f5e"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                            <text
                              x={px - 28}
                              y={py + 14}
                              fill="#f43f5e"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              ⟲
                            </text>
                          </g>
                        );
                      }

                      if (el.type === 'muscle-right') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px + 11}
                                cy={py + 6}
                                r="14"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(168, 85, 247, 0.3)'}
                              />
                            )}
                            <path
                              d={`M ${px} ${py} Q ${px + 16} ${py + 12} ${px + 22} ${py}`}
                              fill="none"
                              stroke="#a855f7"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                            <text
                              x={px + 20}
                              y={py + 14}
                              fill="#a855f7"
                              fontSize="10"
                              fontWeight="bold"
                            >
                              ⟳
                            </text>
                          </g>
                        );
                      }

                      if (el.type === 'muscle-random-left') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px - 11}
                                cy={py + 6}
                                r="14"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(249, 115, 22, 0.3)'}
                              />
                            )}
                            <path
                              d={`M ${px} ${py} Q ${px - 16} ${py + 12} ${px - 22} ${py}`}
                              fill="none"
                              stroke="#f97316"
                              strokeWidth="4"
                              strokeDasharray="4 2"
                              strokeLinecap="round"
                            />
                            <text
                              x={px - 32}
                              y={py + 14}
                              fill="#f97316"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              🎲{el.randomChance ?? 10}%
                            </text>
                          </g>
                        );
                      }

                      if (el.type === 'muscle-random-right') {
                        return (
                          <g key={el.id} {...commonProps}>
                            {(isHovered || isSelected || isEraser) && (
                              <circle
                                cx={px + 11}
                                cy={py + 6}
                                r="14"
                                fill={isEraser ? 'rgba(239, 68, 68, 0.25)' : 'rgba(217, 70, 239, 0.3)'}
                              />
                            )}
                            <path
                              d={`M ${px} ${py} Q ${px + 16} ${py + 12} ${px + 22} ${py}`}
                              fill="none"
                              stroke="#d946ef"
                              strokeWidth="4"
                              strokeDasharray="4 2"
                              strokeLinecap="round"
                            />
                            <text
                              x={px + 16}
                              y={py + 14}
                              fill="#d946ef"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              🎲{el.randomChance ?? 10}%
                            </text>
                          </g>
                        );
                      }
                      return null;
                    })}

                    {/* Dynamic Grid Intersection Interactive Touch/Click Nodes (-gridRadius .. +gridRadius) */}
                    {Array.from({ length: gridRadius * 2 + 1 }).flatMap((_, row) => {
                      const relY = row - gridRadius;
                      return Array.from({ length: gridRadius * 2 + 1 }).map((__, col) => {
                        const relX = col - gridRadius;
                        const px = 150 + relX * 40;
                        const py = 150 + relY * 40;

                        const hasElementsHere = elements.some(
                          (e) => e.relX === relX && e.relY === relY
                        );

                        return (
                          <g
                            key={`node-${relX}-${relY}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasMoved) handleNodeClick(relX, relY);
                            }}
                            className="cursor-pointer group"
                          >
                            {/* Dot at Grid Node */}
                            <circle
                              cx={px}
                              cy={py}
                              r={hasElementsHere ? '3.5' : '2'}
                              fill={hasElementsHere ? '#38bdf8' : 'rgba(255, 255, 255, 0.35)'}
                              className="transition-transform group-hover:scale-150"
                            />

                            {/* Interactive Click Radius */}
                            <circle
                              cx={px}
                              cy={py}
                              r="16"
                              fill="transparent"
                              className="group-hover:fill-indigo-500/20"
                            />
                          </g>
                        );
                      });
                    })}
                  </svg>
                );
              })()}
            </div>

            {/* List of Placed Elements with Individual Controls & Deletion */}
            <div className="w-full mt-3 bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 max-h-36 overflow-y-auto">
              <div className="text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1 flex items-center justify-between">
                <span>Размещенные элементы ({elements.length}):</span>
                <span className="text-slate-500 font-normal">Нажмите 🗑️ для удаления</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {elements.map((el) => {
                  const toolDef = ELEMENT_TOOLS.find((t) => t.type === el.type);
                  const isHovered = hoveredElementId === el.id;
                  const isSelected = selectedElementId === el.id;
                  const isDisconnected = connectivity.disconnectedIds.has(el.id);

                  return (
                    <div
                      key={el.id}
                      onMouseEnter={() => setHoveredElementId(el.id)}
                      onMouseLeave={() => setHoveredElementId(null)}
                      className={`flex items-center justify-between border rounded-lg px-2 py-1 text-2xs transition ${
                        isDisconnected
                          ? 'bg-red-950/60 border-red-500/80 text-red-200 shadow-xs'
                          : isHovered || isSelected
                          ? 'bg-indigo-950/70 border-indigo-500/80 text-indigo-200 shadow-xs'
                          : 'bg-slate-800/90 border-slate-700/60 text-slate-200'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5 font-mono">
                        <span className="font-bold text-indigo-400">{toolDef?.symbol || '•'}</span>
                        <span className="font-semibold">{toolDef?.label.split(' ')[0]}</span>
                        <span className="text-slate-400">({el.relX},{el.relY})</span>
                        {isDisconnected && (
                          <span className="px-1 py-0.2 bg-red-900/90 border border-red-500/80 text-red-200 rounded text-3xs font-bold" title="Элемент оторван от тела!">
                            ⚠️ Оторван
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {/* Special controls for Head: Rotate button */}
                        {el.type === 'head' && (
                          <button
                            onClick={() => handleRotateHead(el.id)}
                            className="flex items-center gap-0.5 px-1 py-0.5 bg-amber-950/80 border border-amber-500/40 hover:bg-amber-900/90 text-amber-300 rounded font-bold transition"
                            title="Повернуть направление головы на 90°"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>{el.headAngle === 270 ? '⬆️' : el.headAngle === 0 ? '➡️' : el.headAngle === 90 ? '⬇️' : '⬅️'}</span>
                          </button>
                        )}

                        {/* Special controls for Random Muscles: - / + Chance */}
                        {(el.type === 'muscle-random-left' || el.type === 'muscle-random-right') && (
                          <div className="flex items-center gap-1 bg-slate-900 px-1 py-0.5 rounded border border-slate-700 font-mono">
                            <button
                              onClick={() => handleChangeRandomChance(el.id, -2)}
                              className="px-1 hover:bg-slate-700 text-slate-300 rounded"
                              title="Уменьшить шанс (-2%)"
                            >
                              -
                            </button>
                            <span className="text-orange-400 font-bold">{el.randomChance ?? 10}%</span>
                            <button
                              onClick={() => handleChangeRandomChance(el.id, 2)}
                              className="px-1 hover:bg-slate-700 text-slate-300 rounded"
                              title="Увеличить шанс (+2%)"
                            >
                              +
                            </button>
                          </div>
                        )}

                        {/* Trash / Delete button */}
                        <button
                          onClick={() => handleDeleteElement(el.id)}
                          className="text-slate-400 hover:text-red-400 hover:bg-red-950/50 p-1 rounded transition"
                          title="Удалить элемент из чудика"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Clear Button */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1 text-xs text-slate-400 hover:text-red-400 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Очистить всю конструкцию</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between flex-none">
          <span className="text-xs text-slate-400 font-mono">
            Всего элементов: {elements.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition"
            >
              Отмена
            </button>
            {token && onSaveToDB && (
              <button
                onClick={() => {
                  if (elements.length > 0 && connectivity.isConnected) {
                    onSaveToDB(name, elements, selectedColor);
                  }
                }}
                disabled={elements.length === 0 || !connectivity.isConnected}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 rounded-xl transition disabled:opacity-50"
                title="Сохранить в базу данных персональной коллекции"
              >
                <span>💾 Сохранить в БД</span>
              </button>
            )}
            <button
              onClick={handleSaveAndSpawn}
              disabled={elements.length === 0 || !connectivity.isConnected}
              title={!connectivity.isConnected ? 'Все детали чудика должны быть соединены вместе (нельзя оставлять элементы в воздухе)!' : ''}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-900/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingCreature ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingCreature ? 'Сохранить изменения' : 'Создать и выпустить в поле'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
