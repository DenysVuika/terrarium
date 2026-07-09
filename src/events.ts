export type SimulationEvent =
  | { type: 'cycle'; phase: 'day' | 'night'; light: number }
  | { type: 'weather-rain'; cells: number }
  | { type: 'weather-drought'; cells: number }
  | { type: 'plants-born'; count: number }
  | { type: 'plants-died'; count: number }
  | { type: 'herbivores-born'; count: number }
  | { type: 'carnivores-born'; count: number }
  | { type: 'herbivores-died'; count: number }
  | { type: 'carnivores-died'; count: number }
  | { type: 'predation-kills'; count: number }
  | { type: 'rival-kills'; count: number }
  | { type: 'warning-low-o2'; streak: number }
  | { type: 'warning-high-co2'; streak: number }
  | { type: 'warning-low-water'; streak: number };

export function formatSimulationEvent(event: SimulationEvent): string {
  switch (event.type) {
    case 'cycle':
      return `cycle: ${event.phase} light=${event.light}`;
    case 'weather-rain':
      return `weather: rain cells=${event.cells}`;
    case 'weather-drought':
      return `weather: drought cells=${event.cells}`;
    case 'plants-born':
      return `plants: born=${event.count}`;
    case 'plants-died':
      return `plants: died=${event.count}`;
    case 'herbivores-born':
      return `herbivores: born=${event.count}`;
    case 'carnivores-born':
      return `carnivores: born=${event.count}`;
    case 'herbivores-died':
      return `herbivores: died=${event.count}`;
    case 'carnivores-died':
      return `carnivores: died=${event.count}`;
    case 'predation-kills':
      return `predation: herbivore-kills=${event.count}`;
    case 'rival-kills':
      return `combat: carnivore-kills=${event.count}`;
    case 'warning-low-o2':
      return `warning: low-o2 streak=${event.streak}`;
    case 'warning-high-co2':
      return `warning: high-co2 streak=${event.streak}`;
    case 'warning-low-water':
      return `warning: low-water streak=${event.streak}`;
  }
}
