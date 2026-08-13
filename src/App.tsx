import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import { Creature, CreatureElement, Food, GridTheme, SimulationStats, PendingPlacement, CreatureLogEntry, SavedPreset, User } from './types';
import { createCreature, calculatePhysicsForces, determineCreatureHeadAngle, DEFAULT_PRESETS } from './utils/creatures';
import { soundFx } from './utils/audio';
import { gameWs, LeaderboardEntry, ServerStats, WSChatMessage } from './utils/websocket';
import { GridCanvas } from './components/GridCanvas';
import { Controls } from './components/Controls';
import { StatsPanel } from './components/StatsPanel';
import { CreatureEditor } from './components/CreatureEditor';
import { AnatomyLegendModal } from './components/AnatomyLegendModal';
import { CreaturesLogModal } from './components/CreaturesLogModal';
import { LeaderboardOverlay } from './components/LeaderboardOverlay';
import { MultiplayerChat } from './components/MultiplayerChat';
import { ServerLogsModal } from './components/ServerLogsModal';
import { AuthModal } from './components/AuthModal';
import { UserCreaturesModal } from './components/UserCreaturesModal';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  // Simulation State
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1);
  const [autoFood, setAutoFood] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [gridTheme, setGridTheme] = useState<GridTheme>('notebook');
  const [showNodes, setShowNodes] = useState<boolean>(true);
  const [selectedCreatureId, setSelectedCreatureId] = useState<string | null>(null);
  const [editingCreatureId, setEditingCreatureId] = useState<string | null>(null);
  const [focusTimestamp, setFocusTimestamp] = useState<number>(0);
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);

  // Multiplayer State from Go Server
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [yourCreatureId, setYourCreatureId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [serverStats, setServerStats] = useState<ServerStats | null>(null);
  const [chatMessages, setChatMessages] = useState<WSChatMessage[]>([]);
  const [pingMs, setPingMs] = useState<number>(0);
  const [playerName, setPlayerName] = useState<string>(() => {
    return localStorage.getItem('creatures_player_name') || 'Чудик-Игрок';
  });
  const [playerColor, setPlayerColor] = useState<string>('#6366f1');

  // Placement Mode State
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null);

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isAnatomyOpen, setIsAnatomyOpen] = useState<boolean>(false);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(false);
  const [isServerLogsOpen, setIsServerLogsOpen] = useState<boolean>(false);
  const [serverErrorCount, setServerErrorCount] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User Auth & DB Collection State
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('creatures_auth_token'));
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isUserCreaturesOpen, setIsUserCreaturesOpen] = useState<boolean>(false);
  const [controlledCreatureId, setControlledCreatureId] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    if (authToken) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'ok' && data.user) {
            setAuthUser(data.user);
          } else {
            localStorage.removeItem('creatures_auth_token');
            setAuthToken(null);
            setAuthUser(null);
          }
        })
        .catch(() => {
          // backend temporary offline or network error
        });
    }
  }, [authToken]);

  const handleAuthSuccess = (user: { id: string; username: string }, token: string) => {
    setAuthUser(user);
    setAuthToken(token);
    setToastMessage(`Добро пожаловать, ${user.username}!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('creatures_auth_token');
    setAuthToken(null);
    setAuthUser(null);
    setToastMessage('Вы вышли из аккаунта');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveToDB = async (name: string, elements: CreatureElement[], color: string) => {
    if (!authToken) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const response = await fetch('/api/user/creatures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name, color, elements }),
      });
      const data = await response.json();
      if (!response.ok || data.status !== 'ok') {
        throw new Error(data.message || 'Ошибка сохранения');
      }
      soundFx.playEvolve();
      setToastMessage(`Чудик "${name}" сохранен в вашей базе данных!`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить чудика в БД');
    }
  };

  // Logger & Saved Presets State
  const [logEntries, setLogEntries] = useState<CreatureLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('creatures_log_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'log-1',
        timestamp: new Date().toLocaleString('ru-RU'),
        creatureId: 'c-1',
        name: 'Чудик-Маятник',
        color: '#6366f1',
        action: 'создан',
        initialX: 0,
        initialY: 0,
        initialAngleDeg: 0,
        elementCount: 9,
        leftMass: 3,
        rightMass: 3,
        totalMass: 6,
        randomMusclesInfo: 'Стандартные физические мышцы',
        elements: DEFAULT_PRESETS[0].elements,
      },
    ];
  });

  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(() => {
    try {
      const saved = localStorage.getItem('creatures_saved_presets');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Save log entries to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('creatures_log_history', JSON.stringify(logEntries));
    } catch (e) {
      console.error(e);
    }
  }, [logEntries]);

  // Save custom presets to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('creatures_saved_presets', JSON.stringify(savedPresets));
    } catch (e) {
      console.error(e);
    }
  }, [savedPresets]);

  // Helper to append a record to the log
  const addLogEntry = useCallback((
    creatureId: string,
    name: string,
    color: string,
    action: 'создан' | 'размещен' | 'изменен' | 'сохранен' | 'пресет',
    x: number,
    y: number,
    angleDeg: number,
    elements: CreatureElement[]
  ) => {
    const forces = calculatePhysicsForces(elements, 0);
    const randomMuscles = elements.filter((e) => e.type.startsWith('muscle-random'));
    let randomInfo = '';
    if (randomMuscles.length > 0) {
      const chances = randomMuscles.map((rm) => `${rm.randomChance || 10}%`).join(', ');
      randomInfo = `Случайных мышц: ${randomMuscles.length} (шансы: ${chances})`;
    } else {
      randomInfo = 'Стандартные физические мышцы';
    }

    const newEntry: CreatureLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleString('ru-RU'),
      creatureId,
      name,
      color,
      action,
      initialX: x,
      initialY: y,
      initialAngleDeg: angleDeg,
      elementCount: elements.length,
      leftMass: forces.leftMass,
      rightMass: forces.rightMass,
      totalMass: forces.totalMass,
      randomMusclesInfo: randomInfo,
      elements: JSON.parse(JSON.stringify(elements)),
    };

    setLogEntries((prev) => [newEntry, ...prev]);
  }, []);

  // Stats
  const [worldRadius, setWorldRadius] = useState<number>(50);
  const [stats, setStats] = useState<SimulationStats>({
    foodEatenTotal: 0,
    creaturesCreated: 2,
    currentStep: 0,
  });

  // Main Creatures & Foods state synchronized with Go Backend
  const [creatures, setCreatures] = useState<Creature[]>(() => [
    createCreature('c-1', 'Чудик-Маятник', 0, 0, 0, '#6366f1'),
    createCreature('c-2', 'Асимметричный Вращатель', 5, -3, 1, '#f43f5e'),
  ]);

  const [foods, setFoods] = useState<Food[]>(() => [
    { id: 'f-1', x: 3, y: 3, value: 10, type: 'berry', spawnTime: Date.now() },
    { id: 'f-2', x: -4, y: 2, value: 10, type: 'berry', spawnTime: Date.now() },
    { id: 'f-3', x: 2, y: -5, value: 25, type: 'golden', spawnTime: Date.now() },
  ]);

  // Connect Go Server WebSockets
  useEffect(() => {
    gameWs.connect(playerName, playerColor, DEFAULT_PRESETS[0].elements, 0);

    const unsubscribe = gameWs.subscribe((msg) => {
      if (msg.type === 'init') {
        setYourCreatureId(msg.yourId);
        setSelectedCreatureId(msg.yourId);
        setIsConnected(true);
      } else if (msg.type === 'state') {
        if (msg.worldRadius) {
          setWorldRadius(msg.worldRadius);
        }
        if (msg.creatures) {
          setCreatures((prev) => {
            const prevMap = new Map<string, Creature>(prev.map((c) => [c.id, c]));
            return msg.creatures.map((c: any) => {
              const old = prevMap.get(c.id);
              return {
                ...c,
                moveProgress: 1,
                prevX: old ? old.x : c.x,
                prevY: old ? old.y : c.y,
                prevAngleDeg: old ? old.angleDeg : c.angleDeg,
              };
            });
          });
        }
        if (msg.foods) {
          setFoods(msg.foods);
        }
        if (msg.leaderboard) {
          setLeaderboard(msg.leaderboard);
        }
        if (msg.stats) {
          setServerStats(msg.stats);
          setStats((s) => ({
            ...s,
            currentStep: msg.stats.step,
          }));
        }
      } else if (msg.type === 'chat') {
        setChatMessages((prev) => [...prev.slice(-30), msg]);
      } else if (msg.type === 'kicked') {
        alert(`Вас кикнул администратор! Причина: ${msg.kickedReason || 'Кикнут'}`);
        gameWs.disconnect();
        setIsConnected(false);
      }
    });

    const pingTimer = setInterval(() => {
      setPingMs(gameWs.currentPingMs);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(pingTimer);
      gameWs.disconnect();
    };
  }, [playerName, playerColor]);

  // Handle Steering Keyboard Controls (WASD / Arrows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Escape') {
        if (controlledCreatureId) {
          setControlledCreatureId(null);
        }
        return;
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ф' || e.key === 'Ф') {
        e.preventDefault();
        handleTurnPlayer('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В') {
        e.preventDefault();
        handleTurnPlayer('right');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ц' || e.key === 'Ц') {
        e.preventDefault();
        handleMovePlayerForward();
      } else if (e.key === ' ' || e.key === 'Shift') {
        e.preventDefault();
        // Dash boost
        soundFx.playFlex();
        if (controlledCreatureId) {
          const c = (creatures || []).find((c) => c.id === controlledCreatureId);
          if (c) {
            gameWs.sendAdminControlInput(controlledCreatureId, c.angleDeg, c.x, c.y, true, true);
          }
        } else {
          const yourC = (creatures || []).find((c) => c.id === yourCreatureId);
          if (yourC) {
            gameWs.sendInput(yourC.angleDeg, yourC.x, yourC.y, true, true);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [yourCreatureId, creatures, controlledCreatureId]);

  // Turn Player Creature
  const handleTurnPlayer = (dir: 'left' | 'right') => {
    if (controlledCreatureId) {
      soundFx.playTurn();
      setCreatures((prev) =>
        prev.map((c) => {
          if (c.id === controlledCreatureId) {
            const delta = dir === 'left' ? -45 : 45;
            const nextAngle = (c.angleDeg + delta + 360) % 360;
            gameWs.sendAdminControlInput(controlledCreatureId, nextAngle, c.x, c.y, true, false);
            return {
              ...c,
              targetAngleDeg: nextAngle,
              angleDeg: nextAngle,
              muscleStep: c.muscleStep + 1,
            };
          }
          return c;
        })
      );
      return;
    }

    const targetId = yourCreatureId || selectedCreatureId || creatures[0]?.id;
    if (!targetId) return;

    soundFx.playTurn();
    setCreatures((prev) =>
      prev.map((c) => {
        if (c.id === targetId) {
          const delta = dir === 'left' ? -45 : 45;
          const nextAngle = (c.angleDeg + delta + 360) % 360;
          gameWs.sendInput(nextAngle, c.x, c.y, true, false);
          return {
            ...c,
            targetAngleDeg: nextAngle,
            angleDeg: nextAngle,
            muscleStep: c.muscleStep + 1,
          };
        }
        return c;
      })
    );
  };

  // Move Player Forward
  const handleMovePlayerForward = () => {
    if (controlledCreatureId) {
      soundFx.playFlex();
      setCreatures((prev) =>
        prev.map((c) => {
          if (c.id === controlledCreatureId) {
            const rad = (c.angleDeg * Math.PI) / 180;
            const step = c.forces?.forwardSpeed || 0.25;
            const nx = c.x + Math.cos(rad) * step;
            const ny = c.y + Math.sin(rad) * step;
            gameWs.sendAdminControlInput(controlledCreatureId, c.angleDeg, nx, ny, true, false);
            return {
              ...c,
              x: nx,
              y: ny,
              muscleStep: c.muscleStep + 1,
            };
          }
          return c;
        })
      );
      return;
    }

    const targetId = yourCreatureId || selectedCreatureId || creatures[0]?.id;
    if (!targetId) return;

    soundFx.playFlex();
    setCreatures((prev) =>
      prev.map((c) => {
        if (c.id === targetId) {
          const rad = (c.angleDeg * Math.PI) / 180;
          const step = c.forces?.forwardSpeed || 0.25;
          const nx = c.x + Math.cos(rad) * step;
          const ny = c.y + Math.sin(rad) * step;
          gameWs.sendInput(c.angleDeg, nx, ny, true, false);
          return {
            ...c,
            x: nx,
            y: ny,
            muscleStep: c.muscleStep + 1,
          };
        }
        return c;
      })
    );
  };

  // Toggle Sound
  const handleToggleSound = () => {
    setSoundEnabled((prev) => {
      soundFx.enabled = !prev;
      return !prev;
    });
  };

  // Add Food at specific node
  const addFoodAt = useCallback((x: number, y: number, type: 'berry' | 'super' | 'golden' = 'berry') => {
    soundFx.playSpawnFood();
    gameWs.sendSpawnFood(x, y, type);
  }, []);

  // Add random food
  const handleAddRandomFood = useCallback(() => {
    const rx = Math.floor(Math.random() * 40) - 20;
    const ry = Math.floor(Math.random() * 40) - 20;
    const types: ('berry' | 'super' | 'golden')[] = ['berry', 'berry', 'super', 'golden'];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    addFoodAt(rx, ry, chosenType);
  }, [addFoodAt]);

  // Click on Canvas Grid Node
  const handleNodeClick = (x: number, y: number, isRightClick: boolean) => {
    if (isRightClick) {
      addFoodAt(x, y, 'golden');
    } else {
      addFoodAt(x, y, 'berry');
    }
  };

  // Select Creature & Focus Camera on it
  const handleSelectCreature = (id: string | null) => {
    const validId = typeof id === 'string' ? id : null;
    setSelectedCreatureId(validId);
    if (validId) {
      setFocusTimestamp(Date.now());
    }
  };

  // Open Editor for Creating NEW Creature
  const handleOpenNewEditor = () => {
    setIsRunning(false);
    setEditingCreatureId(null);
    setIsEditorOpen(true);
  };

  // Open Editor for Editing EXISTING Selected Creature
  const handleEditCreature = (id?: string | unknown) => {
    const targetId = typeof id === 'string' ? id : (typeof selectedCreatureId === 'string' ? selectedCreatureId : null);
    if (!targetId) return;
    setIsRunning(false);
    setEditingCreatureId(targetId);
    setSelectedCreatureId(targetId);
    setFocusTimestamp(Date.now());
    setIsEditorOpen(true);
  };

  // Prepare Preset Creature for Interactive Placement
  const handleAddPresetCreature = (presetIndex: number) => {
    soundFx.playEvolve();
    const preset = DEFAULT_PRESETS[presetIndex % DEFAULT_PRESETS.length];
    const initialAngle = determineCreatureHeadAngle(preset.elements);
    setPendingPlacement({
      name: `Чудик #${stats.creaturesCreated + 1}`,
      elements: JSON.parse(JSON.stringify(preset.elements)),
      color: '#6366f1',
      angleDeg: initialAngle,
    });
  };

  // Save Custom Creature from Editor
  const handleSaveCustomCreature = (
    name: string,
    elements: CreatureElement[],
    color: string,
    editingId?: string
  ) => {
    soundFx.playEvolve();
    const initialAngle = determineCreatureHeadAngle(elements);

    setPlayerName(name);
    setPlayerColor(color);
    localStorage.setItem('creatures_player_name', name);

    // Put newly created creature in placement mode so player can place it on the grid!
    setPendingPlacement({
      name,
      elements,
      color,
      angleDeg: initialAngle,
    });

    setIsEditorOpen(false);
    setIsRunning(true);
  };

  // Confirm Placement at Grid Node
  const handlePlaceCreature = (x: number, y: number, angleDeg: number) => {
    if (!pendingPlacement) return;
    soundFx.playEvolve();

    gameWs.send({
      type: 'join',
      name: pendingPlacement.name,
      color: pendingPlacement.color,
      elements: pendingPlacement.elements,
      targetX: x,
      targetY: y,
      targetAngleDeg: angleDeg,
    });

    addLogEntry(
      yourCreatureId || 'new-placed',
      pendingPlacement.name,
      pendingPlacement.color,
      'размещен',
      x,
      y,
      angleDeg,
      pendingPlacement.elements
    );

    setPendingPlacement(null);
  };

  const handleCancelPlacement = () => {
    setPendingPlacement(null);
  };

  const handleChangePlacementAngle = (angleDeg: number) => {
    if (pendingPlacement) {
      setPendingPlacement({
        ...pendingPlacement,
        angleDeg,
      });
    }
  };

  // Save Custom Preset to Presets Drawer
  const handleSaveAsPreset = (preset: SavedPreset) => {
    setSavedPresets((prev) => [preset, ...prev]);
    setToastMessage(`Пресет "${preset.name}" сохранен!`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Send Chat Message
  const handleSendChatMessage = (text: string) => {
    const name = playerName || 'Игрок';
    gameWs.sendChatMessage(name, playerColor, text);
  };

  const selectedCreature = (creatures || []).find((c) => c.id === selectedCreatureId);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950 font-sans text-slate-100 antialiased select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-4 border border-indigo-400/50">
          {toastMessage}
        </div>
      )}

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 w-full h-full">
        <GridCanvas
          creatures={creatures}
          foods={foods}
          selectedCreatureId={selectedCreatureId}
          selectedCreatureName={selectedCreature?.name}
          focusTimestamp={focusTimestamp}
          gridTheme={gridTheme}
          showNodes={showNodes}
          pendingPlacement={pendingPlacement}
          worldRadius={worldRadius}
          onNodeClick={handleNodeClick}
          onSelectCreature={handleSelectCreature}
          onPlaceCreature={handlePlaceCreature}
          onCancelPlacement={handleCancelPlacement}
          onChangePlacementAngle={handleChangePlacementAngle}
          onTurnPlayer={handleTurnPlayer}
          onMovePlayerForward={handleMovePlayerForward}
        />

        {/* Slither.io Style Leaderboard Overlay */}
        <LeaderboardOverlay
          leaderboard={leaderboard}
          stats={serverStats}
          yourCreatureId={yourCreatureId}
          pingMs={pingMs}
        />

        {/* Multiplayer Live Chat */}
        <MultiplayerChat
          chatMessages={chatMessages}
          onSendMessage={handleSendChatMessage}
          playerName={playerName}
        />

        {/* Controls Overlay Header */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 max-w-4xl w-[92%] transition-all duration-300">
          {isHeaderVisible ? (
            <div className="relative">
              <Controls
                isRunning={isRunning}
                speed={speed}
                autoFood={autoFood}
                soundEnabled={soundEnabled}
                gridTheme={gridTheme}
                showNodes={showNodes}
                selectedCreatureId={selectedCreatureId}
                selectedCreatureName={selectedCreature?.name}
                username={authUser?.username}
                token={authToken}
                onOpenAuth={() => setIsAuthOpen(true)}
                onOpenUserCreatures={() => setIsUserCreaturesOpen(true)}
                onLogout={handleLogout}
                onToggleRunning={() => setIsRunning((r) => !r)}
                onStep={() => {
                  soundFx.playFlex();
                }}
                onChangeSpeed={setSpeed}
                onToggleAutoFood={() => setAutoFood((a) => !a)}
                onToggleSound={handleToggleSound}
                onChangeTheme={setGridTheme}
                onToggleNodes={() => setShowNodes((n) => !n)}
                onAddFoodRandom={handleAddRandomFood}
                onOpenEditor={handleOpenNewEditor}
                onEditSelectedCreature={handleEditCreature}
                onOpenAnatomy={() => setIsAnatomyOpen(true)}
                onOpenLogs={() => setIsLogsOpen(true)}
                onOpenServerLogs={() => setIsServerLogsOpen(true)}
                serverErrorCount={serverErrorCount}
                onReset={() => {
                  soundFx.playEvolve();
                  setFoods([]);
                  setSelectedCreatureId(null);
                  setToastMessage('Поле очищено!');
                  setTimeout(() => setToastMessage(null), 2500);
                }}
              />
              <button
                onClick={() => setIsHeaderVisible(false)}
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 text-slate-400 hover:text-slate-200 p-0.5 rounded-full shadow-lg transition cursor-pointer"
                title="Свернуть верхнее меню"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsHeaderVisible(true)}
              className="mx-auto flex items-center gap-2 px-3 py-1 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-full text-2xs text-slate-300 shadow-xl backdrop-blur-md transition cursor-pointer"
            >
              <span>Развернуть настройки</span>
              <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          )}
        </div>

        {/* Statistics & Creatures Panel (Top Left) */}
        <StatsPanel
          creatures={creatures}
          foodCount={foods.length}
          stats={stats}
          selectedCreatureId={selectedCreatureId}
          savedPresets={savedPresets}
          onSelectCreature={handleSelectCreature}
          onAddPresetCreature={handleAddPresetCreature}
          onRemoveCreature={(id) => {
            setCreatures((prev) => prev.filter((c) => c.id !== id));
            if (selectedCreatureId === id) setSelectedCreatureId(null);
          }}
          onEditCreature={handleEditCreature}
          onSaveCreature={(id) => {
            const creature = creatures.find((c) => c.id === id);
            if (!creature) return;
            const newPreset: SavedPreset = {
              id: `preset-${Date.now()}`,
              name: creature.name,
              description: `Сохраненный чудик из ${creature.elements.length} элементов`,
              color: creature.color,
              createdAt: new Date().toLocaleDateString('ru-RU'),
              elements: JSON.parse(JSON.stringify(creature.elements)),
            };
            handleSaveAsPreset(newPreset);
          }}
          onOpenLogs={() => setIsLogsOpen(true)}
          onAddSavedPreset={(sp) => {
            soundFx.playEvolve();
            const initialAngle = determineCreatureHeadAngle(sp.elements);
            setPendingPlacement({
              name: sp.name,
              elements: JSON.parse(JSON.stringify(sp.elements)),
              color: sp.color,
              angleDeg: initialAngle,
            });
          }}
          onRemoveSavedPreset={(id) => {
            setSavedPresets((prev) => prev.filter((p) => p.id !== id));
          }}
        />

        {/* Admin Control Panel */}
        <AdminPanel
          user={authUser}
          creatures={creatures}
          stats={serverStats || undefined}
          controlledCreatureId={controlledCreatureId}
          setControlledCreatureId={setControlledCreatureId}
        />
      </div>

      {/* Creature Editor Modal */}
      {isEditorOpen && (
        <CreatureEditor
          isOpen={isEditorOpen}
          editingCreature={(creatures || []).find((c) => c.id === editingCreatureId) || null}
          token={authToken}
          onClose={() => {
            setIsEditorOpen(false);
            setIsRunning(true);
          }}
          onSpawnCreature={handleSaveCustomCreature}
          onSave={handleSaveCustomCreature}
          onSaveToDB={handleSaveToDB}
        />
      )}

      {/* Anatomy Legend Modal */}
      {isAnatomyOpen && (
        <AnatomyLegendModal
          isOpen={isAnatomyOpen}
          onClose={() => setIsAnatomyOpen(false)}
        />
      )}

      {/* History Log Modal */}
      {isLogsOpen && (
        <CreaturesLogModal
          isOpen={isLogsOpen}
          onClose={() => setIsLogsOpen(false)}
          logEntries={logEntries}
          savedPresets={savedPresets}
          onClearLogs={() => setLogEntries([])}
          onLoadFromLog={(entry) => {
            setIsLogsOpen(false);
            soundFx.playEvolve();
            const angle = determineCreatureHeadAngle(entry.elements);
            setPendingPlacement({
              name: entry.name,
              elements: JSON.parse(JSON.stringify(entry.elements)),
              color: entry.color,
              angleDeg: angle,
            });
          }}
        />
      )}

      {/* Server Logs & Diagnostics Modal */}
      <ServerLogsModal
        isOpen={isServerLogsOpen}
        onClose={() => setIsServerLogsOpen(false)}
        onErrorCountUpdate={setServerErrorCount}
      />

      {/* Auth Modal (Login / Register) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* User Creatures Collection Modal (Database) */}
      <UserCreaturesModal
        isOpen={isUserCreaturesOpen}
        token={authToken}
        onClose={() => setIsUserCreaturesOpen(false)}
        onLoadCreature={(creature) => {
          setIsUserCreaturesOpen(false);
          soundFx.playEvolve();
          const angle = determineCreatureHeadAngle(creature.elements);
          setPendingPlacement({
            name: creature.name,
            elements: JSON.parse(JSON.stringify(creature.elements)),
            color: creature.color,
            angleDeg: angle,
          });
          setToastMessage(`Выбран чудик "${creature.name}" из базы данных! Кликните на поле для спавна.`);
          setTimeout(() => setToastMessage(null), 3500);
        }}
      />
    </div>
  );
}
