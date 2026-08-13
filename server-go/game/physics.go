package game

import (
	"fmt"
	"math"
	"math/rand"
	"strings"
)

// Default Creature Presets
var DefaultPresets = []struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Elements    []CreatureElement `json:"elements"`
}{
	{
		Name:        "Чудик-Маятник",
		Description: "Центральный шарнир с головой вверху, симметричными ребрами и противоположными мышцами. Бежит вперед!",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -1, Type: ElementHead, Weight: 0, HeadAngle: floatPtr(270)},
			{ID: "joint-center", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0},
			{ID: "edge-l1", RelX: -1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-r1", RelX: 1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-v1", RelX: 0, RelY: -1, Type: ElementEdgeV, Weight: 1},
			{ID: "muscle-l", RelX: -1, RelY: -1, Type: ElementMuscleLeft, Weight: 0},
			{ID: "muscle-r", RelX: 1, RelY: -1, Type: ElementMuscleRight, Weight: 0},
		},
	},
	{
		Name:        "Асимметричный Вращатель",
		Description: "Имеет голову и больше ребер на левом плече. Легкое правое плечо совершает поворот на шарнире при сокращении.",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -1, Type: ElementHead, Weight: 0, HeadAngle: floatPtr(270)},
			{ID: "joint-center", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0},
			{ID: "edge-l1", RelX: -1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-l2", RelX: -1, RelY: 1, Type: ElementEdgeV, Weight: 1},
			{ID: "edge-r1", RelX: 1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "muscle-l", RelX: -1, RelY: -1, Type: ElementMuscleLeft, Weight: 0},
		},
	},
	{
		Name:        "Диагональный Бегун (45°)",
		Description: "Использует диагональные ребра (/) и (\\) с ведущей головой для быстрого перемещения по сетке.",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -1, Type: ElementHead, Weight: 0, HeadAngle: floatPtr(270)},
			{ID: "joint-center", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0},
			{ID: "edge-d1", RelX: -1, RelY: -1, Type: ElementEdgeD2, Weight: 1},
			{ID: "edge-d2", RelX: 1, RelY: -1, Type: ElementEdgeD1, Weight: 1},
			{ID: "edge-d3", RelX: -1, RelY: 1, Type: ElementEdgeD1, Weight: 1},
			{ID: "edge-d4", RelX: 1, RelY: 1, Type: ElementEdgeD2, Weight: 1},
			{ID: "muscle-l", RelX: -1, RelY: 0, Type: ElementMuscleLeft, Weight: 0},
			{ID: "muscle-r", RelX: 1, RelY: 0, Type: ElementMuscleRight, Weight: 0},
		},
	},
	{
		Name:        "Двухшарнирный Сороконожка",
		Description: "Два шарнира на разных узлах сетки с мышцами сгибания и головой, создающими движение вперед.",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -2, Type: ElementHead, Weight: 0, HeadAngle: floatPtr(270)},
			{ID: "joint-1", RelX: 0, RelY: -1, Type: ElementJoint, Weight: 0},
			{ID: "joint-2", RelX: 0, RelY: 1, Type: ElementJoint, Weight: 0},
			{ID: "edge-v", RelX: 0, RelY: 0, Type: ElementEdgeV, Weight: 1},
			{ID: "edge-h1", RelX: -1, RelY: -1, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-h2", RelX: 1, RelY: -1, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-h3", RelX: -1, RelY: 1, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-h4", RelX: 1, RelY: 1, Type: ElementEdgeH, Weight: 1},
			{ID: "muscle-1", RelX: -1, RelY: 0, Type: ElementMuscleLeft, Weight: 0},
			{ID: "muscle-2", RelX: 1, RelY: 0, Type: ElementMuscleRight, Weight: 0},
		},
	},
	{
		Name:        "Хаотичный Бегун (Случайные Мышцы 🎲)",
		Description: "Использует случайные мышцы с вероятностью срабатывания (35%). Движение и повороты непредсказуемы каждый ход!",
		Elements: []CreatureElement{
			{ID: "head-top", RelX: 0, RelY: -1, Type: ElementHead, Weight: 0, HeadAngle: floatPtr(270)},
			{ID: "joint-center", RelX: 0, RelY: 0, Type: ElementJoint, Weight: 0},
			{ID: "edge-l1", RelX: -1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-r1", RelX: 1, RelY: 0, Type: ElementEdgeH, Weight: 1},
			{ID: "edge-v1", RelX: 0, RelY: -1, Type: ElementEdgeV, Weight: 1},
			{ID: "muscle-rnd-l", RelX: -1, RelY: -1, Type: ElementMuscleRandomLeft, Weight: 0, RandomChance: floatPtr(35)},
			{ID: "muscle-rnd-r", RelX: 1, RelY: -1, Type: ElementMuscleRandomRight, Weight: 0, RandomChance: floatPtr(35)},
		},
	},
}

