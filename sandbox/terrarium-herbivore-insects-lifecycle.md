# Terrarium Herbivore Insects Lifecycle

```mermaid
flowchart TD
    H1[Egg] -->|4 ticks| H2[Larva]
    H2 -->|2 ticks| H3[Adult]

    H3 --> H4[Passive energy minus 0.1 and step charge plus 1.2]
    H4 --> H5{Nearby drinkable water in eight neighborhood}
    H5 -->|Yes| H6[Drink remove 0.5 water from nearby cell]
    H5 -->|No| H7[Dehydration penalty minus 0.5 energy]

    H6 --> H8{Target plant within radius two}
    H7 --> H8
    H8 -->|Yes| H9[Move toward plant using eight direction pathing]
    H8 -->|No| H10[Roam with anti backtrack bias]

    H9 --> H11[Move cost step 1 soil or 1.5 sand energy minus 1]
    H10 --> H11

    H11 --> H12{Plant in current or adjacent eight neighborhood}
    H12 -->|Yes with 80 percent chance| H13[Eat plant plus 5 energy plant removed]
    H12 -->|No| H14[No meal]

    H13 --> H15{Reproduction gate passes energy ge 14 cooldown 0 chance 20 pct}
    H14 --> H15
    H15 -->|Yes and spawn space available| H16[Lay egg energy minus 6 cooldown 16]
    H15 -->|No| H17[No reproduction]

    H17 --> H18{Starvation ge 3 or age ge max}
    H16 --> H18
    H18 -->|Yes| H19[Die plus 20 nutrients]
    H18 -->|No| H3
```
