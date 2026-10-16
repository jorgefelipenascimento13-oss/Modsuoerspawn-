import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";

// ==========================================
// REGISTRO GLOBAL DE TORRES INDUSTRIAIS
// ==========================================
const activeTowers = new Map();

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  const { block, dimension } = event;
  const typeId = block.typeId;

  if (
    typeId === "meu_addon:industrial_planter" ||
    typeId === "meu_addon:industrial_fertilizer" ||
    typeId === "meu_addon:industrial_harvester"
  ) {
    const key = `${block.location.x},${block.location.y},${block.location.z},${dimension.id}`;
    activeTowers.set(key, {
      type: typeId,
      location: block.location,
      dimension: dimension
    });
  }
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  const { block, dimension } = event;
  const key = `${block.location.x},${block.location.y},${block.location.z},${dimension.id}`;
  if (activeTowers.has(key)) {
    activeTowers.delete(key);
  }
});

// ==========================================
// 1. LÓGICA DA PAXEL (VEIN MINE & ARADO 3X3)
// ==========================================

const VEIN_BLOCKS = new Set([
  "minecraft:stone", "minecraft:deepslate",
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
]);

// VEIN MINE
world.afterEvents.playerBreakBlock.subscribe((event) => {
  const { player, brokenBlockPermutation, block } = event;
  
  // Leitura segura do item na mão principal do jogador
  const inventory = player.getComponent("inventory");
  const mainHand = inventory?.container?.getItem(player.selectedSlotIndex);

  if (!mainHand || mainHand.typeId !== "meu_addon:paxel") return;

  const blockTypeId = brokenBlockPermutation.type.id;
  if (!VEIN_BLOCKS.has(blockTypeId)) return;

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

// ARADO 3X3 (Transforma a terra corretamente sem colocar blocos em cima)
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const { player, block } = event;
  
  const inventory = player.getComponent("inventory");
  const mainHand = inventory?.container?.getItem(player.selectedSlotIndex);

  if (!mainHand || mainHand.typeId !== "meu_addon:paxel") return;

  if (block.typeId === "minecraft:grass_block" || block.typeId === "minecraft:dirt" || block.typeId === "minecraft:dirt_with_roots") {
    const farmland = BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 });
    const center = block.location;

    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        const targetLocation = { x: center.x + x, y: center.y, z: center.y ? center.y : center.y, z: center.z + z };
        // Correção limpa para as coordenadas 3x3
        const exactLoc = { x: center.x + x, y: center.y, z: center.z + z };
        const targetBlock = player.dimension.getBlock(exactLoc);

        if (targetBlock && (targetBlock.typeId === "minecraft:grass_block" || targetBlock.typeId === "minecraft:dirt")) {
          targetBlock.setPermutation(farmland);
        }
      }
    }
  }
});