func floatPtr(v float64) *float64 {
	return &v
}

func IsRandomMuscleTriggered(el CreatureElement, cycle int) bool {
	if cycle <= 0 {
		return true
	}
	chance := 35.0
	if el.RandomChance != nil {
		chance = *el.RandomChance
	}
	chance = math.Max(10.0, math.Min(90.0, chance))
	hash := int32(0)
	str := fmt.Sprintf("%s_c_%d", el.ID, cycle)
	for i := 0; i < len(str); i++ {
		hash = (hash << 5) - hash + int32(str[i])
	}
	val := math.Abs(float64(hash))
	valMod := math.Mod(val, 100)
	return valMod < chance
}

type RandomMuscleState struct {
	IsFlexed     bool
	JustFlexed   bool
	JustUnflexed bool
}

func GetRandomMuscleState(el CreatureElement, step int) RandomMuscleState {
	if step <= 0 {
		return RandomMuscleState{}
	}
	isTriggeredNow := IsRandomMuscleTriggered(el, step)
	isTriggeredPrev := IsRandomMuscleTriggered(el, step-1)
	return RandomMuscleState{
		IsFlexed:     isTriggeredNow,
		JustFlexed:   isTriggeredNow && !isTriggeredPrev,
		JustUnflexed: !isTriggeredNow && isTriggeredPrev,
	}
}

func DetermineCreatureHeadAngle(elements []CreatureElement) float64 {
	for _, el := range elements {
		if el.Type == ElementHead {
			if el.HeadAngle != nil {
				return *el.HeadAngle
			}
			if el.RelX != 0 || el.RelY != 0 {
				rad := math.Atan2(el.RelY, el.RelX)
				deg := math.Round((rad * 180) / math.Pi)
				if deg < 0 {
					deg += 360
				}
				return deg
			}
		}
	}
	return 270.0
}

