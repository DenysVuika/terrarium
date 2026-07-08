# 🌿 Terrarium Ecosystem Simulation: Project Instructions

---

## **📌 Project Overview**

**Goal**: Develop a **closed ecosystem simulation** (Terrarium) where **plants, herbivores, and carnivores** interact in a **2D grid world** (250x250 cells). The simulation must balance **resources (O₂, CO₂, water, nutrients)**, **entity lifecycles**, and **combat mechanics** while allowing for **player interaction** (e.g., toggling a lid).

**Key Features**:

- Grid-based world with **terrain types** (soil, water, sand, empty).
- **Plants**: Grow, reproduce, and die based on resources.
- **Herbivores**: Move, eat plants, reproduce, and flee from carnivores.
- **Carnivores**: Move, eat herbivores/carnivores, reproduce, and **fight** (turn-based combat with AP).
- **Resource Cycles**: Global O₂/CO₂ pools, per-cell water/nutrients.
- **Player Actions**: Toggle lid (light/evaporation), add water/soil.

---
---

## **📜 Core Rules & Mechanics**

### **1. World (Grid System)**

- **Grid**: 250x250 cells (for testing).
- **Cell Types**:
  - **Soil**: 200 nutrients, regenerates **+0.1/tick**.
  - **Water**: 100 water, evaporates **-0.1/tick** (if lid is open).
  - **Sand**: No resources, **slows movement by 50%**.
  - **Empty**: Default.
- **Patches**: Connected cells of the same type (irregular shapes).
- **Adjacency**: 4-directional (up/down/left/right).
- **Lid Mechanic**:
  - **Open**: Light = 100%, evaporation = ON.
  - **Closed**: Light = 50%, evaporation = OFF.

**🔗 Diagram**: [Terrarium: Grid System](sandbox/terrarium-grid-system.md)

---

### **2. Plants**

- **Stages**:
  - **Seed (0-20)**: -0.2 nutrients/tick. Dies if growth < 10.
  - **Sprout (20-80)**: -0.5 nutrients/tick.
  - **Mature (80-100)**: -1 nutrient/tick. Can reproduce.
- **Growth**: +1 level/tick if **Light >= 50%**, **Water > 30%**, **Nutrients > 20%**.
- **Reproduction**:
  - **Conditions**: Mature, adjacent empty soil cell, nutrients > 50%.
  - **Cost**: -10 nutrients from parent cell.
- **Death**:
  - **<10 growth**: Die permanently.
  - **≥10 growth**: Wilt (recoverable if conditions improve for 3 ticks).
  - **Decay**: +50 nutrients to cell.

**🔗 Diagram**: [Terrarium: Plants Lifecycle](sandbox/terrarium-plants-lifecycle.md)

---

### **3. Herbivores**

- **Aging**: Egg → Larva (1 tick) → Adult (1 tick).
- **Energy**:
  - **Passive Loss**: -0.1/tick.
  - **Starvation**: Die if energy ≤ 0 for 3 ticks.
- **Movement**:
  - **Soil**: 1 cell/step, -1 energy.
  - **Sand**: 2 steps = 1 cell, -1 energy.
- **Eating**:
  - **Targeting**: Scan within a 5x5 visibility area and move toward nearest plant.
  - **Consume Plant**: +5 energy (80% success if adjacent).
- **Fleeing**:
  - **20% chance to escape** carnivore attacks.
  - **Cost**: -1 energy, move 1 cell away.
- **Reproduction**:
  - **Conditions**: Energy ≥ 10, adjacent empty cell.
  - **Cost**: -3 energy, cooldown 5 ticks.

**🔗 Diagram**: [Terrarium: Herbivore Insects Lifecycle](sandbox/terrarium-herbivore-insects-lifecycle.md)

---

### **4. Carnivores**

- **Aging**: Egg → Larva (1 tick) → Adult (1 tick).
- **Energy**:
  - **Passive Loss**: -0.1/tick.
  - **Starvation**: Die if energy ≤ 0 for 3 ticks.
