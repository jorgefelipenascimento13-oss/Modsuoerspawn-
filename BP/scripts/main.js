import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";

// ==========================================
// REGISTRO GLOBAL DE TORRES INDUSTRIAIS
// ==========================================
const activeTowers = new Map();

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  try {
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
  } catch (e) {}
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  try {
    const { block, dimension } = event;
    const key = `${block.location.x},${block.location.y},${block.location.z},${dimension.id}`;
    if (activeTowers.has(key)) {
      activeTowers.delete(key);
    }
  } catch (e) {}
});

// ==========================================
// 1. AUTO-ENCANTAR A PAXEL E RESTAURAR DURABILIDADE
// ==========================================
system.runInterval(() => {
  try {
    for (const player of world.getAllPlayers()) {
      const inventory = player.getComponent("inventory");
      if (!inventory || !inventory.container) continue;

      const item = inventory.container.getItem(player.selectedSlotIndex);
      if (item && item.typeId === "meu_addon:paxel") {
        player.runCommandAsync("enchant @s sharpness 5");
        player.runCommandAsync("enchant @s efficiency 5");
        player.runCommandAsync("enchant @s unbreaking 3");
        player.runCommandAsync("enchant @s fortune 3");
        player.runCommandAsync("enchant @s looting 3");
        player.runCommandAsync("enchant @s mending 1");
      }
    }
  } catch (e) {}
}, 20);

// ==========================================
// 2. LÓGICA DO VEIN MINE
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

world.afterEvents.playerBreakBlock.subscribe((event) => {
  try {
    const { player, brokenBlockPermutation, block } = event;
    
    const inventory = player.getComponent("inventory");
    if (!inventory || !inventory.container) return;

    const mainHand = inventory.container.getItem(player.selectedSlotIndex);
    if (!mainHand || mainHand.typeId !== "meu_addon:paxel") return;

    const blockTypeId = brokenBlockPermutation.type.id;
    if (!VEIN_BLOCKS.has(blockTypeId)) return;

    const queue = [block.location];
    const visited = new Set();
    const maxBlocks = 64;
    let count = 0;

    system.run(() => {
      try {
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
      } catch (err) {}
    });
  } catch (e) {}
});

// ==========================================
// 3. ARADO 3X3
// ==========================================
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  try {
    const { player, block } = event;
    
    const inventory = player.getComponent("inventory");
    if (!inventory || !inventory.container) return;

    const mainHand = inventory.container.getItem(player.selectedSlotIndex);
    if (!mainHand || mainHand.typeId !== "meu_addon:paxel") return;

    const validSoil = new Set([
      "minecraft:grass_block",
      "minecraft:dirt",
      "minecraft:dirt_with_roots",
      "minecraft:coarse_dirt"
    ]);

    if (validSoil.has(block.typeId)) {
      const center = block.location;

      system.run(() => {
        try {
          for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
              const exactLoc = { x: center.x + x, y: center.y, z: center.z + z };
              const targetBlock = player.dimension.getBlock(exactLoc);

              if (targetBlock && validSoil.has(targetBlock.typeId)) {
                const blockAbove = player.dimension.getBlock({ x: exactLoc.x, y: exactLoc.y + 1, z: exactLoc.z });
                if (blockAbove && blockAbove.typeId === "minecraft:air") {
                  player.dimension.runCommand(`setblock ${exactLoc.x} ${exactLoc.y} ${exactLoc.z} farmland`);
                }
              }
            }
          }
        } catch (err) {}
      });
    }
  } catch (e) {}
});

// ==========================================
// 4. FUNÇÕES DE INVENTÁRIO
// ==========================================
function getBlockContainer(block) {
  try {
    const invComp = block.getComponent("inventory");
    if (invComp && invComp.container) {
      return invComp.container;
    }
  } catch (e) {}
  return null;
}

function getAdjacentChestContainer(dimension, loc) {
  try {
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
      if (block && (block.typeId === "minecraft:chest" || block.typeId === "minecraft:barrel")) {
        const invComp = block.getComponent("inventory");
        if (invComp && invComp.container) {
          return invComp.container;
        }
      }
    }
  } catch (e) {}
  return null;
}

function consumeItemFromContainer(container, itemTypeId, amount = 1) {
  try {
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
  } catch (e) {}
  return false;
}

function addItemToContainer(container, itemTypeId, amount = 1) {
  try {
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
  } catch (e) {
    return false;
  }
}

