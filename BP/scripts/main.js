import { world, system, BlockPermutation, ItemStack } from "@minecraft/server";

// ==========================================
// REGISTRO GLOBAL DE TORRES INDUSTRIAIS
// ==========================================
const activeTowers = new Map();

// Rastreamento correto de colocação de blocos customizados via itemUseOn
world.afterEvents.itemUseOn.subscribe((event) => {
  try {
    const { itemStack, block, blockFace, dimension } = event;
    if (!itemStack) return;

    const typeId = itemStack.typeId;
    if (
      typeId === "meu_addon:industrial_planter" ||
      typeId === "meu_addon:industrial_fertilizer" ||
      typeId === "meu_addon:industrial_harvester"
    ) {
      const offsets = {
        "Up": { x: 0, y: 1, z: 0 },
        "Down": { x: 0, y: -1, z: 0 },
        "North": { x: 0, y: 0, z: -1 },
        "South": { x: 0, y: 0, z: 1 },
        "East": { x: 1, y: 0, z: 0 },
        "West": { x: -1, y: 0, z: 0 }
      };
      const off = offsets[blockFace] || { x: 0, y: 0, z: 0 };
      const targetLoc = {
        x: block.location.x + off.x,
        y: block.location.y + off.y,
        z: block.location.z + off.z
      };
      const key = `${targetLoc.x},${targetLoc.y},${targetLoc.z},${dimension.id}`;
      activeTowers.set(key, {
        type: typeId,
        location: targetLoc,
        dimension: dimension
      });
    }

    // ARADO 3X3 (Interação da Paxel com o solo)
    if (itemStack.typeId === "meu_addon:paxel") {
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
                const targetBlock = dimension.getBlock(exactLoc);

                if (targetBlock && validSoil.has(targetBlock.typeId)) {
                  const blockAbove = dimension.getBlock({ x: exactLoc.x, y: exactLoc.y + 1, z: exactLoc.z });
                  if (blockAbove && blockAbove.typeId === "minecraft:air") {
                    dimension.runCommand(`setblock ${exactLoc.x} ${exactLoc.y} ${exactLoc.z} farmland`);
                  }
                }
              }
            }
          } catch (err) {}
        });
      }
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
// 1. GERENCIAMENTO DA PAXEL (Durabilidade e Encantamentos com Namespace)
// ==========================================
system.runInterval(() => {
  try {
    for (const player of world.getAllPlayers()) {
      const inventory = player.getComponent("inventory");
      if (!inventory || !inventory.container) continue;

      const slotIndex = player.selectedSlotIndex;
      const item = inventory.container.getItem(slotIndex);

      if (item && item.typeId === "meu_addon:paxel") {
        const durabilityComp = item.getComponent("minecraft:durability");
        if (durabilityComp && durabilityComp.damage > 0) {
          durabilityComp.damage = 0;
          inventory.container.setItem(slotIndex, item);
        }

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

world.afterEvents.entityHurt.subscribe((event) => {
  try {
    const damageSource = event.damageSource;
    if (damageSource && damageSource.damagingEntity && damageSource.damagingEntity.typeId === "minecraft:player") {
      const player = damageSource.damagingEntity;
      const inventory = player.getComponent("inventory");
      if (!inventory || !inventory.container) return;

      const slotIndex = player.selectedSlotIndex;
      const item = inventory.container.getItem(slotIndex);

      if (item && item.typeId === "meu_addon:paxel") {
        const durabilityComp = item.getComponent("minecraft:durability");
        if (durabilityComp) {
          durabilityComp.damage = 0;
          inventory.container.setItem(slotIndex, item);
        }
      }
    }
  } catch (e) {}
});

// ==========================================
// 2. VEIN MINE
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
  "minecraft:mangrove_log", "minecraft:cherry_log",
  "minecraft:crimson_stem", "minecraft:warped_stem"
]);

world.afterEvents.playerBreakBlock.subscribe((event) => {
  try {
    const { player, brokenBlockPermutation, block } = event;
    
    const inventory = player.getComponent("inventory");
    if (!inventory || !inventory.container) return;

    const mainHand = inventory.container.getItem(player.selectedSlotIndex);
    if (!mainHand || mainHand.typeId !== "meu_addon:paxel") return;

    const durabilityComp = mainHand.getComponent("minecraft:durability");
    if (durabilityComp) {
      durabilityComp.damage = 0;
      inventory.container.setItem(player.selectedSlotIndex, mainHand);
    }

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
// 3. AUXILIARES DE BAÚ
// ==========================================
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

const SAPLINGS = {
  "minecraft:oak_sapling": "minecraft:oak_log",
  "minecraft:spruce_sapling": "minecraft:spruce_log",
  "minecraft:birch_sapling": "minecraft:birch_log",
  "minecraft:jungle_sapling": "minecraft:jungle_log",
  "minecraft:acacia_sapling": "minecraft:acacia_log",
  "minecraft:dark_oak_sapling": "minecraft:dark_oak_log",
  "minecraft:cherry_sapling": "minecraft:cherry_log",
  "minecraft:crimson_fungus": "minecraft:crimson_stem",
  "minecraft:warped_fungus": "minecraft:warped_stem"
};

const LOGS = new Set([
  "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log",
  "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log",
  "minecraft:cherry_log", "minecraft:mangrove_log",
  "minecraft:crimson_stem", "minecraft:warped_stem"
]);

// ==========================================
// 4. AUTOMAÇÃO DE TORRES (CUBO 17x17x17)
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

      const machineChest = getAdjacentChestContainer(dimension, location);
      if (!machineChest) continue;

      const radius = 8; // Cubo 3D de 17x17x17

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const targetLoc = { x: location.x + dx, y: location.y + dy, z: location.z + dz };
            const groundBlock = dimension.getBlock(targetLoc);
            const aboveBlock = dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z });

            if (!groundBlock || !aboveBlock) continue;

            // 1. PLANTADOR INTELIGENTE
            if (type === "meu_addon:industrial_planter") {
              let hasCactus = false;
              let hasSaplingOrFungus = false;
              let hasCrops = false;

              for (let i = 0; i < machineChest.size; i++) {
                const itemInChest = machineChest.getItem(i);
                if (itemInChest) {
                  if (itemInChest.typeId === "minecraft:cactus") hasCactus = true;
                  if (SAPLINGS[itemInChest.typeId]) hasSaplingOrFungus = true;
                  if (["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"].includes(itemInChest.typeId)) hasCrops = true;
                }
              }

              if (hasCactus && (groundBlock.typeId === "minecraft:dirt" || groundBlock.typeId === "minecraft:grass_block")) {
                groundBlock.setType("minecraft:sand");
              }
              if (groundBlock.typeId === "minecraft:sand" && aboveBlock.typeId === "minecraft:air") {
                if (consumeItemFromContainer(machineChest, "minecraft:cactus", 1)) {
                  aboveBlock.setType("minecraft:cactus");
                }
              }

              if (hasSaplingOrFungus && (groundBlock.typeId === "minecraft:dirt" || groundBlock.typeId === "minecraft:grass_block" || groundBlock.typeId === "minecraft:crimson_nylium" || groundBlock.typeId === "minecraft:warped_nylium")) {
                if (aboveBlock.typeId === "minecraft:air") {
                  for (const saplingId of Object.keys(SAPLINGS)) {
                    if (consumeItemFromContainer(machineChest, saplingId, 1)) {
                      aboveBlock.setType(saplingId);
                      break;
                    }
                  }
                }
              }

              if (hasCrops) {
                if (groundBlock.typeId === "minecraft:dirt" || groundBlock.typeId === "minecraft:grass_block") {
                  const farmland = BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 });
                  groundBlock.setPermutation(farmland);
                } else if (groundBlock.typeId === "minecraft:farmland" && aboveBlock.typeId === "minecraft:air") {
                  const seeds = ["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"];
                  for (const seedId of seeds) {
                    if (consumeItemFromContainer(machineChest, seedId, 1)) {
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

              if (aboveBlock.typeId === "minecraft:air") {
                if ((groundBlock.typeId === "minecraft:sand" || groundBlock.typeId === "minecraft:dirt" || groundBlock.typeId === "minecraft:grass_block") && consumeItemFromContainer(machineChest, "minecraft:reeds", 1)) {
                  aboveBlock.setType("minecraft:reeds");
                } else if ((groundBlock.typeId === "minecraft:sand" || groundBlock.typeId === "minecraft:dirt" || groundBlock.typeId === "minecraft:grass_block") && consumeItemFromContainer(machineChest, "minecraft:bamboo", 1)) {
                  aboveBlock.setType("minecraft:bamboo");
                }
              }
            }

            // 2. FERTILIZADOR SUPREMO (Com comando corrigido 'place feature')
            if (type === "meu_addon:industrial_fertilizer") {
              const isSapling = Object.keys(SAPLINGS).includes(aboveBlock.typeId);
              const isCactusOrReed = aboveBlock.typeId === "minecraft:cactus" || aboveBlock.typeId === "minecraft:reeds" || aboveBlock.typeId === "minecraft:bamboo";
              const growable = ["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"];

              if (growable.includes(aboveBlock.typeId) || isSapling || isCactusOrReed) {
                if (consumeItemFromContainer(machineChest, "minecraft:bone_meal", 1)) {
                  try {
                    if (isSapling) {
                      dimension.runCommand(`place feature minecraft:oak_tree ${targetLoc.x} ${targetLoc.y + 1} ${targetLoc.z}`);
                      aboveBlock.setType("minecraft:air");
                    } else if (isCactusOrReed) {
                      const blockAbove1 = dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z });
                      const blockAbove2 = dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 2, z: targetLoc.z });
                      
                      if (blockAbove1 && blockAbove1.typeId === "minecraft:air") {
                        blockAbove1.setType(aboveBlock.typeId);
                      } else if (blockAbove2 && blockAbove2.typeId === "minecraft:air") {
                        blockAbove2.setType(aboveBlock.typeId);
                      }
                    } else {
                      aboveBlock.setPermutation(aboveBlock.permutation.withState("growth", 7));
                    }
                  } catch (e) {}
                }
              }
            }

            // 3. COLHEDOR SUPREMO
            if (type === "meu_addon:industrial_harvester") {
              if (aboveBlock.typeId === "minecraft:wheat") {
                let isMax = false;
                try { isMax = aboveBlock.permutation.getState("growth") === 7; } catch (e) {}
                if (isMax) {
                  aboveBlock.setType("minecraft:air");
                  addItemToContainer(machineChest, "minecraft:wheat", 1);
                  addItemToContainer(machineChest, "minecraft:wheat_seeds", 1);
                }
              } else if (aboveBlock.typeId === "minecraft:carrots") {
                let isMax = false;
                try { isMax = aboveBlock.permutation.getState("growth") === 7; } catch (e) {}
                if (isMax) {
                  aboveBlock.setType("minecraft:air");
                  addItemToContainer(machineChest, "minecraft:carrot", 2);
                }
              } else if (aboveBlock.typeId === "minecraft:potatoes") {
                let isMax = false;
                try { isMax = aboveBlock.permutation.getState("growth") === 7; } catch (e) {}
                if (isMax) {
                  aboveBlock.setType("minecraft:air");
                  addItemToContainer(machineChest, "minecraft:potato", 2);
                }
              }

              if (aboveBlock.typeId === "minecraft:reeds" || aboveBlock.typeId === "minecraft:bamboo" || aboveBlock.typeId === "minecraft:cactus") {
                const blockAbove2 = dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 2, z: targetLoc.z });
                
                let itemType = "minecraft:sugar_cane";
                if (aboveBlock.typeId === "minecraft:bamboo") itemType = "minecraft:bamboo";
                if (aboveBlock.typeId === "minecraft:cactus") itemType = "minecraft:cactus";

                if (blockAbove2 && blockAbove2.typeId === aboveBlock.typeId) {
                  blockAbove2.setType("minecraft:air");
                  addItemToContainer(machineChest, itemType, 1);
                }
              }

              if (LOGS.has(aboveBlock.typeId)) {
                const logType = aboveBlock.typeId;
                aboveBlock.setType("minecraft:air");
                addItemToContainer(machineChest, logType, 1);
              }
            }

          }
        }
      }
    }
  } catch (e) {}
}, 20);
