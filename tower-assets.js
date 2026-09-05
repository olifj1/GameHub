window.TowerAttackAssets = Object.freeze({
  version: "1.8.9-ai-vehicle-pass",
  vehicleAtlas: Object.freeze({
    src: "tower-vehicles.png?v=1.8.9",
    width: 768,
    height: 512,
    cell: 256,
    cols: 3,
    rows: 2
  }),
  vehicles: Object.freeze({
    scout: Object.freeze({ col: 0, worldWidth: 86, worldHeight: 86 }),
    gunbuggy: Object.freeze({ col: 1, worldWidth: 86, worldHeight: 86 }),
    tank: Object.freeze({ col: 2, worldWidth: 92, worldHeight: 96 })
  }),
  teamRows: Object.freeze({ player: 0, enemy: 1 })
});