- **Attack Points (AP)**:
  - **Max**: 10.
  - **Regeneration**: +2/tick (passive).
  - **Death**: AP resets to 0.
- **Movement**:
  - **Soil**: 1 cell/step, -1 energy.
  - **Sand**: 2 steps = 1 cell, -1 energy and -1 AP (terrain strain).
- **Combat**:
  - **Attack Cost**: 3 AP.
  - **Per-Turn Action Cap**: 1 attack action per tick, plus at most 1 chase.
  - **Herbivore Hunt**:
    - 20% chance herbivore escapes (flees 1 cell); otherwise attack resolves.
    - If caught: -2 energy to herbivore. If herbivore dies: +5 energy, +5 AP.
  - **Carnivore vs. Carnivore**:
    - Turn-based: Both lose -2 energy per attack.
    - If AP ≤ 0: Retreat.
    - If energy ≤ 0: Die, winner gains +5 energy, +5 AP.
  - **Chasing**:
    - If herbivore flees, carnivore can **chase once per turn** (1 step).
    - If herbivore escapes to sand: Chase costs **2 steps**.
- **Reproduction**:
  - **Conditions**: Energy ≥ 15, adjacent empty cell.
  - **Cost**: -5 energy, cooldown 5 ticks, AP = 0.

**🔗 Diagram**: [Terrarium: Carnivore Insects Lifecycle](sandbox/terrarium-carnivore-insects-lifecycle.md)

---

### **5. Resources**

#### **Global Pools**

- **Normalization**: O₂ and CO₂ are normalized percentages in the range 0-100 and are clamped each tick.
- **O₂**: Initial = 100.
  - **Plants**: +2/tick per 10 living plants (photosynthesis).
  - **Insects**: -1/tick per 10 living insects (respiration).
  - **Imbalance**: O₂ < 10 → insects lose -1 energy/tick.
- **CO₂**: Initial = 50.
  - **Plants**: -1/tick per 10 living plants (consumption).
  - **Insects**: +1/tick per 10 living insects (production).
  - **Imbalance**: CO₂ > 90 → plants grow at 50% rate.

#### **Per-Cell Resources**

- **Water**:
  - **Rain**: +10/cell (10% chance/tick).
  - **Drought**: -5/cell (5% chance/tick).
  - **Evaporation**: -0.1/tick (if lid is open).
  - **Insect Drinking**: -0.5 from adjacent water cell.
- **Nutrients**:
  - **Soil Regeneration**: +0.1/tick/cell.
  - **Depletion**: If <10 in a cell, plants wilt.
  - **Decay**:
    - Dead plants add +50 nutrients to their cell.
    - Dead herbivores/carnivores add +20 nutrients to their cell.

**🔗 Diagram**: [Terrarium: Resource Cycle](sandbox/terrarium-resource-cycle.md)

---

### **6. Game Loop (Per Tick)**

1. **Day/Night Cycle**: Toggle light (day: 100%, night: 0%).
2. **Weather**: Roll for rain/drought.
3. **Resource Regeneration**:
   - Soil: +0.1 nutrients/cell.
   - Water: -0.1/cell (evaporation if lid is open).
4. **Entity Actions**:
   - **Plants**: Grow, reproduce, or wilt/die.
   - **Insects**: Move, eat, reproduce, fight, or die.
5. **Decay**: Process dead entities → add nutrients to soil.
6. **Win/Lose Check**:
  - **Lose**:
    - O₂ < 10 for 3 consecutive ticks, or
    - CO₂ > 90 for 3 consecutive ticks, or
    - no water cell has water > 1 for 3 consecutive ticks, or
    - all plants die, or all insects die.
   - **Win**: Ecosystem survives 100 ticks.

---

### **7. Canonical Conflict-Resolution Rules (Prototype)**

Use this section as the source of truth if any diagram and prose disagree.

