window.TowerAttackAssets = Object.freeze({
  version: "1.8.8-stage1",
  vehicleAtlas: Object.freeze({
    src: "tower-vehicles.png?v=1.8.8",
    width: 768,
    height: 512,
    cell: 256,
    cols: 3,
    rows: 2
  }),
  vehicles: Object.freeze({
    scout: Object.freeze({ col: 0, worldWidth: 78, worldHeight: 78 }),
    gunbuggy: Object.freeze({ col: 1, worldWidth: 78, worldHeight: 78 }),
    tank: Object.freeze({ col: 2, worldWidth: 86, worldHeight: 90 })
  }),
  teamRows: Object.freeze({ player: 0, enemy: 1 })
});
