import React, { useState, useEffect } from 'react';
import { Shield, Zap, Trash2, Gamepad2, UserX, PlusCircle, X, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { gameWs, ServerStats } from '../utils/websocket';
import { Creature, User } from '../types';
import { DEFAULT_PRESETS } from '../utils/creatures';

interface AdminPanelProps {
  user: User | null;
  creatures: Creature[];
  stats?: ServerStats;
  onSelectTargetCreature?: (id: string | null) => void;
  controlledCreatureId: string | null;
  setControlledCreatureId: (id: string | null) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  user,
  creatures,
  stats,
  controlledCreatureId,
  setControlledCreatureId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string>('');
  const [currentSpeedMs, setCurrentSpeedMs] = useState<number>(stats?.tickIntervalMs || 50);
  const [spawnName, setSpawnName] = useState<string>('Админ-Чудик');
  const [spawnColor, setSpawnColor] = useState<string>('#ef4444');
  const [spawnPresetIdx, setSpawnPresetIdx] = useState<number>(0);
  const [showSpawnModal, setShowSpawnModal] = useState<boolean>(false);

  useEffect(() => {
    if (stats?.tickIntervalMs) {
      setCurrentSpeedMs(stats.tickIntervalMs);
    }
  }, [stats?.tickIntervalMs]);

  if (!user?.isAdmin) return null;

  const controlledCreature = creatures.find((c) => c.id === controlledCreatureId);

  const handleSetSpeed = (ms: number) => {
    setCurrentSpeedMs(ms);
    gameWs.sendAdminSetSpeed(ms);
  };

  const handleDeleteCreature = (id: string) => {
    if (!id) return;
    if (controlledCreatureId === id) {
      setControlledCreatureId(null);
    }
    gameWs.sendAdminDeleteCreature(id);
  };

  const handleControlCreature = (id: string) => {
    if (controlledCreatureId === id) {
      setControlledCreatureId(null);
    } else {
      setControlledCreatureId(id);
    }
  };

  const handleKickPlayer = (playerId: string, name: string) => {
    if (confirm(`Вы уверены, что хотите кикнуть игрока "${name}"?`)) {
      gameWs.sendAdminKickUser(playerId, 'Кикнут администратором joni');
    }
  };

  const handleSpawnCreature = () => {
    const preset = DEFAULT_PRESETS[spawnPresetIdx] || DEFAULT_PRESETS[0];
    // Spawn near center (0, 0) + random offset
    const rx = (Math.random() - 0.5) * 10;
    const ry = (Math.random() - 0.5) * 10;
    gameWs.sendAdminSpawnCreature(spawnName, spawnColor, preset.elements, rx, ry);
    setShowSpawnModal(false);
  };

  return (
    <>
      {/* Top Admin Active Override Banner */}
      {controlledCreatureId && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[90] bg-gradient-to-r from-red-900/90 to-amber-900/90 border-2 border-amber-400 text-amber-100 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-4 animate-pulse">
          <Gamepad2 className="w-6 h-6 text-amber-300 animate-spin-slow" />
          <div>
            <div className="font-bold text-sm tracking-wide text-amber-200">
              РЕЖИМ ПЕРЕХВАТА УПРАВЛЕНИЯ [АДМИН]
            </div>
            <div className="text-xs text-amber-300/90">
              Чудик: <span className="font-semibold text-white">{controlledCreature?.name || controlledCreatureId}</span> (Управление игрока заблокировано)
            </div>
          </div>
          <button
            onClick={() => setControlledCreatureId(null)}
            className="ml-2 px-3 py-1 bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400/50 text-white rounded-lg text-xs transition font-semibold"
          >
            Отпустить (ESC)
          </button>
        </div>
      )}

      {/* Floating Toggle Button for Admin Panel */}
      <div className="fixed top-4 right-4 z-[80]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/40 border border-amber-300/40 transition transform active:scale-95 text-xs"
        >
          <Shield className="w-4 h-4 text-amber-200" />
          <span>АДМИН ПАНЕЛЬ ({user.username})</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Collapsible Admin Drawer */}
        {isOpen && (
          <div className="mt-2 w-80 bg-slate-900/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-xl text-white text-xs space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <Shield className="w-4 h-4" />
                <span>Панель Администратора</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Server Speed Control */}
            <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                  Скорость расчета (Tick Delay)
                </span>
                <span className="font-mono text-amber-300 font-bold">
                  {currentSpeedMs} ms ({Math.round(1000 / currentSpeedMs)} Hz)
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="5"
                value={currentSpeedMs}
                onChange={(e) => handleSetSpeed(Number(e.target.value))}
                className="w-full accent-amber-500 bg-slate-700 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="grid grid-cols-4 gap-1 pt-1">
                <button
                  onClick={() => handleSetSpeed(15)}
                  className={`py-1 rounded border text-[10px] font-semibold ${
                    currentSpeedMs === 15
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  ⚡Быстро (15ms)
                </button>
                <button
                  onClick={() => handleSetSpeed(33)}
                  className={`py-1 rounded border text-[10px] font-semibold ${
                    currentSpeedMs === 33
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  33ms (30Hz)
                </button>
                <button
                  onClick={() => handleSetSpeed(60)}
                  className={`py-1 rounded border text-[10px] font-semibold ${
                    currentSpeedMs === 60
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  60ms (Медленно)
                </button>
                <button
                  onClick={() => handleSetSpeed(120)}
                  className={`py-1 rounded border text-[10px] font-semibold ${
                    currentSpeedMs === 120
                      ? 'bg-amber-600 text-white border-amber-400'
                      : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
                  }`}
                >
                  120ms (Шаг)
                </button>
              </div>
            </div>

            {/* 2. Control / Delete Creature */}
            <div className="space-y-2.5 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
                Чудики на карте ({creatures.length})
              </div>

              <select
                value={selectedCreatureId}
                onChange={(e) => setSelectedCreatureId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
              >
                <option value="">-- Выберите чудика --</option>
                {creatures.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.isBot ? '(Бот)' : '(Игрок)'} - [{c.id}]
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  disabled={!selectedCreatureId}
                  onClick={() => handleControlCreature(selectedCreatureId)}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1 transition ${
                    controlledCreatureId === selectedCreatureId
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5" />
                  {controlledCreatureId === selectedCreatureId ? 'Отпустить' : 'Перехват'}
                </button>

                <button
                  disabled={!selectedCreatureId}
                  onClick={() => handleDeleteCreature(selectedCreatureId)}
                  className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center justify-center gap-1 transition disabled:opacity-40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Удалить
                </button>
              </div>

              <button
                onClick={() => setShowSpawnModal(true)}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
              >
                <PlusCircle className="w-4 h-4" />
                Добавить Чудика
              </button>
            </div>

            {/* 3. Player List & Kick */}
            <div className="space-y-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5 text-red-400" />
                Игроки на сервере
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {creatures.filter((c) => !c.isBot).length === 0 ? (
                  <div className="text-slate-400 italic text-[11px]">Игроков в данный момент нет</div>
                ) : (
                  creatures
                    .filter((c) => !c.isBot)
                    .map((c) => {
                      const playerId = c.id.startsWith('player-') ? c.id.replace('player-', '') : c.id;
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-700/60"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: c.color }}
                            />
                            <span className="font-semibold text-slate-200 truncate">{c.name}</span>
                          </div>
                          <button
                            onClick={() => handleKickPlayer(playerId, c.name)}
                            className="px-2 py-0.5 bg-red-600/80 hover:bg-red-600 text-white font-semibold rounded text-[10px] flex items-center gap-1 transition"
                          >
                            <UserX className="w-3 h-3" />
                            Кик
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Spawn Creature Modal */}
      {showSpawnModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 text-white p-5 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <h3 className="font-bold text-amber-400 flex items-center gap-2">
                <PlusCircle className="w-5 h-5" />
                Создание чудика (Админ)
              </h3>
              <button
                onClick={() => setShowSpawnModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Имя чудика</label>
                <input
                  type="text"
                  value={spawnName}
                  onChange={(e) => setSpawnName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Цвет</label>
                <input
                  type="color"
                  value={spawnColor}
                  onChange={(e) => setSpawnColor(e.target.value)}
                  className="w-full h-8 bg-slate-800 border border-slate-700 rounded-lg p-1 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Шаблон анатомии</label>
                <select
                  value={spawnPresetIdx}
                  onChange={(e) => setSpawnPresetIdx(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {DEFAULT_PRESETS.map((p, idx) => (
                    <option key={idx} value={idx}>
                      {p.name} ({p.elements.length} эл.)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowSpawnModal(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold text-xs"
              >
                Отмена
              </button>
              <button
                onClick={handleSpawnCreature}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs"
              >
                Заспавнить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