func CalculatePhysicsForces(elements []CreatureElement, muscleActiveStep int) PhysicsForces {
	isMuscleContracted := muscleActiveStep%2 == 1

	type JointNode struct {
		ID string
		X  float64
		Y  float64
	}

	joints := []JointNode{}
	edgeElements := []CreatureElement{}
	muscleElements := []CreatureElement{}

	totalMass := 0.0
	totalInertia := 0.0
	totalLeftMass := 0.0
	totalRightMass := 0.0

	for _, el := range elements {
		elWeight := el.Weight

		if el.Type == ElementJoint {
			joints = append(joints, JointNode{ID: el.ID, X: el.RelX, Y: el.RelY})
			elWeight = 1.0 // Базовая масса сустава / ядра
		} else if strings.HasPrefix(string(el.Type), "edge-") {
			edgeElements = append(edgeElements, el)
			if elWeight <= 0 {
				elWeight = 1.0
			}
		} else if strings.HasPrefix(string(el.Type), "muscle-") {
			muscleElements = append(muscleElements, el)
			elWeight = 0.3 // Небольшая масса мышцы
		} else if el.Type == ElementHead {
			elWeight = 0.5 // Масса головы
		}

		totalMass += elWeight

		// Расчет момента инерции масс относительно центра масс (0,0): I = sum(m * (r^2 + 0.5))
		rSq := el.RelX*el.RelX + el.RelY*el.RelY
		totalInertia += elWeight * (rSq + 0.5)

		if el.RelX < 0 {
			totalLeftMass += elWeight
		} else if el.RelX > 0 {
			totalRightMass += elWeight
		} else {
			totalLeftMass += elWeight * 0.5
			totalRightMass += elWeight * 0.5
		}
	}

	if len(joints) == 0 {
		joints = append(joints, JointNode{ID: "center-joint", X: 0, Y: 0})
		totalMass += 1.0
		totalInertia += 0.5
	}

	totalMass = math.Max(1.0, totalMass)
	totalInertia = math.Max(1.0, totalInertia)

	jointsPhysics := []JointPhysics{}
	sumLeftTorque := 0.0
	sumRightTorque := 0.0
	totalActiveMusclesCount := 0
	motionActiveMusclesCount := 0

	hasMultipleJoints := len(joints) > 1

	for _, j := range joints {
		jLeftMass := 0.0
		jRightMass := 0.0
		jLeftTorquePotential := 0.0
		jRightTorquePotential := 0.0

		for _, el := range edgeElements {
			weight := el.Weight
			if weight <= 0 {
				weight = 1.0
			}
			dx := el.RelX - j.X

			if dx < 0 {
				arm := -dx
				leverMultiplier := 1.0 + 0.5*(arm-1.0)
				jLeftMass += weight
				jLeftTorquePotential += weight * leverMultiplier
			} else if dx > 0 {
				arm := dx
				leverMultiplier := 1.0 + 0.5*(arm-1.0)
				jRightMass += weight
				jRightTorquePotential += weight * leverMultiplier
			} else {
				jLeftMass += weight * 0.5
				jRightMass += weight * 0.5
				jLeftTorquePotential += weight * 0.5
				jRightTorquePotential += weight * 0.5
			}
		}

		activeLeftMuscles := 0.0
		activeRightMuscles := 0.0

		for _, el := range muscleElements {
			if hasMultipleJoints {
				mdx := el.RelX - j.X
				mdy := el.RelY - j.Y
				if mdx*mdx+mdy*mdy > 6.25 {
					continue
				}
			}

			providesTorque := false
			providesMotion := false

			if el.Type == ElementMuscleLeft || el.Type == ElementMuscleRight {
				providesTorque = isMuscleContracted
				providesMotion = true
			} else if el.Type == ElementMuscleRandomLeft || el.Type == ElementMuscleRandomRight {
				mState := GetRandomMuscleState(el, muscleActiveStep)
				providesTorque = mState.JustFlexed
				providesMotion = mState.JustFlexed || mState.JustUnflexed
			}

			if providesTorque {
				// Плечо рычага мышцы вдоль продольной оси
				muscleArm := 1.0 + 0.4*math.Abs(el.RelY-j.Y)
				muscleForce := 1.5 * muscleArm

				if strings.Contains(string(el.Type), "left") {
					activeLeftMuscles += muscleForce
				} else if strings.Contains(string(el.Type), "right") {
					activeRightMuscles += muscleForce
				}
			}

			if providesMotion {
				motionActiveMusclesCount++
			}
		}

		jointLeftForce := activeLeftMuscles
		jointRightForce := activeRightMuscles
		netJointTorque := jointLeftForce - jointRightForce

		jointsPhysics = append(jointsPhysics, JointPhysics{
			JointID:              j.ID,
			JX:                   j.X,
			JY:                   j.Y,
			LeftEdgeMass:         jLeftMass,
			RightEdgeMass:        jRightMass,
			LeftTorquePotential:  jLeftTorquePotential,
			RightTorquePotential: jRightTorquePotential,
			ActiveLeftMuscles:    int(math.Round(activeLeftMuscles)),
			ActiveRightMuscles:   int(math.Round(activeRightMuscles)),
			NetJointTorque:       netJointTorque,
		})

		sumLeftTorque += jointLeftForce
		sumRightTorque += jointRightForce
		if activeLeftMuscles+activeRightMuscles > 0 {
			totalActiveMusclesCount++
		}
	}

	netTorque := sumLeftTorque - sumRightTorque

	// 1. Угол разворота: w = (Torque / Inertia) * C_rotation
	// Чем больше момент инерции I, тем больше требуется крутящего момента Torque для разворота
	netRotationDeg := 0.0
	if math.Abs(netTorque) > 0 {
		rawRotation := (netTorque / totalInertia) * 28.0
		netRotationDeg = math.Min(60.0, math.Max(-60.0, rawRotation))
	}

	isLighterSideRotating := totalLeftMass != totalRightMass && netTorque != 0

	// 2. Линейная скорость движения вперед: v = (Thrust / Mass) * C_speed
	// Чем тяжелее тело (больше Mass), тем больше мышц/тяги требуется для движения
	forwardSpeed := 0.0
	if motionActiveMusclesCount > 0 || sumLeftTorque > 0 || sumRightTorque > 0 {
		thrust := 0.0
		if sumLeftTorque > 0 && sumRightTorque > 0 {
			// Работают мышцы с обеих сторон (симметричная тяга вперед)
			thrust = sumLeftTorque + sumRightTorque
		} else if sumLeftTorque > 0 || sumRightTorque > 0 {
			// Работает только одна сторона (разворот с увлечением вперед)
			thrust = math.Max(sumLeftTorque, sumRightTorque) * 0.65
		} else {
			thrust = 0.8 * float64(motionActiveMusclesCount)
		}

		calculatedSpeed := (thrust / totalMass) * 0.22
		forwardSpeed = math.Min(0.40, math.Max(0.02, calculatedSpeed))
	}

	return PhysicsForces{
		LeftTorque:            sumLeftTorque,
		RightTorque:           sumRightTorque,
		NetRotationDeg:        netRotationDeg,
		ForwardSpeed:          forwardSpeed,
		LeftMass:              totalLeftMass,
		RightMass:             totalRightMass,
		TotalMass:             totalMass,
		TotalInertia:          totalInertia,
		IsLighterSideRotating: isLighterSideRotating,
		JointsPhysics:         jointsPhysics,
		ActiveMusclesCount:    totalActiveMusclesCount,
	}
}

