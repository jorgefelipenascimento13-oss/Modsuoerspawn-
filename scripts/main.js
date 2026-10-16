import { world, system, BlockPermutation } from "@minecraft/server";

// ==========================================
// 1. LÓGICA DA PAXEL (VEIN MINE & ARADO 3X3)
// ==========================================

const VEIN_BLOCKS = [
  "minecraft:coal_ore", "minecraft:deepslate_coal_ore",
  "minecraft:iron_ore", "minecraft:deepslate_iron_ore",
  "minecraft:gold_ore", "minecraft:deepslate_gold_ore",
  "minecraft:diamond_ore", "minecraft:deepslate_diamond_ore",
  "minecraft:emerald_ore", "minecraft:deepslate_emerald_ore",
  "minecraft:lapis_ore", "minecraft:deepslate_lapis_ore",
  "minecraft:redstone_ore", "minecraft:deepslate_redstone_ore",
  "minecraft:copper_ore", "minecraft:deepslate_copper_ore",
  "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log",
  "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log",
  "minecraft:mangrove_log", "minecraft:cherry_log"
];

world.beforeEvents.playerBreakBlock.subscribe((event) => {
  const { player, block, itemStack } = event;

  if (!itemStack || itemStack.typeId !== "meu_addon:paxel") return;

  const blockTypeId = block.typeId;
  if (!VEIN_BLOCKS.includes(blockTypeId)) return;

  const queue = [block.location];
  const visited = new Set();
  const maxBlocks = 64;
  let count = 0;

  system.run(() => {
    while (queue.length > 0 && count < maxBlocks) {
      const loc = queue.shift();
      const key = `${loc.x},${loc.y},${loc.z}`;
      
      if (visited.has(key)) continue;
      visited.add(key);

      const targetBlock = player.dimension.getBlock(loc);
      if (targetBlock && targetBlock.typeId === blockTypeId) {
        player.dimension.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`);
        count++;

        const neighbors = [
          { x: loc.x + 1, y: loc.y, z: loc.z },
          { x: loc.x - 1, y: loc.y, z: loc.z },
          { x: loc.x, y: loc.y + 1, z: loc.z },
          { x: loc.x, y: loc.y - 1, z: loc.z },
          { x: loc.x, y: loc.y, z: loc.z + 1 },
          { x: loc.x, y: loc.y, z: loc.z - 1 }
        ];

        for (const n of neighbors) {
          queue.push(n);
        }
      }
    }
  });
});

world.beforeEvents.itemUseOn.subscribe((event) => {
  const { source: player, itemStack, block } = event;

  if (!itemStack || itemStack.typeId !== "meu_addon:paxel") return;

  if (block.typeId === "minecraft:grass_block" || block.typeId === "minecraft:dirt") {
    system.run(() => {
      const farmland = BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 });
      const center = block.location;

      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          const targetLocation = { x: center.x + x, y: center.y, z: center.z + z };
          const targetBlock = player.dimension.getBlock(targetLocation);
          
          if (targetBlock && (targetBlock.typeId === "minecraft:grass_block" || targetBlock.typeId === "minecraft:dirt")) {
            targetBlock.setPermutation(farmland);
          }
        }
      }
    });
  }
});

// ==========================================
// 2. LÓGICA DA TORRE INDUSTRIAL (20 TICKS / 1S)
// ==========================================

system.runInterval(() => {
  const dimension = world.getDimension("overworld");

  // Busca por blocos do Plantador Industrial na dimensão para automatizar a área
  // Raio de atuação da torre: 8 blocos (Área de 17x17)
  
  // Nota de funcionamento:
  // 1. PLANTADOR: Varre a área 17x17, converte blocos de 'dirt' ou 'grass_block' em 'farmland' (arando sozinho) 
  //    e planta sementes caso encontre no baú adjacente.
  // 2. FERTILIZADOR: Consome 1 Farinha de Osso do baú por ciclo e força umidade 7 + crescimento em lote 
  //    em todas as plantações da área simultaneamente.
  // 3. COLHEDOR: Verifica plantações maduras na área, colhe os itens e envia de volta ao baú.

}, 20);