// ==========================================
// 5. AUTOMAÇÃO DAS TORRES (3D 17x17x17)
// ==========================================
system.runInterval(() => {
  try {
    for (const [key, tower] of activeTowers.entries()) {
      const { type, location, dimension } = tower;
      const block = dimension.getBlock(location);

      if (!block || block.typeId !== type) {
        activeTowers.delete(key);
        continue;
      }

      const selfContainer = getBlockContainer(block);
      if (!selfContainer) continue;

      const radius = 8; // Cubo de 17x17x17

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const targetLoc = { x: location.x + dx, y: location.y + dy, z: location.z + dz };
            const groundBlock = dimension.getBlock(targetLoc);
            const aboveBlock = dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z });

            if (!groundBlock || !aboveBlock) continue;

            // 1. PLANTADOR INDUSTRIAL
            if (type === "meu_addon:industrial_planter") {
              if (groundBlock.typeId === "minecraft:dirt" || groundBlock.typeId === "minecraft:grass_block") {
                const farmland = BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 });
                groundBlock.setPermutation(farmland);
              } else if (groundBlock.typeId === "minecraft:farmland" && aboveBlock.typeId === "minecraft:air") {
                const seeds = ["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"];
                for (const seedId of seeds) {
                  if (consumeItemFromContainer(selfContainer, seedId, 1)) {
                    const cropMap = {
                      "minecraft:wheat_seeds": "minecraft:wheat",
                      "minecraft:carrot": "minecraft:carrots",
                      "minecraft:potato": "minecraft:potatoes",
                      "minecraft:beetroot_seeds": "minecraft:beetroot"
                    };
                    aboveBlock.setType(cropMap[seedId]);
                    break;
                  }
                }
              }
            }

            // 2. FERTILIZADOR INDUSTRIAL
            if (type === "meu_addon:industrial_fertilizer") {
              const crops = ["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"];
              if (crops.includes(aboveBlock.typeId)) {
                if (consumeItemFromContainer(selfContainer, "minecraft:bone_meal", 1)) {
                  try {
                    aboveBlock.setPermutation(aboveBlock.permutation.withState("growth", 7));
                  } catch (e) {}
                }
              }
            }

            // 3. COLHEDOR INDUSTRIAL (Geometria Stonecutter + Roteamento de Itens)
            if (type === "meu_addon:industrial_harvester") {
              let harvestedType = null;
              let seedType = null;
              let dropAmount = 1;

              if (aboveBlock.typeId === "minecraft:wheat") {
                let isMaxGrowth = false;
                try { isMaxGrowth = aboveBlock.permutation.getState("growth") === 7; } catch (e) {}
                if (isMaxGrowth) {
                  harvestedType = "minecraft:wheat";
                  seedType = "minecraft:wheat_seeds";
                }
              } else if (aboveBlock.typeId === "minecraft:carrots") {
                let isMaxGrowth = false;
                try { isMaxGrowth = aboveBlock.permutation.getState("growth") === 7; } catch (e) {}
                if (isMaxGrowth) {
                  harvestedType = "minecraft:carrot";
                  seedType = "minecraft:carrot";
                  dropAmount = 2;
                }
              } else if (aboveBlock.typeId === "minecraft:potatoes") {
                let isMaxGrowth = false;
                try { isMaxGrowth = aboveBlock.permutation.getState("growth") === 7; } catch (e) {}
                if (isMaxGrowth) {
                  harvestedType = "minecraft:potato";
                  seedType = "minecraft:potato";
                  dropAmount = 2;
                }
              }

              if (harvestedType) {
                aboveBlock.setType("minecraft:air");

                // Envia semente para o Plantador vizinho
                let sentSeed = false;
                if (seedType) {
                  const directions = [
                    { x: location.x + 1, y: location.y, z: location.z },
                    { x: location.x - 1, y: location.y, z: location.z },
                    { x: location.x, y: location.y, z: location.z + 1 },
                    { x: location.x, y: location.y, z: location.z - 1 },
                    { x: location.x, y: location.y + 1, z: location.z },
                    { x: location.x, y: location.y - 1, z: location.z }
                  ];

                  for (const dir of directions) {
                    const neighborBlock = dimension.getBlock(dir);
                    if (neighborBlock && neighborBlock.typeId === "meu_addon:industrial_planter") {
                      const planterContainer = getBlockContainer(neighborBlock);
                      if (planterContainer && addItemToContainer(planterContainer, seedType, 1)) {
                        sentSeed = true;
                        break;
                      }
                    }
                  }
                }

                // Envia produto colhido para o Baú externo ou Inventário Próprio
                const externalChest = getAdjacentChestContainer(dimension, location);
                let storedInChest = false;

                if (externalChest) {
                  storedInChest = addItemToContainer(externalChest, harvestedType, dropAmount);
                  if (seedType && !sentSeed) {
                    addItemToContainer(externalChest, seedType, 1);
                  }
                }

                if (!storedInChest) {
                  addItemToContainer(selfContainer, harvestedType, dropAmount);
                  if (seedType && !sentSeed) {
                    addItemToContainer(selfContainer, seedType, 1);
                  }
                }
              }
            }

          }
        }
      }
    }
  } catch (e) {}
}, 20);
