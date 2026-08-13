export interface Point {
  x: number;
  y: number;
}

export type ElementType =
  | 'head'          // Голова (Определяет ВПЕРЕД для чудика, вес 0)
  | 'joint'         // Шарнир на узле (вес 0)
  | 'edge-h'        // Горизонтальное ребро (вес 1)
  | 'edge-v'        // Вертикальное ребро (вес 1)
  | 'edge-d1'       // Диагональное ребро / (вес 1)
  | 'edge-d2'       // Диагональное ребро \ (вес 1)
  | 'muscle-left'   // Мышца левого сгиба (сокращает шарнир влево)
  | 'muscle-right'  // Мышца правого сгиба (сокращает шарнир вправо)
  | 'muscle-random-left'  // Случайная мышца слева (вероятность срабатывания 4-20%)
  | 'muscle-random-right'; // Случайная мышца справа (вероятность срабатывания 4-20%)

export interface CreatureElement {
  id: string;
  relX: number; // Координата относительно центрального шарнира
  relY: number;
  type: ElementType;
  weight: number; // 1 для ребер, 0 для шарнира / головы
  musclePhase?: number; // Фаза сокращения мышцы
  headAngle?: number; // 270 (Вверх), 0 (Вправо), 90 (Вниз), 180 (Влево)
  randomChance?: number; // Вероятность срабатывания случайной мышцы каждый ход (от 5% до 90%)
}

export interface JointPhysics {
  jointId: string;
  jx: number;
  jy: number;
  leftEdgeMass: number;
  rightEdgeMass: number;
  leftTorquePotential: number;
  rightTorquePotential: number;
  activeLeftMuscles: number;
  activeRightMuscles: number;
  netJointTorque: number;
}

export interface PhysicsForces {
  leftTorque: number;       // Сила кручения влево (число ребер с этой стороны)
  rightTorque: number;      // Сила кручения вправо
  netRotationDeg: number;   // Поворот на шаг (градусы: -90, -45, 0, 45, 90)
  forwardSpeed: number;     // Скорость движения вперед при балансе сил (прямо пропорциональна сумме сил)
  leftMass: number;         // Масса левого плеча
  rightMass: number;        // Масса правого плеча
  totalMass: number;        // Общая масса (сумма ребер = масса)
  totalInertia?: number;    // Момент инерции вокруг центра
  isLighterSideRotating: boolean; // Вращается легкое плечо вокруг шарнира
  jointsPhysics?: JointPhysics[]; // Расчет физики относительно каждого шарнира
  activeMusclesCount?: number;    // Число сработавших мышц на шаге
}

export interface Creature {
  id: string;
  name: string;
  color: string;
  // Позиция ведущего шарнира на глобальных узлах сетки
  x: number;
  y: number;
  elements: CreatureElement[];
  energy: number;
  maxEnergy: number;
  foodEaten: number;
  stepsCount: number;
  angleDeg: number; // Угол ориентации чудика (0, 45, 90, 135, 180, 225, 270, 315)
  forces: PhysicsForces;
  state: 'idle' | 'hunting' | 'eating' | 'moving';
  muscleStep: number; // Шаг анимации мышц
  moveProgress: number;
  prevX: number;
  prevY: number;
  prevAngleDeg: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  type: 'berry' | 'super' | 'golden';
  spawnTime: number;
}

export type GridTheme = 'notebook' | 'blueprint' | 'dark' | 'paper' | 'game' | 'game-light';

export interface SimulationStats {
  foodEatenTotal: number;
  creaturesCreated: number;
  currentStep: number;
}

export interface PendingPlacement {
  name: string;
  elements: CreatureElement[];
  color: string;
  angleDeg: number;
}

export interface CreatureLogEntry {
  id: string;
  timestamp: string;
  creatureId: string;
  name: string;
  color: string;
  action: 'создан' | 'размещен' | 'изменен' | 'сохранен' | 'пресет';
  initialX: number;
  initialY: number;
  initialAngleDeg: number;
  elementCount: number;
  leftMass: number;
  rightMass: number;
  totalMass: number;
  randomMusclesInfo: string;
  elements: CreatureElement[];
}

export interface User {
  id: string;
  username: string;
  isAdmin?: boolean;
}

export interface SavedPreset {
  id: string;
  name: string;
  description: string;
  color: string;
  elements: CreatureElement[];
  createdAt: string;
}