| Rule Area | Canonical Rule |
|---|---|
| Carnivore on sand | 2 steps = 1 cell, -1 energy and -1 AP |
| Herbivore flee roll | 20% escape success; 80% attack resolves |
| Carnivore turn economy | Max 1 attack action and 1 chase per tick |
| Plant growth light threshold | Growth allowed at light >= 50 |
| Decay rewards | Plant: +50 nutrients; insect: +20 nutrients |
| Gas bounds | O₂/CO₂ are clamped to 0-100 each tick |
| Water-loss condition | Trigger only after 3 ticks with no cell above water > 1 |

**🔗 Diagram**: [Terrarium: Main Game Loop](sandbox/terrarium-main-game-loop.md)

---
---

## **🎯 Next Steps for AI Agent**

### **Priority Tasks**

1. **Implement Grid System**:
   - Create a **250x250 grid** with terrain types (soil, water, sand, empty).
   - Define **patches** (connected cells of the same type).
   - Add **adjacency rules** (4-directional).

2. **Develop Entity Classes**:
   - **Plants**: Growth stages, reproduction, death.
   - **Herbivores**: Movement, eating, fleeing, reproduction.
   - **Carnivores**: Movement, combat (AP system), chasing, reproduction.

3. **Resource Management**:
   - **Global Pools**: O₂/CO₂.
   - **Per-Cell Resources**: Water/nutrients.
   - **Decay System**: Dead entities → nutrients.

4. **Combat System**:
   - Turn-based fights (carnivore vs. carnivore).
   - Herbivore fleeing (20% escape chance).
   - Chasing mechanics (1 chase per turn).

5. **Player Interaction**:
   - Toggle lid (light/evaporation).
   - Add water/soil (limited uses).

---

### **Testing Goals**

- **Balance Check**:
  - Ensure **O₂/CO₂** levels remain stable.
  - Verify **water/nutrients** don’t deplete too quickly.
  - Test **combat balance** (carnivores vs. herbivores).
- **Edge Cases**:
  - What happens if **all soil cells deplete nutrients**?
  - How do **droughts** affect long-term survival?
  - Can **carnivores overpopulate** and wipe out herbivores?

---

### **Deliverables**

1. **Code Implementation**:
   - Grid system (250x250).
   - Entity classes (plants, herbivores, carnivores).
   - Resource management (global/per-cell).
   - Combat mechanics (AP, chasing).
2. **Documentation**:
   - Updated **Mermaid diagrams** (if rules change).
   - **README** with setup/instructions.
3. **Testing Report**:
   - Logs of **ecosystem stability** over 100 ticks.
   - **Balance adjustments** (e.g., AP regeneration rate).

---

### **🔗 Quick Links to Diagrams**

|  System              | Canvas Link                                 |
|----------------------|---------------------------------------------|
| Grid System          | [terrarium-grid-system](sandbox/terrarium-grid-system.md)       |
| Plants Lifecycle     | [terrarium-plants-lifecycle](sandbox/terrarium-plants-lifecycle.md) |
| Herbivore Lifecycle  | [terrarium-herbivore-insects-lifecycle](sandbox/terrarium-herbivore-insects-lifecycle.md) |
| Carnivore Lifecycle  | [terrarium-carnivore-insects-lifecycle](sandbox/terrarium-carnivore-insects-lifecycle.md) |
| Resource Cycle       | [terrarium-resource-cycle](sandbox/terrarium-resource-cycle.md) |
| Main Game Loop       | [terrarium-main-game-loop](sandbox/terrarium-main-game-loop.md) |

---

### **💡 Notes for AI Agent**

- **Start Small**: Implement **plants first**, then herbivores, then carnivores.
- **Log Everything**: Track **resource levels, entity counts, and combat outcomes** for debugging.
- **Tune as You Go**: Adjust **rates (growth, AP, energy)** based on testing.
- **Ask for Clarification**: If any rule is ambiguous, refer to the **Mermaid diagrams** or ask for input.