// ResolveCreatureCollisions implements Newtonian 2D rigid-body collision physics:
// - Two-phase detection (broad-phase bounding sphere + narrow-phase element-level)
// - Mass-proportional positional anti-overlap separation
// - Impulse exchange with elasticity e=0.55 and tangential friction (spin)
// - Angular momentum & torque calculation based on Moment of Inertia (I)
// - Linear recoil displacement inversely proportional to total mass
func ResolveCreatureCollisions(creatures map[string]*Creature) {
	if len(creatures) < 2 {
		return
	}

	const touchDist = 1.0    // elementRadius(0.5) * 2
	const restitution = 0.55 // Coefficient of restitution e = 0.55
	const frictionCoef = 0.35 // Tangential friction coefficient for glancing hits

	list := make([]*Creature, 0, len(creatures))
	for _, c := range creatures {
		list = append(list, c)
	}

	for i := 0; i < len(list); i++ {
		for j := i + 1; j < len(list); j++ {
			cA := list[i]
			cB := list[j]

			// 1. Broad-phase bounding sphere check
			rA := CalculateCreatureRadius(cA.Elements)
			rB := CalculateCreatureRadius(cB.Elements)
			centerDist := math.Hypot(cB.X-cA.X, cB.Y-cA.Y)
			if centerDist >= rA+rB {
				continue
			}

			// 2. Narrow-phase: element-level contact point search
			ptsA := GetCreatureElementWorldPositions(cA.X, cA.Y, cA.AngleDeg, cA.Elements)
			ptsB := GetCreatureElementWorldPositions(cB.X, cB.Y, cB.AngleDeg, cB.Elements)

			minElDist := math.Inf(1)
			var contactPtA, contactPtB Point

			for pa := 0; pa < len(ptsA); pa++ {
				for pb := 0; pb < len(ptsB); pb++ {
					edist := math.Hypot(ptsB[pb].X-ptsA[pa].X, ptsB[pb].Y-ptsA[pa].Y)
					if edist < minElDist {
						minElDist = edist
						contactPtA = ptsA[pa]
						contactPtB = ptsB[pb]
					}
				}
			}

			if minElDist >= touchDist {
				continue
			}

			// 3. Normal vector from contact point A to contact point B
			nx := contactPtB.X - contactPtA.X
			ny := contactPtB.Y - contactPtA.Y
			nlen := math.Hypot(nx, ny)

			if nlen < 0.0001 {
				nx = cB.X - cA.X
				ny = cB.Y - cA.Y
				nlen = math.Hypot(nx, ny)
				if nlen < 0.0001 {
					nx = 1
					ny = 0
					nlen = 1
				}
			}
			nx /= nlen
			ny /= nlen

			mA := math.Max(0.5, cA.Forces.TotalMass)
			mB := math.Max(0.5, cB.Forces.TotalMass)
			iA := math.Max(1.0, cA.Forces.TotalInertia)
			iB := math.Max(1.0, cB.Forces.TotalInertia)

			// 4. Positional anti-overlap separation (mass weighted)
			overlap := touchDist - minElDist
			if overlap > 0 {
				pushA := overlap * (mB / (mA + mB))
				pushB := overlap * (mA / (mA + mB))
				cA.X -= nx * pushA
				cA.Y -= ny * pushA
				cB.X += nx * pushB
				cB.Y += ny * pushB
			}

			// 5. Contact point position vectors relative to creature center of mass
			rxA := contactPtA.X - cA.X
			ryA := contactPtA.Y - cA.Y
			rxB := contactPtB.X - cB.X
			ryB := contactPtB.Y - cB.Y

			// 6. Linear velocities at centers of mass
			speedA := cA.Forces.ForwardSpeed * 0.35
			if cA.State == "dashing" {
				speedA *= 1.6
			}
			speedB := cB.Forces.ForwardSpeed * 0.35
			if cB.State == "dashing" {
				speedB *= 1.6
			}

			radA := (cA.AngleDeg * math.Pi) / 180.0
			radB := (cB.AngleDeg * math.Pi) / 180.0

			vAx := speedA * math.Cos(radA)
			vAy := speedA * math.Sin(radA)
			vBx := speedB * math.Cos(radB)
			vBy := speedB * math.Sin(radB)

			// Projection of relative velocity onto contact normal
			vAn := vAx*nx + vAy*ny
			vBn := vBx*nx + vBy*ny
			vRelN := vAn - vBn

			// 7. Impulse calculation only when creatures are approaching
			if vRelN > 0 {
				// 2D angular cross product components (r x n)
				rnA := rxA*ny - ryA*nx
				rnB := rxB*ny - ryB*nx

				// Effective inverse mass along normal including rotational inertia
				kn := (1.0 / mA) + (1.0 / mB) + (rnA*rnA)/iA + (rnB*rnB)/iB

				impulseN := ((1.0 + restitution) * vRelN) / kn

				// Tangential friction vector (spins and glancing hits)
				tx := -ny
				ty := nx
				vAt := vAx*tx + vAy*ty
				vBt := vBx*tx + vBy*ty
				vRelT := vAt - vBt

				rtA := rxA*ty - ryA*tx
				rtB := rxB*ty - ryB*tx
				kt := (1.0 / mA) + (1.0 / mB) + (rtA*rtA)/iA + (rtB*rtB)/iB

				maxFriction := frictionCoef * impulseN
				impulseT := math.Max(-maxFriction, math.Min(maxFriction, vRelT/kt))

				// Total impulse vectors acting on A and B
				jAx := -(impulseN*nx + impulseT*tx)
				jAy := -(impulseN*ny + impulseT*ty)
				jBx := +(impulseN*nx + impulseT*tx)
				jBy := +(impulseN*ny + impulseT*ty)

				// Linear momentum recoil displacement (pushback inversely proportional to mass)
				recoilFactor := 0.45
				cA.X += (jAx / mA) * recoilFactor
				cA.Y += (jAy / mA) * recoilFactor
				cB.X += (jBx / mB) * recoilFactor
				cB.Y += (jBy / mB) * recoilFactor

				// Rotational Torque: τ = r x J = rx * Jy - ry * Jx
				torqueA := rxA*jAy - ryA*jAx
				torqueB := rxB*jBy - ryB*jBx

				// Angular rotation step Δθ = (τ / I) * (180 / π) * k
				dAngleA := (torqueA / iA) * (180.0 / math.Pi) * 1.25
				dAngleB := (torqueB / iB) * (180.0 / math.Pi) * 1.25

				clampedDA := math.Max(-30.0, math.Min(30.0, dAngleA))
				clampedDB := math.Max(-30.0, math.Min(30.0, dAngleB))

				cA.AngleDeg = math.Mod(cA.AngleDeg+clampedDA+360.0, 360.0)
				cB.AngleDeg = math.Mod(cB.AngleDeg+clampedDB+360.0, 360.0)
				cA.TargetAngleDeg = cA.AngleDeg
				cB.TargetAngleDeg = cB.AngleDeg
			}
		}
	}
}

