import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Creature, Food, GridTheme, Point, PendingPlacement } from '../types';
import { determineCreatureHeadAngle, isRandomMuscleTriggered, getRandomMuscleState, calculateKinematicBends, getCreatureElementWorldPositions } from '../utils/creatures';
import { ZoomIn, ZoomOut, Maximize2, RotateCw, RotateCcw, X, Crosshair, Compass, Gamepad2, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';

interface GridCanvasProps {
  creatures: Creature[];
  foods: Food[];
  selectedCreatureId: string | null;
  selectedCreatureName?: string | null;
  focusTimestamp?: number;
  gridTheme: GridTheme;
  showNodes: boolean;
  pendingPlacement: PendingPlacement | null;
  worldRadius?: number;
  onNodeClick: (x: number, y: number, isRightClick: boolean) => void;
  onSelectCreature: (id: string | null) => void;
  onPlaceCreature: (x: number, y: number, angleDeg: number) => void;
  onCancelPlacement: () => void;
  onChangePlacementAngle: (angleDeg: number) => void;
  onTurnPlayer?: (dir: 'left' | 'right') => void;
  onMovePlayerForward?: () => void;
}

const GridCanvasComponent: React.FC<GridCanvasProps> = ({
  creatures = [],
  foods = [],
  selectedCreatureId,
  selectedCreatureName,
  focusTimestamp,
  gridTheme,
  showNodes,
  pendingPlacement,
  worldRadius = 50,
  onNodeClick,
  onSelectCreature,
  onPlaceCreature,
  onCancelPlacement,
  onChangePlacementAngle,
  onTurnPlayer,
  onMovePlayerForward,
}) => {
  const halfWorld = worldRadius;
  const worldSize = worldRadius * 2;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan, zoom and placement state
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [hoverGridPos, setHoverGridPos] = useState<Point | null>(null);
  const [isPlayerHudCollapsed, setIsPlayerHudCollapsed] = useState<boolean>(false);
  const [isHintHidden, setIsHintHidden] = useState<boolean>(false);

  const [isCameraLocked, setIsCameraLocked] = useState<boolean>(true);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const lastOffsetRef = useRef<Point>({ x: 0, y: 0 });

  const CELL_SIZE = 40; // Base distance between grid nodes in pixels

  const activeOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const animStatesRef = useRef<Map<string, { displayX: number; displayY: number; displayAngle: number; muscleAnimStep: number }>>(new Map());
  const cameraOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const lastRenderTimeRef = useRef<number>(performance.now());

  // Center canvas on load
  useEffect(() => {
    if (canvasRef.current) {
      const { width, height } = canvasRef.current.getBoundingClientRect();
      setOffset({ x: width / 2, y: height / 2 });
    }
  }, []);

  const creaturesRef = useRef(creatures);
  useEffect(() => { creaturesRef.current = creatures; }, [creatures]);

  const foodsRef = useRef(foods);
  useEffect(() => { foodsRef.current = foods; }, [foods]);

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const offsetRef = useRef(offset);
  useEffect(() => { offsetRef.current = offset; }, [offset]);

  const gridThemeRef = useRef(gridTheme);
  useEffect(() => { gridThemeRef.current = gridTheme; }, [gridTheme]);

  const showNodesRef = useRef(showNodes);
  useEffect(() => { showNodesRef.current = showNodes; }, [showNodes]);

  const selectedCreatureIdRef = useRef(selectedCreatureId);
  useEffect(() => { selectedCreatureIdRef.current = selectedCreatureId; }, [selectedCreatureId]);

  const pendingPlacementRef = useRef(pendingPlacement);
  useEffect(() => { pendingPlacementRef.current = pendingPlacement; }, [pendingPlacement]);

  const isCameraLockedRef = useRef(isCameraLocked);
  useEffect(() => { isCameraLockedRef.current = isCameraLocked; }, [isCameraLocked]);

  const hoverGridPosRef = useRef<Point | null>(null);

  // Center view on selected creature whenever selection or focusTimestamp changes
  useEffect(() => {
    if (selectedCreatureId && canvasRef.current) {
      setIsCameraLocked(true);
      const target = (creaturesRef.current || []).find((c) => c.id === selectedCreatureId);
      if (target) {
        const animState = animStatesRef.current.get(selectedCreatureId);
        const tx = animState ? animState.displayX : target.x;
        const ty = animState ? animState.displayY : target.y;
        const width = canvasRef.current.width || canvasRef.current.clientWidth;
        const height = canvasRef.current.height || canvasRef.current.clientHeight;
        const newOffset = {
          x: width / 2 - tx * CELL_SIZE * zoom,
          y: height / 2 - ty * CELL_SIZE * zoom,
        };
        setOffset(newOffset);
        cameraOffsetRef.current = newOffset;
      }
    }
  }, [selectedCreatureId, focusTimestamp, zoom]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        if (parent) {
          canvasRef.current.width = parent.clientWidth;
          canvasRef.current.height = parent.clientHeight;
        }
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Keyboard shortcut 'R' for rotating placement orientation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!pendingPlacement) return;
      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        e.preventDefault();
        const nextAngle = (pendingPlacement.angleDeg + 45) % 360;
        onChangePlacementAngle(nextAngle);
      } else if (e.key === 'Escape') {
        onCancelPlacement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingPlacement, onChangePlacementAngle, onCancelPlacement]);

  // Mouse to Grid coordinate conversion
  const screenToGrid = useCallback(
    (screenX: number, screenY: number): Point => {
      const curOffset = activeOffsetRef.current;
      const worldX = (screenX - curOffset.x) / zoom;
      const worldY = (screenY - curOffset.y) / zoom;
      return {
        x: Math.round(worldX / CELL_SIZE),
        y: Math.round(worldY / CELL_SIZE),
      };
    },
    [zoom]
  );

  // Grid to Screen coordinate conversion
  const gridToScreen = useCallback(
    (gridX: number, gridY: number): Point => {
      const curOffset = activeOffsetRef.current;
      return {
        x: curOffset.x + gridX * CELL_SIZE * zoom,
        y: curOffset.y + gridY * CELL_SIZE * zoom,
      };
    },
    [zoom]
  );

  // Mouse & Drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Right button (2), Middle button (1), or Shift+Left -> Drag/Pan view
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      isDraggingRef.current = true;
      setIsCameraLocked(false);
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      lastOffsetRef.current = { ...activeOffsetRef.current };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const gridPos = screenToGrid(mouseX, mouseY);
      hoverGridPosRef.current = gridPos;
      if (pendingPlacementRef.current) {
        setHoverGridPos(gridPos);
      }
    }

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOffset({
        x: lastOffsetRef.current.x + dx,
        y: lastOffsetRef.current.y + dy,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const distMoved = Math.hypot(
        e.clientX - dragStartRef.current.x,
        e.clientY - dragStartRef.current.y
      );
      isDraggingRef.current = false;
      if (distMoved > 3) {
        return;
      }
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const gridPos = screenToGrid(mouseX, mouseY);

    if (e.button === 0) {
      // If Placement Mode is active, place creature at this position
      if (pendingPlacement) {
        onPlaceCreature(gridPos.x, gridPos.y, pendingPlacement.angleDeg);
        return;
      }

      let bestMatch: { creatureId: string; distance: number } | null = null;

      for (const creature of creatures) {
        // Distance to creature center
        const centerDistGrid = Math.hypot(creature.x - gridPos.x, creature.y - gridPos.y);
        const centerDistScreen = Math.hypot(
          gridToScreen(creature.x, creature.y).x - mouseX,
          gridToScreen(creature.x, creature.y).y - mouseY
        );

        let minGridDist = centerDistGrid;

        // Also check distance to any element of the creature
        const elementPts = getCreatureElementWorldPositions(
          creature.x,
          creature.y,
          creature.angleDeg,
          creature.elements,
          creature.muscleStep,
          creature.forces
        );

        for (const pt of elementPts) {
          const ptDist = Math.hypot(pt.x - gridPos.x, pt.y - gridPos.y);
          if (ptDist < minGridDist) {
            minGridDist = ptDist;
          }
        }

        // Threshold: within 1.2 grid cells or 35px screen distance
        const maxScreenDistThreshold = Math.max(35, 1.2 * CELL_SIZE * zoom);
        const minScreenDist = minGridDist * CELL_SIZE * zoom;

        if (minScreenDist < maxScreenDistThreshold || centerDistScreen < 35) {
          const effectiveDist = Math.min(minScreenDist, centerDistScreen);
          if (!bestMatch || effectiveDist < bestMatch.distance) {
            bestMatch = { creatureId: creature.id, distance: effectiveDist };
          }
        }
      }

      if (bestMatch) {
        onSelectCreature(bestMatch.creatureId);
      } else {
        onNodeClick(gridPos.x, gridPos.y, false);
      }
    } else if (e.button === 2) {
      // Right click cancels placement / releases captured creature
      if (pendingPlacement) {
        onCancelPlacement();
        return;
      }

      // Right click deselects creature / releases camera focus
      if (selectedCreatureId) {
        onSelectCreature(null);
      }

      onNodeClick(gridPos.x, gridPos.y, true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Non-passive wheel event listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;

      setZoom((prevZoom) => {
        const newZoom = Math.max(0.3, Math.min(3.5, prevZoom * zoomFactor));
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setOffset((prevOffset) => ({
          x: mouseX - (mouseX - prevOffset.x) * (newZoom / prevZoom),
          y: mouseY - (mouseY - prevOffset.y) * (newZoom / prevZoom),
        }));

        return newZoom;
      });
    };

    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheelNative);
    };
  }, []);

  // Reset View handler
  const handleResetView = () => {
    setZoom(1);
    if (canvasRef.current) {
      setOffset({
        x: canvasRef.current.width / 2,
        y: canvasRef.current.height / 2,
      });
    }
  };

  // Main Canvas Render Loop (Runs continuously at 60+ FPS via requestAnimationFrame without tearing down)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      const currentZoom = zoomRef.current;
      const currentGridTheme = gridThemeRef.current;
      const currentSelectedId = selectedCreatureIdRef.current;
      const currentPendingPlacement = pendingPlacementRef.current;
      const currentShowNodes = showNodesRef.current;
      const currentIsCameraLocked = isCameraLockedRef.current;

      // Theme Colors
      const isGameTheme = currentGridTheme === 'game' || currentGridTheme === 'game-light';

      let bgColor = '#090d16';
      let gridLineColor = 'rgba(255, 255, 255, 0.1)';
      let nodeDotColor = 'rgba(255, 255, 255, 0.3)';
      let mainInkColor = '#f1f5f9';

      if (currentGridTheme === 'notebook') {
        bgColor = '#fafaf9';
        gridLineColor = 'rgba(59, 130, 246, 0.22)';
        nodeDotColor = 'rgba(30, 58, 138, 0.4)';
        mainInkColor = '#1e293b';
      } else if (currentGridTheme === 'blueprint') {
        bgColor = '#0f172a';
        gridLineColor = 'rgba(56, 189, 248, 0.25)';
        nodeDotColor = '#38bdf8';
        mainInkColor = '#e0f2fe';
      } else if (currentGridTheme === 'game') {
        bgColor = '#0a0d1d';
        gridLineColor = 'rgba(168, 85, 247, 0.22)';
        nodeDotColor = '#ec4899';
        mainInkColor = '#ffffff';
      } else if (currentGridTheme === 'game-light') {
        bgColor = '#f0fdf4';
        gridLineColor = 'rgba(236, 72, 153, 0.22)';
        nodeDotColor = '#8b5cf6';
        mainInkColor = '#0f172a';
      }

      // Background fill
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      const now = performance.now();
      const dt = lastRenderTimeRef.current ? Math.min((now - lastRenderTimeRef.current) / 1000, 0.1) : 0.016;
      lastRenderTimeRef.current = now;

      const animMap = animStatesRef.current;
      const currentCreatures = creaturesRef.current || [];

      // Smoothly update display states for all creatures frame-by-frame
      currentCreatures.forEach((creature) => {
        let state = animMap.get(creature.id);
        if (!state) {
          state = {
            displayX: creature.x,
            displayY: creature.y,
            displayAngle: creature.angleDeg,
            muscleAnimStep: creature.muscleStep,
          };
          animMap.set(creature.id, state);
        } else {
          // Calculate target with toroidal wrap
          let targetX = creature.x;
          let targetY = creature.y;
          let targetAngle = creature.angleDeg;

          let dx = targetX - state.displayX;
          if (dx > halfWorld) targetX -= worldSize;
          if (dx < -halfWorld) targetX += worldSize;

          let dy = targetY - state.displayY;
          if (dy > halfWorld) targetY -= worldSize;
          if (dy < -halfWorld) targetY += worldSize;

          if (Math.abs(targetX - state.displayX) > halfWorld / 2) {
            state.displayX = creature.x;
            targetX = creature.x;
          }
          if (Math.abs(targetY - state.displayY) > halfWorld / 2) {
            state.displayY = creature.y;
            targetY = creature.y;
          }

          const lerpFactor = 1 - Math.exp(-14 * dt);

          state.displayX += (targetX - state.displayX) * lerpFactor;
          state.displayY += (targetY - state.displayY) * lerpFactor;

          if (state.displayX > halfWorld) state.displayX -= worldSize;
          if (state.displayX < -halfWorld) state.displayX += worldSize;
          if (state.displayY > halfWorld) state.displayY -= worldSize;
          if (state.displayY < -halfWorld) state.displayY += worldSize;

          let angleDiff = targetAngle - state.displayAngle;
          while (angleDiff > 180) angleDiff -= 360;
          while (angleDiff < -180) angleDiff += 360;

          state.displayAngle += angleDiff * lerpFactor;
          state.displayAngle = (state.displayAngle + 360) % 360;

          const distToTarget = Math.hypot(targetX - state.displayX, targetY - state.displayY);
          if (creature.state === 'moving' || creature.state === 'dashing' || distToTarget > 0.05) {
            state.muscleAnimStep += dt * 5.0;
          } else {
            state.muscleAnimStep = creature.muscleStep + Math.sin(now / 350) * 0.3;
          }
        }
      });

      // Compute effective camera offset with smooth lerp tracking
      let currentOffset = offsetRef.current;
      if (currentSelectedId && currentIsCameraLocked && !isDraggingRef.current) {
        const selectedAnimState = animMap.get(currentSelectedId);
        const targetCreature = currentCreatures.find((c) => c.id === currentSelectedId);
        if (selectedAnimState || targetCreature) {
          const targetX = selectedAnimState ? selectedAnimState.displayX : targetCreature!.x;
          const targetY = selectedAnimState ? selectedAnimState.displayY : targetCreature!.y;

          const targetCamX = width / 2 - targetX * CELL_SIZE * currentZoom;
          const targetCamY = height / 2 - targetY * CELL_SIZE * currentZoom;

          if (!cameraOffsetRef.current || (cameraOffsetRef.current.x === 0 && cameraOffsetRef.current.y === 0)) {
            cameraOffsetRef.current = { x: targetCamX, y: targetCamY };
          } else {
            const camLerp = 1 - Math.exp(-12 * dt);
            cameraOffsetRef.current.x += (targetCamX - cameraOffsetRef.current.x) * camLerp;
            cameraOffsetRef.current.y += (targetCamY - cameraOffsetRef.current.y) * camLerp;
          }
          currentOffset = cameraOffsetRef.current;
        }
      } else {
        cameraOffsetRef.current = { ...offsetRef.current };
        currentOffset = offsetRef.current;
      }
      activeOffsetRef.current = currentOffset;

      // Render Grid Lines
      const scaledCell = CELL_SIZE * currentZoom;
      const startX = Math.floor((-currentOffset.x) / scaledCell) - 1;
      const endX = Math.ceil((width - currentOffset.x) / scaledCell) + 1;
      const startY = Math.floor((-currentOffset.y) / scaledCell) - 1;
      const endY = Math.ceil((height - currentOffset.y) / scaledCell) + 1;

      ctx.beginPath();
      ctx.strokeStyle = gridLineColor;
      ctx.lineWidth = Math.max(1, 1.2 * currentZoom);

      for (let x = startX; x <= endX; x++) {
        const screenX = currentOffset.x + x * scaledCell;
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, height);
      }
      for (let y = startY; y <= endY; y++) {
        const screenY = currentOffset.y + y * scaledCell;
        ctx.moveTo(0, screenY);
        ctx.lineTo(width, screenY);
      }
      ctx.stroke();

      // Render Grid Intersections / Nodes
      if (currentShowNodes) {
        ctx.fillStyle = nodeDotColor;
        const dotRadius = Math.max(1.5, 2.5 * currentZoom);
        ctx.beginPath();
        for (let x = startX; x <= endX; x++) {
          const screenX = currentOffset.x + x * scaledCell;
          for (let y = startY; y <= endY; y++) {
            const screenY = currentOffset.y + y * scaledCell;
            ctx.moveTo(screenX + dotRadius, screenY);
            ctx.arc(screenX, screenY, dotRadius, 0, Math.PI * 2);
          }
        }
        ctx.fill();
      }

      // Render Field Arena Border Frame (Fast layered stroke, no expensive shadowBlur)
      const arenaTopLeft = {
        x: currentOffset.x + (-halfWorld) * scaledCell,
        y: currentOffset.y + (-halfWorld) * scaledCell,
      };
      const arenaW = worldSize * scaledCell;
      const arenaH = worldSize * scaledCell;

      const arenaColor = isGameTheme ? '#ec4899' : (currentGridTheme === 'blueprint' ? '#38bdf8' : '#3b82f6');
      ctx.save();
      ctx.strokeStyle = arenaColor + '33';
      ctx.lineWidth = Math.max(6, 10 * currentZoom);
      ctx.strokeRect(arenaTopLeft.x, arenaTopLeft.y, arenaW, arenaH);

      ctx.strokeStyle = arenaColor;
      ctx.lineWidth = Math.max(2, 3.5 * currentZoom);
      ctx.strokeRect(arenaTopLeft.x, arenaTopLeft.y, arenaW, arenaH);
      ctx.restore();

      // Render Food on nodes
      const nowTime = Date.now();
      const currentFoods = foodsRef.current || [];
      currentFoods.forEach((food) => {
        const pos = {
          x: currentOffset.x + food.x * scaledCell,
          y: currentOffset.y + food.y * scaledCell,
        };
        ctx.save();
        ctx.translate(pos.x, pos.y);

        const pulse = Math.sin(nowTime / 200 + food.x + food.y) * 2;
        const foodRadius = (6 + pulse) * currentZoom;

        if (isGameTheme) {
          const glowR = foodRadius * 2.2;
          const mainColor = food.type === 'golden' ? '#facc15' : (food.type === 'super' ? '#ec4899' : '#10b981');

          // Glowing aura
          ctx.fillStyle = mainColor + '44';
          ctx.beginPath();
          ctx.arc(0, 0, glowR, 0, Math.PI * 2);
          ctx.fill();

          // Shiny 3D candy sphere
          ctx.beginPath();
          ctx.arc(0, 0, foodRadius, 0, Math.PI * 2);
          ctx.fillStyle = mainColor;
          ctx.fill();

          // Shadow overlay
          ctx.beginPath();
          ctx.arc(0, foodRadius * 0.15, foodRadius * 0.85, 0, Math.PI);
          ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
          ctx.fill();

          // White specular highlight
          ctx.beginPath();
          ctx.arc(-foodRadius * 0.3, -foodRadius * 0.3, foodRadius * 0.35, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.fill();
        } else {
          if (food.type === 'golden') {
            ctx.fillStyle = 'rgba(234, 179, 8, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, foodRadius * 1.6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#eab308';
          } else if (food.type === 'super') {
            ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, foodRadius * 1.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#a855f7';
          } else {
            ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
            ctx.beginPath();
            ctx.arc(0, 0, foodRadius * 1.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#10b981';
          }

          ctx.beginPath();
          ctx.arc(0, 0, foodRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = mainInkColor;
          ctx.lineWidth = 1.5 * currentZoom;
          ctx.stroke();
        }

        ctx.restore();
      });

      // Render Creatures with Physics Elements
      currentCreatures.forEach((creature) => {
        const animState = animMap.get(creature.id);
        const currentX = animState ? animState.displayX : creature.x;
        const currentY = animState ? animState.displayY : creature.y;
        const currentAngle = animState ? animState.displayAngle : creature.angleDeg;

        // Base head orientation angle and rotation delta
        const baseHeadAngle = determineCreatureHeadAngle(creature.elements);
        const rotationDelta = currentAngle - baseHeadAngle;

        const isSelected = creature.id === currentSelectedId;
        const animStep = animState ? animState.muscleAnimStep : creature.muscleStep;
        const currentContractFactor = 0.5 - 0.5 * Math.cos(animStep * Math.PI);
        const isMuscleContracted = currentContractFactor > 0.05;

        // Calculate kinematic bends ONCE per creature per frame
        const bentMap = calculateKinematicBends(creature.elements, animStep);

        // Toroidal wrapper offsets for seamless boundary transition
        const wrapOffsets: { x: number; y: number }[] = [{ x: 0, y: 0 }];
        const edgeThresh = halfWorld - 10;
        if (currentX > edgeThresh) wrapOffsets.push({ x: -worldSize, y: 0 });
        if (currentX < -edgeThresh) wrapOffsets.push({ x: worldSize, y: 0 });
        if (currentY > edgeThresh) wrapOffsets.push({ x: 0, y: -worldSize });
        if (currentY < -edgeThresh) wrapOffsets.push({ x: 0, y: worldSize });

        wrapOffsets.forEach((off) => {
          const centerPos = {
            x: currentOffset.x + (currentX + off.x) * scaledCell,
            y: currentOffset.y + (currentY + off.y) * scaledCell,
          };

          ctx.save();
          ctx.translate(centerPos.x, centerPos.y);
          ctx.rotate((rotationDelta * Math.PI) / 180);

          // Selection boundary
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(0, 0, 36 * currentZoom, 0, Math.PI * 2);
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2 * currentZoom;
            ctx.setLineDash([6 * currentZoom, 4 * currentZoom]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Render each physical element
          creature.elements.forEach((el) => {
            const bent = bentMap.get(el.id) || { relX: el.relX, relY: el.relY, rotationDeg: 0 };
            const elX = bent.relX * scaledCell;
            const elY = bent.relY * scaledCell;

            ctx.save();
            ctx.translate(elX, elY);
            ctx.rotate((bent.rotationDeg * Math.PI) / 180);

            if (el.type === 'head') {
              if (isGameTheme) {
                const headR = 14 * currentZoom;
                ctx.beginPath();
                ctx.arc(0, 0, headR, 0, Math.PI * 2);
                ctx.fillStyle = creature.color || '#ec4899';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2 * currentZoom;
                ctx.stroke();

                // Two Cartoon Googly Eyes
                const eyeR = 5.5 * currentZoom;
                const pupilR = 2.8 * currentZoom;

                // Left Eye
                ctx.beginPath();
                ctx.arc(-5.5 * currentZoom, -5.5 * currentZoom, eyeR, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(-4.5 * currentZoom, -4.5 * currentZoom, pupilR, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(-5.5 * currentZoom, -5.5 * currentZoom, 1.2 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();

                // Right Eye
                ctx.beginPath();
                ctx.arc(5.5 * currentZoom, -5.5 * currentZoom, eyeR, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(6.5 * currentZoom, -4.5 * currentZoom, pupilR, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(5.5 * currentZoom, -5.5 * currentZoom, 1.2 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.arc(0, 0, 11 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#fef08a';
                ctx.fill();
                ctx.strokeStyle = '#eab308';
                ctx.lineWidth = 2.5 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, 0, 4.5 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#0f172a';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(-2 * currentZoom, -2 * currentZoom, 1.5 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
              }
            } else if (el.type === 'joint') {
              if (isGameTheme) {
                const jointR = 9 * currentZoom;
                ctx.beginPath();
                ctx.arc(0, 0, jointR, 0, Math.PI * 2);
                ctx.fillStyle = '#06b6d4';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(-jointR * 0.3, -jointR * 0.3, jointR * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.fill();
              } else {
                ctx.beginPath();
                ctx.arc(0, 0, 8 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = currentGridTheme === 'notebook' ? '#ffffff' : '#1e293b';
                ctx.fill();
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2.5 * currentZoom;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(0, 0, 3 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = '#0284c7';
                ctx.fill();
              }
            } else if (el.type.startsWith('edge-')) {
              let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
              if (el.type === 'edge-h') { x1 = -scaledCell / 2; x2 = scaledCell / 2; }
              else if (el.type === 'edge-v') { y1 = -scaledCell / 2; y2 = scaledCell / 2; }
              else if (el.type === 'edge-d1') { x1 = -scaledCell / 2; y1 = scaledCell / 2; x2 = scaledCell / 2; y2 = -scaledCell / 2; }
              else if (el.type === 'edge-d2') { x1 = -scaledCell / 2; y1 = -scaledCell / 2; x2 = scaledCell / 2; y2 = scaledCell / 2; }

              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.strokeStyle = creature.color || '#3b82f6';
              ctx.lineWidth = (isGameTheme ? 7.5 : 3.5) * currentZoom;
              ctx.lineCap = 'round';
              ctx.stroke();

              if (isGameTheme) {
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
                ctx.lineWidth = 2.5 * currentZoom;
                ctx.lineCap = 'round';
                ctx.stroke();
              }
            } else if (el.type.startsWith('muscle-')) {
              const isLeft = el.type.includes('left');
              const isRandom = el.type.includes('random');

              let isFlexed = false;
              let isJustFlexed = false;

              if (!isRandom) {
                isFlexed = isMuscleContracted;
                isJustFlexed = isMuscleContracted;
              } else {
                const mState = getRandomMuscleState(el, animStep);
                isFlexed = mState.isFlexed;
                isJustFlexed = mState.justFlexed;
              }

              const muscleFlexFactor = isRandom ? (isFlexed ? currentContractFactor : 0) : currentContractFactor;
              const flex = 1.2 - 0.6 * muscleFlexFactor;
              const sign = isLeft ? -1 : 1;

              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.quadraticCurveTo(sign * 14 * currentZoom * flex, 10 * currentZoom, sign * 20 * currentZoom, 0);

              if (el.type === 'muscle-left') ctx.strokeStyle = '#f43f5e';
              else if (el.type === 'muscle-right') ctx.strokeStyle = '#a855f7';
              else if (el.type === 'muscle-random-left') ctx.strokeStyle = isFlexed ? '#ff8c00' : '#f97316';
              else if (el.type === 'muscle-random-right') ctx.strokeStyle = isFlexed ? '#e024c3' : '#d946ef';

              ctx.lineWidth = (isFlexed ? 4.5 : 3) * currentZoom;
              if (isRandom) {
                ctx.setLineDash([4 * currentZoom, 2 * currentZoom]);
              }
              ctx.stroke();
              ctx.setLineDash([]);

              if (isRandom && isJustFlexed) {
                ctx.beginPath();
                ctx.arc(sign * 12 * currentZoom, 4 * currentZoom, 5 * currentZoom, 0, Math.PI * 2);
                ctx.fillStyle = isLeft ? '#ff8c00' : '#e024c3';
                ctx.fill();
              }

              if (isRandom && el.randomChance) {
                ctx.fillStyle = isFlexed ? '#ffffff' : (isLeft ? '#f97316' : '#d946ef');
                ctx.font = `bold ${Math.max(8, 9 * currentZoom)}px monospace`;
                ctx.textAlign = 'center';
                ctx.fillText(`🎲${el.randomChance}%`, sign * 14 * currentZoom, 18 * currentZoom);
              }
            }

            ctx.restore();
          });

          ctx.restore();

          // Textual HUD overlay over creature
          ctx.save();
          ctx.translate(centerPos.x, centerPos.y);

          const f = creature.forces;

          if (isGameTheme) {
            const nameText = `🐍 ${creature.name} [M:${f.totalMass}]`;
            ctx.font = `bold ${Math.max(11, 13 * currentZoom)}px system-ui, sans-serif`;
            const textWidth = ctx.measureText(nameText).width;
            const badgeW = textWidth + 18 * currentZoom;
            const badgeH = 20 * currentZoom;

            ctx.fillStyle = currentGridTheme === 'game-light' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.85)';
            ctx.strokeStyle = creature.color || '#ec4899';
            ctx.lineWidth = 1.5 * currentZoom;

            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
              ctx.roundRect(-badgeW / 2, -40 * currentZoom, badgeW, badgeH, 10 * currentZoom);
            } else {
              ctx.rect(-badgeW / 2, -40 * currentZoom, badgeW, badgeH);
            }
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = currentGridTheme === 'game-light' ? '#0f172a' : '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(nameText, 0, -30 * currentZoom);
          } else {
            ctx.fillStyle = mainInkColor;
            ctx.font = `bold ${Math.max(11, 13 * currentZoom)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(creature.name, 0, -32 * currentZoom);

            ctx.font = `${Math.max(9, 10 * currentZoom)}px monospace`;
            ctx.fillStyle = '#10b981';
            ctx.fillText(
              `m:${f.totalMass} | v:${f.forwardSpeed.toFixed(2)} | ω:${f.netRotationDeg.toFixed(0)}°`,
              0,
              -20 * currentZoom
            );
          }

          // Energy Bar
          const energyPct = Math.max(0, creature.energy / creature.maxEnergy);
          const barW = 34 * currentZoom;
          const barH = 4 * currentZoom;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(-barW / 2, -14 * currentZoom, barW, barH);
          ctx.fillStyle = energyPct > 0.4 ? '#10b981' : '#f43f5e';
          ctx.fillRect(-barW / 2, -14 * currentZoom, barW * energyPct, barH);

          ctx.restore();
        });
      });

      // Render Ghost Preview during Placement Mode
      const activeHoverGridPos = hoverGridPosRef.current;
      if (currentPendingPlacement && activeHoverGridPos) {
        const centerPos = {
          x: currentOffset.x + activeHoverGridPos.x * scaledCell,
          y: currentOffset.y + activeHoverGridPos.y * scaledCell,
        };
        const baseHeadAngle = determineCreatureHeadAngle(currentPendingPlacement.elements);
        const rotationDelta = currentPendingPlacement.angleDeg - baseHeadAngle;

        ctx.save();
        ctx.translate(centerPos.x, centerPos.y);

        const pulse = Math.sin(Date.now() / 150) * 4;
        ctx.beginPath();
        ctx.arc(0, 0, (28 + pulse) * currentZoom, 0, Math.PI * 2);
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 3 * currentZoom;
        ctx.setLineDash([8 * currentZoom, 4 * currentZoom]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(0, 0, 8 * currentZoom, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.fill();

        ctx.rotate((rotationDelta * Math.PI) / 180);
        ctx.globalAlpha = 0.75;

        currentPendingPlacement.elements.forEach((el) => {
          const elX = el.relX * scaledCell;
          const elY = el.relY * scaledCell;

          ctx.save();
          ctx.translate(elX, elY);

          if (el.type === 'head') {
            ctx.beginPath();
            ctx.arc(0, 0, 11 * currentZoom, 0, Math.PI * 2);
            ctx.fillStyle = '#fef08a';
            ctx.fill();
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2.5 * currentZoom;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 4.5 * currentZoom, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
          } else if (el.type === 'joint') {
            ctx.beginPath();
            ctx.arc(0, 0, 8 * currentZoom, 0, Math.PI * 2);
            ctx.fillStyle = '#1e293b';
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.5 * currentZoom;
            ctx.stroke();
          } else if (el.type.startsWith('edge-')) {
            ctx.beginPath();
            ctx.moveTo(-scaledCell / 2, 0);
            ctx.lineTo(scaledCell / 2, 0);
            ctx.strokeStyle = currentPendingPlacement.color || '#6366f1';
            ctx.lineWidth = 3.5 * currentZoom;
            ctx.stroke();
          } else if (el.type.startsWith('muscle-')) {
            const isLeft = el.type.includes('left');
            const sign = isLeft ? -1 : 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(sign * 14 * currentZoom, 10 * currentZoom, sign * 20 * currentZoom, 0);
            ctx.strokeStyle = el.type.includes('random') ? (isLeft ? '#f97316' : '#d946ef') : (isLeft ? '#f43f5e' : '#a855f7');
            ctx.lineWidth = 3 * currentZoom;
            if (el.type.includes('random')) ctx.setLineDash([4 * currentZoom, 2 * currentZoom]);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.restore();
        });

        ctx.restore();

        ctx.save();
        ctx.translate(centerPos.x, centerPos.y);
        ctx.fillStyle = '#6366f1';
        ctx.font = `bold ${Math.max(10, 12 * currentZoom)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`Нажмите для размещения (${currentPendingPlacement.angleDeg}°)`, 0, -36 * currentZoom);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [halfWorld, worldSize]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-slate-950 cursor-crosshair">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="block w-full h-full"
      />

      {/* Top Banner overlay during Placement Mode */}
      {pendingPlacement && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 border border-indigo-500/60 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center gap-3 text-xs text-slate-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
            <span className="font-bold text-indigo-300">РАЗМЕЩЕНИЕ:</span>
            <span className="font-semibold text-slate-100">"{pendingPlacement.name}"</span>
          </div>

          {/* Orientation Angle selector buttons */}
          <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700/80">
            <Compass className="w-3.5 h-3.5 text-indigo-400 ml-1 mr-0.5" />
            {[270, 0, 90, 180, 315, 45, 135, 225].map((angle) => {
              const labelMap: Record<number, string> = {
                270: '↑ 270°',
                0: '→ 0°',
                90: '↓ 90°',
                180: '← 180°',
                315: '↗ 315°',
                45: '↘ 45°',
                135: '↙ 135°',
                225: '↖ 225°',
              };
              return (
                <button
                  key={angle}
                  onClick={() => onChangePlacementAngle(angle)}
                  className={`px-2 py-1 rounded-lg text-2xs font-bold transition ${
                    pendingPlacement.angleDeg === angle
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {labelMap[angle] || `${angle}°`}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onChangePlacementAngle((pendingPlacement.angleDeg + 45) % 360)}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition text-2xs font-bold flex items-center gap-1"
              title="Повернуть на 45° (Клавиша R)"
            >
              <RotateCw className="w-3 h-3 text-indigo-400" />
              <span>Поворот (R)</span>
            </button>
            <button
              onClick={onCancelPlacement}
              className="px-2.5 py-1 bg-red-950/80 hover:bg-red-900 text-red-200 rounded-xl border border-red-800/60 transition text-2xs font-bold flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Отмена</span>
            </button>
          </div>
        </div>
      )}

      {/* Player Control HUD Widget */}
      {onTurnPlayer && (
        isPlayerHudCollapsed ? (
          <button
            onClick={() => setIsPlayerHudCollapsed(false)}
            className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 bg-slate-900/90 backdrop-blur-md rounded-2xl border border-indigo-500/50 text-indigo-400 hover:bg-slate-800 transition shadow-xl text-xs font-bold cursor-pointer"
            title="Показать панель управления чудиком"
          >
            <Gamepad2 className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Управление</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        ) : (
          <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5 bg-slate-900/95 backdrop-blur-md p-2.5 rounded-2xl border border-indigo-500/50 shadow-2xl text-xs text-slate-100 animate-in fade-in">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 px-0.5">
              <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                <Gamepad2 className="w-4 h-4 text-indigo-400" />
                <span>Управление чудиком</span>
              </div>
              <div className="flex items-center gap-1">
                {selectedCreatureName && (
                  <span className="text-2xs text-slate-400 max-w-[90px] truncate font-semibold">
                    {selectedCreatureName}
                  </span>
                )}
                <button
                  onClick={() => setIsPlayerHudCollapsed(true)}
                  className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                  title="Скрыть панель управления для увеличения обзора"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                onClick={() => onTurnPlayer('left')}
                className="flex-1 py-1.5 px-2 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/50 rounded-xl font-bold flex items-center justify-center gap-1 transition text-xs active:scale-95 shadow-md cursor-pointer"
                title="Повернуть влево на 10° (Стрелка влево ← или A)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>← 10°</span>
              </button>

              <button
                onClick={() => onTurnPlayer('right')}
                className="flex-1 py-1.5 px-2 bg-indigo-600/30 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/50 rounded-xl font-bold flex items-center justify-center gap-1 transition text-xs active:scale-95 shadow-md cursor-pointer"
                title="Повернуть вправо на 10° (Стрелка вправо → или D)"
              >
                <span>10° →</span>
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-2xs text-slate-400 text-center font-mono pt-0.5">
              Управление: Клавиши A / D или Стрелки (← / →)
            </div>
          </div>
        )
      )}

      {/* Floating Canvas Hint overlay */}
      {!isHintHidden && (
        <div className="absolute bottom-4 left-4 z-20 text-xs bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 shadow-xl text-slate-300 flex items-center gap-3">
          {pendingPlacement ? (
            <span className="font-bold text-indigo-400">🎯 Нажмите ЛКМ на сетке для выбора позиции. Зажмите ПКМ для панорамы или клавишу 'R' для поворота!</span>
          ) : (
            <>
              <span>🖱️ ЛКМ: Выбрать / Добавить еду</span>
              <span className="text-slate-600">•</span>
              <span>Зажатие ПКМ: Обзор / Панорама поля</span>
              <span className="text-slate-600">•</span>
              <span>A / D или Стрелки (← / →): Поворот на 10°</span>
            </>
          )}
          <button
            onClick={() => setIsHintHidden(true)}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition ml-1 cursor-pointer"
            title="Скрыть подсказку"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* On-screen Canvas Zoom & View Controls Toolbar */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-800 shadow-xl text-xs font-mono text-slate-300">
        <button
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
          className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-200"
          title="Приблизить поле (+)"
        >
          <ZoomIn className="w-4 h-4 text-indigo-400" />
        </button>
        <span className="px-2 text-2xs font-bold text-indigo-400 select-none">
          {(zoom * 100).toFixed(0)}%
        </span>
        <button
          onClick={() => setZoom((z) => Math.max(0.3, z / 1.2))}
          className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-200"
          title="Отдалить поле (-)"
        >
          <ZoomOut className="w-4 h-4 text-indigo-400" />
        </button>
        <div className="w-px h-4 bg-slate-800 mx-0.5" />
        <button
          onClick={() => {
            const nextState = !isCameraLocked;
            setIsCameraLocked(nextState);
            if (nextState && selectedCreatureId && canvasRef.current) {
              const target = (creaturesRef.current || []).find((c) => c.id === selectedCreatureId);
              if (target) {
                const width = canvasRef.current.width || canvasRef.current.clientWidth;
                const height = canvasRef.current.height || canvasRef.current.clientHeight;
                setOffset({
                  x: width / 2 - target.x * CELL_SIZE * zoom,
                  y: height / 2 - target.y * CELL_SIZE * zoom,
                });
              }
            }
          }}
          className={`p-2 rounded-lg transition ${
            isCameraLocked && selectedCreatureId
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'hover:bg-slate-800 text-slate-400'
          }`}
          title={
            isCameraLocked && selectedCreatureId
              ? 'Авто-слежение за чудиком (Включено)'
              : 'Включить авто-слежение за чудиком'
          }
        >
          <Crosshair className="w-4 h-4 text-indigo-400" />
        </button>
        <button
          onClick={handleResetView}
          className="p-2 hover:bg-slate-800 rounded-lg transition text-slate-200"
          title="Сбросить масштаб (100%) и центрировать"
        >
          <Maximize2 className="w-4 h-4 text-slate-400 hover:text-slate-200" />
        </button>
      </div>
    </div>
  );
};

export const GridCanvas = React.memo(GridCanvasComponent);
export default GridCanvas;
