import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";

// ==========================================
// 1. LÓGICA DA PAXEL (VEIN MINE & ARADO 3X3)
// ==========================================

const VEIN_BLOCKS = [
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
// 2. FUNÇÕES AUXILIARES DA TORRE INDUSTRIAL
// ==========================================

function getAdjacentChestContainer(dimension, loc) {
  const directions = [
    { x: loc.x + 1, y: loc.y, z: loc.z },
    { x: loc.x - 1, y: loc.y, z: loc.z },
    { x: loc.x, y: loc.y, z: loc.z + 1 },
    { x: loc.x, y: loc.y, z: loc.z - 1 },
    { x: loc.x, y: loc.y + 1, z: loc.z },
    { x: loc.x, y: loc.y - 1, z: loc.z }
  ];

  for (const dir of directions) {
    const block = dimension.getBlock(dir);
    if (block && block.typeId === "minecraft:chest") {
      const invComp = block.getComponent("inventory");
      if (invComp && invComp.container) {
        return invComp.container;
      }
    }
  }
  return null;
}

function consumeItemFromContainer(container, itemTypeId, amount = 1) {
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item && item.typeId === itemTypeId) {
      if (item.amount > amount) {
        item.amount -= amount;
        container.setItem(i, item);
      } else {
        container.setItem(i, undefined);
      }
      return true;
    }
  }
  return false;
}

function addItemToContainer(container, itemTypeId, amount = 1) {
  let remaining = amount;
  for (let i = 0; i < container.size && remaining > 0; i++) {
    const item = container.getItem(i);
    if (!item) {
      container.setItem(i, new ItemStack(itemTypeId, remaining));
      remaining = 0;
    } else if (item.typeId === itemTypeId && item.amount < 64) {
      const space = 64 - item.amount;
      const add = Math.min(space, remaining);
      item.amount += add;
      remaining -= add;
      container.setItem(i, item);
    }
  }
  return remaining === 0;
}

// ==========================================
// 3. LOOP DA TORRE INDUSTRIAL (A CADA 1 SEGUNDO)
// ==========================================

system.runInterval(() => {
  const dimension = world.getDimension("overworld");

  for (const player of dimension.getPlayers()) {
    const pLoc = player.location;
    const searchRadius = 16;

    // Procura por torres nas proximidades dos jogadores para otimizar desempenho
    for (let x = -searchRadius; x <= searchRadius; x += 4) {
      for (let z = -searchRadius; z <= searchRadius; z += 4) {
        const checkLoc = { x: Math.floor(pLoc.x) + x, y: Math.floor(pLoc.y), z: Math.floor(pLoc.z) + z };
        const block = dimension.getBlock(checkLoc);

        if (block && (block.typeId === "meu_addon:industrial_planter" || block.typeId === "meu_addon:industrial_fertilizer" || block.typeId === "meu_addon:industrial_harvester")) {
          const chestContainer = getAdjacentChestContainer(dimension, checkLoc);
          if (!chestContainer) continue;

          const radius = 8; // Área de 17x17 ao redor da torre
          const baseY = checkLoc.y;

          // Executa automação na área horizontal
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              const targetLoc = { x: checkLoc.x + dx, y: baseY, z: checkLoc.z + dz };
              const groundBlock = dimension.getBlock(targetLoc);
              const aboveBlock = dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z });

              if (!groundBlock) continue;

              // 1. PLANTADOR: Transforma terra em farmland e planta sementes/mudas com espaçamento
              if (groundBlock.typeId === "minecraft:dirt" || groundBlock.typeId === "minecraft:grass_block") {
                const farmland = BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 });
                groundBlock.setPermutation(farmland);
              } else if (groundBlock.typeId === "minecraft:farmland" && (!aboveBlock || aboveBlock.typeId === "minecraft:air")) {
                // Tenta plantar sementes do baú
                const seeds = ["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"];
                for (const seedId of seeds) {
                  if (consumeItemFromContainer(chestContainer, seedId, 1)) {
                    const cropMap = {
                      "minecraft:wheat_seeds": "minecraft:wheat",
                      "minecraft:carrot": "minecraft:carrots",
                      "minecraft:potato": "minecraft:potatoes",
                      "minecraft:beetroot_seeds": "minecraft:beetroot"
                    };
                    dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z }).setType(cropMap[seedId]);
                    break;
                  }
                }
              }

              // 2. FERTILIZADOR: Consome Farinha de Osso para acelerar plantações, cana, bambu e árvores
              if (aboveBlock) {
                if (aboveBlock.typeId === "minecraft:wheat" || aboveBlock.typeId === "minecraft:carrots" || aboveBlock.typeId === "minecraft:potatoes") {
                  if (consumeItemFromContainer(chestContainer, "minecraft:bone_meal", 1)) {
                    aboveBlock.setPermutation(aboveBlock.permutation.withState("growth", 7));
                  }
                }
                // Cana-de-açúcar (cresce até 3 blocos)
                else if (aboveBlock.typeId === "minecraft:reeds") {
                  if (consumeItemFromContainer(chestContainer, "minecraft:bone_meal", 1)) {
                    let topY = targetLoc.y + 1;
                    let height = 0;
                    while (dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z })?.typeId === "minecraft:reeds" && height < 3) {
                      topY++;
                      height++;
                    }
                    if (height < 3 && dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z })?.typeId === "minecraft:air") {
                      dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z }).setType("minecraft:reeds");
                    }
                  }
                }
                // Bambu (cresce até 12 blocos)
                else if (aboveBlock.typeId === "minecraft:bamboo") {
                  if (consumeItemFromContainer(chestContainer, "minecraft:bone_meal", 1)) {
                    let topY = targetLoc.y + 1;
                    let height = 0;
                    while (dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z })?.typeId === "minecraft:bamboo" && height < 12) {
                      topY++;
                      height++;
                    }
                    if (height < 12 && dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z })?.typeId === "minecraft:air") {
                      dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z }).setType("minecraft:bamboo");
                    }
                  }
                }
              }

              // 3. COLHEDOR: Recolhe plantações maduras e envia ao baú
              if (aboveBlock && aboveBlock.typeId === "minecraft:wheat") {
                const growth = aboveBlock.permutation.getState("growth");
                if (growth === 7) {
                  aboveBlock.setType("minecraft:air");
                  addItemToContainer(chestContainer, "minecraft:wheat", 1);
                  addItemToContainer(chestContainer, "minecraft:wheat_seeds", 1);
                }
              }
            }
          }
        }
      }
    }
  });
}, 20);