type Point struct {
	X float64
	Y float64
}

func GetVectorFromAngle(angleDeg float64) (float64, float64) {
	rad := (angleDeg * math.Pi) / 180.0
	return math.Cos(rad), math.Sin(rad)
}

func CalculateCreatureRadius(elements []CreatureElement) float64 {
	maxR := 0.5
	for _, el := range elements {
		r := math.Hypot(el.RelX, el.RelY) + 0.5
		if r > maxR {
			maxR = r
		}
	}
	return maxR
}

func PointToSegmentDistanceSq(px, py, ax, ay, bx, by float64) float64 {
	// Normalize px, py and bx, by relative to ax, ay for wrapped boundaries
	dpx := px - ax
	if dpx > 50.0 {
		dpx -= 100.0
	} else if dpx < -50.0 {
		dpx += 100.0
	}
	dpy := py - ay
	if dpy > 50.0 {
		dpy -= 100.0
	} else if dpy < -50.0 {
		dpy += 100.0
	}

	dbx := bx - ax
	if dbx > 50.0 {
		dbx -= 100.0
	} else if dbx < -50.0 {
		dbx += 100.0
	}
	dby := by - ay
	if dby > 50.0 {
		dby -= 100.0
	} else if dby < -50.0 {
		dby += 100.0
	}

	if dbx == 0 && dby == 0 {
		return dpx*dpx + dpy*dpy
	}
	l2 := dbx*dbx + dby*dby
	t := math.Max(0, math.Min(1, (dpx*dbx+dpy*dby)/l2))
	projX := t * dbx
	projY := t * dby
	return (dpx-projX)*(dpx-projX) + (dpy-projY)*(dpy-projY)
}

