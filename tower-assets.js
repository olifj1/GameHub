window.TowerAttackAssets = Object.freeze({
  version: "1.8.11-genai-terrain-test",
  vehicleAtlas: Object.freeze({
    src: "tower-vehicles.png?v=1.8.11",
    width: 768,
    height: 512,
    cell: 256,
    cols: 3,
    rows: 2
  }),
  vehicles: Object.freeze({
    scout: Object.freeze({ col: 0, worldWidth: 86, worldHeight: 86, uiScale: .92 }),
    gunbuggy: Object.freeze({ col: 1, worldWidth: 86, worldHeight: 86, uiScale: .92 }),
    tank: Object.freeze({ col: 2, worldWidth: 92, worldHeight: 96, uiScale: .96 })
  }),
  defenceAtlas: Object.freeze({
    src: "tower-defences.png?v=1.8.11",
    width: 768,
    height: 512,
    cell: 256,
    cols: 3,
    rows: 2
  }),
  defences: Object.freeze({
    lightturret: Object.freeze({ col: 0, worldWidth: 74, worldHeight: 74, uiScale: .92 }),
    cannon: Object.freeze({ col: 1, worldWidth: 80, worldHeight: 80, uiScale: .96 }),
    rapid: Object.freeze({ col: 2, worldWidth: 78, worldHeight: 78, uiScale: .94 })
  }),
  sceneryAtlas: Object.freeze({
    src: "tower-scenery.png?v=1.8.11",
    width: 768,
    height: 576,
    cell: 192,
    cols: 4,
    rows: 3
  }),
  scenery: Object.freeze({
    tree0: Object.freeze({ col:0,row:0 }),
    tree1: Object.freeze({ col:1,row:0 }),
    tree2: Object.freeze({ col:2,row:0 }),
    tree3: Object.freeze({ col:3,row:0 }),
    rock0: Object.freeze({ col:0,row:1 }),
    rock1: Object.freeze({ col:1,row:1 }),
    rock2: Object.freeze({ col:2,row:1 }),
    rock3: Object.freeze({ col:3,row:1 }),
    ruin: Object.freeze({ col:0,row:2 }),
    relay: Object.freeze({ col:1,row:2 }),
    hut: Object.freeze({ col:2,row:2 }),
    wall: Object.freeze({ col:3,row:2 })
  }),
  terrain: Object.freeze({
    src: "tower-terrain.png?v=1.8.11",
    width: 660,
    height: 1120,
    bakedScenery: true
  }),
  teamRows: Object.freeze({ player: 0, enemy: 1 })
});
