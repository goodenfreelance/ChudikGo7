import React, { useState, useEffect, useRef } from 'react';
import { Creature, SimulationStats, SavedPreset } from '../types';
import { DEFAULT_PRESETS } from '../utils/creatures';
import { ChevronRight, ChevronLeft, Plus, Activity, Utensils, Footprints, Trash2, Crosshair, Edit3, Save, FileText, Bookmark, Check, X } from 'lucide-react';

interface StatsPanelProps {
  creatures: Creature[];
  foodCount: number;
  stats: SimulationStats;
  selectedCreatureId: string | null;
  savedPresets?: SavedPreset[];
  onSelectCreature: (id: string | null) => void;
  onAddPresetCreature: (presetIndex: number) => void;
  onRemoveCreature: (id: string) => void;
  onEditCreature?: (id: string) => void;
  onSaveCreature?: (id: string) => void;
  onOpenLogs?: () => void;
  onAddSavedPreset?: (preset: SavedPreset) => void;
  onRemoveSavedPreset?: (id: string) => void;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({
  creatures = [],
  foodCount = 0,
  stats,
  selectedCreatureId,
  savedPresets = [],
  onSelectCreature,
  onAddPresetCreature,
  onRemoveCreature,
  onEditCreature,
  onSaveCreature,
  onOpenLogs,
  onAddSavedPreset,
  onRemoveSavedPreset,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [presetToDeleteId, setPresetToDeleteId] = useState<string | null>(null);
  const selectedItemRef = useRef<HTMLDivElement | null>(null);

  const selectedCreature = (creatures || []).find((c) => c.id === selectedCreatureId);

  // Automatically expand panel and scroll to selected creature when selectedCreatureId changes
  useEffect(() => {
    if (selectedCreatureId) {
      setIsCollapsed(false);
      const timer = setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedCreatureId]);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="absolute top-20 left-4 z-20 flex items-center gap-2 px-3 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl text-slate-200 hover:bg-slate-800 transition text-xs font-bold cursor-pointer"
        title="Показать статистику и список чудиков"
      >
        <Activity className="w-4 h-4 text-indigo-400" />
        <span className="hidden sm:inline">Статистика</span>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </button>
    );
  }

  return (
    <div className="absolute top-20 left-4 z-20 w-72 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl shadow-slate-950/60 overflow-hidden flex flex-col max-h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase">
            Статистика
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onOpenLogs && (
            <button
              onClick={onOpenLogs}
              className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition text-2xs flex items-center gap-1 font-semibold"
              title="Открыть файл логов созданных чудиков"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Логи</span>
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
            title="Свернуть статистику"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-3 overflow-y-auto space-y-4">
        {/* Global metrics grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-center">
            <span className="text-2xs text-slate-500 uppercase tracking-widest block mb-0.5">Шагов</span>
            <span className="text-sm font-bold text-indigo-400 font-mono">
              {stats.currentStep}
            </span>
          </div>

          <div className="p-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-center">
            <span className="text-2xs text-slate-500 uppercase tracking-widest block mb-0.5">Еда</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              {foodCount}
            </span>
          </div>

          <div className="p-2 bg-slate-800/40 border border-slate-700/50 rounded-xl text-center">
            <span className="text-2xs text-slate-500 uppercase tracking-widest block mb-0.5">Съедено</span>
            <span className="text-sm font-bold text-amber-400 font-mono">
              {stats.foodEatenTotal}
            </span>
          </div>
        </div>

        {/* Action: Save Selected Creature */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-2">
          <button
            onClick={() => selectedCreatureId && onSaveCreature?.(selectedCreatureId)}
            disabled={!selectedCreatureId}
            className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition ${
              selectedCreatureId
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/50 cursor-pointer ring-1 ring-emerald-400/50'
                : 'bg-slate-800/40 border border-slate-700/30 text-slate-500 cursor-not-allowed opacity-50'
            }`}
            title={
              selectedCreatureId
                ? `Сохранить чудика "${selectedCreature?.name}" в файл JSON и каталог пресетов`
                : 'Выберите чудика из списка ниже, чтобы сделать эту кнопку активной'
            }
          >
            <Save className="w-4 h-4" />
            <span>
              {selectedCreature
                ? `Сохранить «${selectedCreature.name.length > 11 ? selectedCreature.name.slice(0, 11) + '...' : selectedCreature.name}»`
                : 'Сохранить чудика (выберите из списка)'}
            </span>
          </button>
          {!selectedCreatureId && (
            <p className="text-3xs text-slate-500 text-center">
              💡 Кликните по чудику на поле или в списке, чтобы выбрать его и сфокусировать камеру.
            </p>
          )}
        </div>

        {/* Live Creatures List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs font-bold text-slate-400 uppercase tracking-widest">
              Чудики на поле ({creatures.length})
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {creatures.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-800">
                Нет чудиков на поле. Добавьте пресет ниже!
              </div>
            ) : (
              creatures.map((c) => {
                const isSelected = c.id === selectedCreatureId;
                return (
                  <div
                    key={c.id}
                    ref={isSelected ? selectedItemRef : null}
                    onClick={() => onSelectCreature(c.id)}
                    className={`p-2.5 rounded-xl border text-xs transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/40 shadow-md ring-1 ring-indigo-500/50'
                        : 'border-slate-800 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="font-bold text-slate-200 line-clamp-1">
                          {c.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCreature(c.id);
                          }}
                          className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-slate-800 transition"
                          title="Центрировать камеру на этом чудике"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                        {onEditCreature && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCreature(c.id);
                              onEditCreature(c.id);
                            }}
                            className="text-amber-400 hover:text-amber-300 p-1 rounded hover:bg-slate-800 transition"
                            title="Редактировать параметры и схему чудика"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCreature(c.id);
                          }}
                          className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition"
                          title="Удалить чудика с поля"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-2xs text-slate-400">
                      <div className="flex items-center gap-1">
                        <Utensils className="w-3 h-3 text-emerald-400" />
                        <span>{c.foodEaten} еды</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Footprints className="w-3 h-3 text-indigo-400" />
                        <span>{c.stepsCount} шагов</span>
                      </div>
                      <div className="font-mono font-semibold text-slate-300">
                        Узел ({c.x.toFixed(1)}, {c.y.toFixed(1)})
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Saved Custom Presets Section (if any) */}
        {savedPresets && savedPresets.length > 0 && (
          <div>
            <span className="text-2xs font-bold text-emerald-400 uppercase tracking-widest block mb-2 flex items-center gap-1">
              <Bookmark className="w-3 h-3" /> Мои сохраненные ({savedPresets.length})
            </span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {savedPresets.map((sp) => (
                <div
                  key={sp.id}
                  className="flex items-center justify-between p-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 hover:bg-emerald-900/30 text-left transition group gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: sp.color }}
                    />
                    <div className="truncate">
                      <div className="text-xs font-semibold text-slate-200 truncate">
                        {sp.name}
                      </div>
                      <div className="text-3xs text-slate-400 font-mono">
                        {sp.elements.length} эл. • {sp.createdAt}
                      </div>
                    </div>
                  </div>

                  {presetToDeleteId === sp.id ? (
                    <div className="flex items-center gap-1 bg-red-950/80 p-1 rounded-lg border border-red-800/80 shrink-0">
                      <span className="text-3xs font-semibold text-red-200 px-1">Удалить?</span>
                      <button
                        onClick={() => {
                          onRemoveSavedPreset?.(sp.id);
                          setPresetToDeleteId(null);
                        }}
                        className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-3xs font-bold rounded transition shadow"
                        title="Да, удалить"
                      >
                        Да
                      </button>
                      <button
                        onClick={() => setPresetToDeleteId(null)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-3xs font-bold rounded transition"
                        title="Отмена"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      {onAddSavedPreset && (
                        <button
                          onClick={() => onAddSavedPreset(sp)}
                          className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition"
                          title="Разместить на поле"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                      {onRemoveSavedPreset && (
                        <button
                          onClick={() => setPresetToDeleteId(sp.id)}
                          className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition"
                          title="Удалить из сохраненных"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add Preset Creatures */}
        <div>
          <span className="text-2xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
            Добавить шаблон из рисунка
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {DEFAULT_PRESETS.map((preset, idx) => (
              <button
                key={preset.name}
                onClick={() => onAddPresetCreature(idx)}
                className="flex items-center justify-between p-2 rounded-xl border border-slate-800 hover:bg-slate-800/80 hover:border-indigo-500/50 text-left transition group"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-400">
                    {preset.name}
                  </div>
                  <div className="text-2xs text-slate-500 line-clamp-1">
                    {preset.description}
                  </div>
                </div>
                <Plus className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