func GetCreatureElementWorldPositions(cx, cy, angleDeg float64, elements []CreatureElement) []Point {
	baseHeadAngle := DetermineCreatureHeadAngle(elements)
	rotRad := ((angleDeg - baseHeadAngle) * math.Pi) / 180.0
	cos := math.Cos(rotRad)
	sin := math.Sin(rotRad)

	points := []Point{{X: cx, Y: cy}}
	for _, el := range elements {
		wx := cx + el.RelX*cos - el.RelY*sin
		wy := cy + el.RelX*sin + el.RelY*cos
		points = append(points, Point{X: wx, Y: wy})
	}
	return points
}

func FindEatenFood(prevX, prevY, prevAngleDeg, nextX, nextY, nextAngleDeg float64, elements []CreatureElement, foods []Food) *Food {
	if len(foods) == 0 {
		return nil
	}
	maxRadiusSq := 0.7 * 0.7

	startPts := GetCreatureElementWorldPositions(prevX, prevY, prevAngleDeg, elements)
	endPts := GetCreatureElementWorldPositions(nextX, nextY, nextAngleDeg, elements)

	for i := range foods {
		f := &foods[i]
		if PointToSegmentDistanceSq(f.X, f.Y, prevX, prevY, nextX, nextY) <= maxRadiusSq {
			return f
		}
		for p := range endPts {
			sp := Point{X: prevX, Y: prevY}
			if p < len(startPts) {
				sp = startPts[p]
			}
			ep := endPts[p]
			if PointToSegmentDistanceSq(f.X, f.Y, sp.X, sp.Y, ep.X, ep.Y) <= maxRadiusSq {
				return f
			}
		}
	}
	return nil
}

