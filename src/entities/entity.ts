/**
 * Base class for all simulation entities (plants and insects).
 * Holds identity, position, and liveness — subclasses implement tick().
 */
export abstract class Entity {
  readonly id: string;
  cell: number;
  alive: boolean;

  constructor(id: string, cell: number) {
    this.id = id;
    this.cell = cell;
    this.alive = true;
  }
}
