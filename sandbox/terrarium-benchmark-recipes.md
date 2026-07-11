# Terrarium Benchmark Recipes

Use these command patterns to compare behavior across seeds and scenarios.

```bash
# 1) Quick default sweep (5 seeds, current defaults)
pnpm simulate:sweep

# 2) Long-run sweep with CSV export
pnpm simulate:sweep:long

# 3) Custom long-run sweep with explicit seeds
pnpm simulate --sweep --ticks 800 --sweep-seeds alpha,gamma,epsilon --sweep-csv runs/bench/sweep-800-custom.csv

# 4) Matrix benchmark: multiple scenario configs x same seed set
pnpm simulate --sweep --ticks 450 \
  --sweep-seeds alpha,beta,gamma,delta,epsilon \
  --sweep-matrix-configs runs/bench/age-0.5.yaml,runs/bench/age-0.25.yaml,runs/bench/age-0.1.yaml \
  --sweep-csv runs/bench/sweep-matrix-450.csv
```

## Scenario Config Pattern

Create small override files and keep one change dimension per file.

`runs/bench/age-0.25.yaml`

```yaml
insects:
  herbivores:
    agePerTick: 0.25
  carnivores:
    agePerTick: 0.25
```

## Suggested Comparison Fields

- `outcome`
- `finalTick`
- `plants`
- `herbivores`
- `carnivores`
- `o2`
- `co2`

## Practical Reading Rule

For long-run tuning, prioritize configurations that avoid full insect collapse while keeping both herbivores and carnivores non-zero across most seeds.