// FindConnectedComponents divides elements into connected graph components (grid adjacency max(|dx|,|dy|) <= 1)
func FindConnectedComponents(elements []CreatureElement) [][]CreatureElement {
	n := len(elements)
	if n == 0 {
		return nil
	}

	visited := make([]bool, n)
	var components [][]CreatureElement

	for i := 0; i < n; i++ {
		if visited[i] {
			continue
		}
		var comp []CreatureElement
		queue := []int{i}
		visited[i] = true

		for len(queue) > 0 {
			currIdx := queue[0]
			queue = queue[1:]
			currEl := elements[currIdx]
			comp = append(comp, currEl)

			for j := 0; j < n; j++ {
				if visited[j] {
					continue
				}
				otherEl := elements[j]
				dx := math.Abs(currEl.RelX - otherEl.RelX)
				dy := math.Abs(currEl.RelY - otherEl.RelY)
				if dx <= 1.05 && dy <= 1.05 {
					visited[j] = true
					queue = append(queue, j)
				}
			}
		}
		components = append(components, comp)
	}

	return components
}

// SelectWinningComponent picks the component with most heads > greatest mass > random choice
func SelectWinningComponent(components [][]CreatureElement) []CreatureElement {
	if len(components) == 0 {
		return nil
	}
	if len(components) == 1 {
		return components[0]
	}

	type compStats struct {
		elements  []CreatureElement
		headCount int
		totalMass float64
	}

	stats := make([]compStats, len(components))
	maxHeads := -1

	for i, comp := range components {
		heads := 0
		mass := 0.0
		for _, el := range comp {
			if el.Type == ElementHead {
				heads++
				mass += 0.5
			} else if el.Type == ElementJoint {
				mass += 1.0
			} else if strings.HasPrefix(string(el.Type), "edge-") {
				mass += 1.0
			} else if strings.HasPrefix(string(el.Type), "muscle-") {
				mass += 0.3
			} else {
				mass += 0.5
			}
		}
		stats[i] = compStats{
			elements:  comp,
			headCount: heads,
			totalMass: mass,
		}
		if heads > maxHeads {
			maxHeads = heads
		}
	}

	var headCandidates []compStats
	for _, s := range stats {
		if s.headCount == maxHeads {
			headCandidates = append(headCandidates, s)
		}
	}

	if len(headCandidates) == 1 {
		return headCandidates[0].elements
	}

	maxMass := -1.0
	for _, c := range headCandidates {
		if c.totalMass > maxMass {
			maxMass = c.totalMass
		}
	}

	var massCandidates []compStats
	for _, c := range headCandidates {
		if math.Abs(c.totalMass-maxMass) < 1e-4 {
			massCandidates = append(massCandidates, c)
		}
	}

	if len(massCandidates) == 1 {
		return massCandidates[0].elements
	}

	rndIdx := rand.Intn(len(massCandidates))
	return massCandidates[rndIdx].elements
}

// ResolveCreatureBites handles biting when a head touches another creature's element
func ResolveCreatureBites(creatures map[string]*Creature) {
	if len(creatures) < 2 {
		return
	}

	list := make([]*Creature, 0, len(creatures))
	for _, c := range creatures {
		list = append(list, c)
	}

	const biteTouchDist = 1.15

	type biteEvent struct {
		biterID       string
		targetID      string
		targetElemIdx int
	}

	var biteEvents []biteEvent

	for i := 0; i < len(list); i++ {
		cA := list[i]
		headWorldPts := []Point{}
		ptsA := GetCreatureElementWorldPositions(cA.X, cA.Y, cA.AngleDeg, cA.Elements)

		for idx, el := range cA.Elements {
			if el.Type == ElementHead {
				if idx+1 < len(ptsA) {
					headWorldPts = append(headWorldPts, ptsA[idx+1])
				}
			}
		}

		if len(headWorldPts) == 0 {
			continue
		}

		for j := 0; j < len(list); j++ {
			if i == j {
				continue
			}
			cB := list[j]

			rA := CalculateCreatureRadius(cA.Elements)
			rB := CalculateCreatureRadius(cB.Elements)
			if math.Hypot(cB.X-cA.X, cB.Y-cA.Y) > rA+rB+2.0 {
				continue
			}

			ptsB := GetCreatureElementWorldPositions(cB.X, cB.Y, cB.AngleDeg, cB.Elements)

			bitten := false
			for _, hPt := range headWorldPts {
				if bitten {
					break
				}
				for elIdx := range cB.Elements {
					if elIdx+1 >= len(ptsB) {
						continue
					}
					bPt := ptsB[elIdx+1]

					dx := bPt.X - hPt.X
					if dx > 50.0 {
						dx -= 100.0
					} else if dx < -50.0 {
						dx += 100.0
					}
					dy := bPt.Y - hPt.Y
					if dy > 50.0 {
						dy -= 100.0
					} else if dy < -50.0 {
						dy += 100.0
					}

					if math.Hypot(dx, dy) <= biteTouchDist {
						biteEvents = append(biteEvents, biteEvent{
							biterID:       cA.ID,
							targetID:      cB.ID,
							targetElemIdx: elIdx,
						})
						bitten = true
						break
					}
				}
			}
		}
	}

	for _, bEvent := range biteEvents {
		cA, existsA := creatures[bEvent.biterID]
		cB, existsB := creatures[bEvent.targetID]
		if !existsA || !existsB {
			continue
		}
		if bEvent.targetElemIdx >= len(cB.Elements) {
			continue
		}

		targetEl := cB.Elements[bEvent.targetElemIdx]
		removeIdx := -1

		if targetEl.Type == ElementJoint {
			muscleIdx := -1
			for mIdx, el := range cB.Elements {
				if strings.HasPrefix(string(el.Type), "muscle-") {
					dx := math.Abs(el.RelX - targetEl.RelX)
					dy := math.Abs(el.RelY - targetEl.RelY)
					if dx <= 1.05 && dy <= 1.05 {
						muscleIdx = mIdx
						break
					}
				}
			}
			if muscleIdx != -1 {
				removeIdx = muscleIdx
			} else {
				removeIdx = bEvent.targetElemIdx
			}
		} else {
			removeIdx = bEvent.targetElemIdx
		}

		if removeIdx >= 0 && removeIdx < len(cB.Elements) {
			remainingEls := make([]CreatureElement, 0, len(cB.Elements)-1)
			remainingEls = append(remainingEls, cB.Elements[:removeIdx]...)
			remainingEls = append(remainingEls, cB.Elements[removeIdx+1:]...)

			comps := FindConnectedComponents(remainingEls)
			winningComp := SelectWinningComponent(comps)

			cB.Elements = winningComp

			if len(cB.Elements) == 0 {
				delete(creatures, cB.ID)
				cA.FoodEaten += 5
				cA.Score += 50
				cA.Energy = math.Min(cA.MaxEnergy, cA.Energy+30.0)
			} else {
				cB.Forces = CalculatePhysicsForces(cB.Elements, cB.MuscleStep)
				cA.FoodEaten += 1
				cA.Score += 15
				cA.Energy = math.Min(cA.MaxEnergy, cA.Energy+10.0)
			}
		}
	}
}
