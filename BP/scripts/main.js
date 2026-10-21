import { world, system, BlockPermutation, ItemStack, EquipmentSlot } from "@minecraft/server";

// ==========================================
// REGISTRO GLOBAL DE TORRES INDUSTRIAIS
// ==========================================
const activeTowers = new Map();

function registerTower(block, dimension) {
  if (!block || !dimension) return;
  const typeId = block.typeId;
  if (
    typeId === "meu_addon:industrial_planter" ||
    typeId === "meu_addon:industrial_fertilizer" ||
    typeId === "meu_addon:industrial_harvester"
  ) {
    const key = `${block.location.x},${block.location.y},${block.location.z},${dimension.id}`;
    if (!activeTowers.has(key)) {
      activeTowers.set(key, {
        type: typeId,
        location: block.location,
        dimension: dimension
      });
    }
  }
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  try {
    registerTower(event.block, event.dimension);
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

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  try {
    registerTower(event.block, event.player.dimension);
  } catch (e) {}
});

// ==========================================
// 1. GERENCIAMENTO DA PAXEL (Durabilidade Infinita e Encantamentos)
// ==========================================
system.runInterval(() => {
  try {
    for (const player of world.getAllPlayers()) {
      const equippable = player.getComponent("equippable");
      if (!equippable) continue;

      const item = equippable.getEquipment(EquipmentSlot.Mainhand);
      if (item && item.typeId === "meu_addon:paxel") {
        const durabilityComp = item.getComponent("minecraft:durability");
        if (durabilityComp && durabilityComp.damage > 0) {
          durabilityComp.damage = 0;
          equippable.setEquipment(EquipmentSlot.Mainhand, item);
        }

        player.runCommandAsync("enchant @s sharpness 5");
        player.runCommandAsync("enchant @s efficiency 5");
        player.runCommandAsync("enchant @s unbreaking 3");
        player.runCommandAsync("enchant @s mending 1");
      }
    }
  } catch (e) {}
}, 20);

// ==========================================
// 2. VEIN MINE UNIVERSAL (Ativado ao Agachar) E FORTUNE
// ==========================================
const ORE_DROPS = {
  "minecraft:diamond_ore": "minecraft:diamond",
  "minecraft:deepslate_diamond_ore": "minecraft:diamond",
  "minecraft:emerald_ore": "minecraft:emerald",
  "minecraft:deepslate_emerald_ore": "minecraft:emerald",
  "minecraft:coal_ore": "minecraft:coal",
  "minecraft:deepslate_coal_ore": "minecraft:coal",
  "minecraft:nether_quartz_ore": "minecraft:quartz",
  "minecraft:nether_gold_ore": "minecraft:gold_nugget",
  "minecraft:lapis_ore": "minecraft:lapis_lazuli",
  "minecraft:deepslate_lapis_ore": "minecraft:lapis_lazuli",
  "minecraft:redstone_ore": "minecraft:redstone",
  "minecraft:deepslate_redstone_ore": "minecraft:redstone"
};

const STRIPPED_LOGS = {
  "minecraft:oak_log": "minecraft:stripped_oak_log",
  "minecraft:spruce_log": "minecraft:stripped_spruce_log",
  "minecraft:birch_log": "minecraft:stripped_birch_log",
  "minecraft:jungle_log": "minecraft:stripped_jungle_log",
  "minecraft:acacia_log": "minecraft:stripped_acacia_log",
  "minecraft:dark_oak_log": "minecraft:stripped_dark_oak_log",
  "minecraft:mangrove_log": "minecraft:stripped_mangrove_log",
  "minecraft:cherry_log": "minecraft:stripped_cherry_log",
  "minecraft:crimson_stem": "minecraft:stripped_crimson_stem",
  "minecraft:warped_stem": "minecraft:stripped_warped_stem"
};

world.afterEvents.playerBreakBlock.subscribe((event) => {
  try {
    const { player, brokenBlockPermutation, block } = event;
    
    const equippable = player.getComponent("equippable");
    if (!equippable) return;

    const mainHand = equippable.getEquipment(EquipmentSlot.Mainhand);
    if (!mainHand || mainHand.typeId !== "meu_addon:paxel") return;

    const blockTypeId = brokenBlockPermutation.type.id;

    if (ORE_DROPS[blockTypeId]) {
      const dropItem = ORE_DROPS[blockTypeId];
      const bonusAmount = Math.floor(Math.random() * 4) + 3; 
      block.dimension.spawnItem(new ItemStack(dropItem, bonusAmount), block.location);
    }

    if (!player.isSneaking) return;

    const initialLoc = block.location;
    const queue = [initialLoc];
    const visited = new Set();
    const maxBlocks = 256;
    let count = 0;

    system.run(() => {
      try {
        while (queue.length > 0 && count < maxBlocks) {
          const loc = queue.shift();
          const key = `${loc.x},${loc.y},${loc.z}`;

          if (visited.has(key)) continue;
          visited.add(key);

          const targetBlock = player.dimension.getBlock(loc);
          const isStartingBlock = (loc.x === initialLoc.x && loc.y === initialLoc.y && loc.z === initialLoc.z);

          if (isStartingBlock || (targetBlock && targetBlock.typeId === blockTypeId)) {
            if (!isStartingBlock) {
              player.dimension.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`);
            }
            count++;

            if (ORE_DROPS[blockTypeId]) {
              const dropItem = ORE_DROPS[blockTypeId];
              const bonusAmount = Math.floor(Math.random() * 4) + 3;
              player.dimension.spawnItem(new ItemStack(dropItem, bonusAmount), loc);
            }

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

// Interação da Paxel (Arado 3x3 e Descascar Madeira)
world.afterEvents.itemUseOn.subscribe((event) => {
  try {
    const { player, itemStack, block, dimension } = event;
    if (!itemStack || itemStack.typeId !== "meu_addon:paxel") return;

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
      return;
    }

    if (STRIPPED_LOGS[block.typeId]) {
      const strippedId = STRIPPED_LOGS[block.typeId];
      dimension.runCommand(`setblock ${block.location.x} ${block.location.y} ${block.location.z} ${strippedId}`);
    }
  } catch (e) {}
});

// ==========================================
// 3. AUXILIARES DE BAÚ E TORRES INDUSTRIAIS
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

system.runInterval(() => {
  try {
    for (const player of world.getAllPlayers()) {
      const px = Math.floor(player.location.x);
      const py = Math.floor(player.location.y);
      const pz = Math.floor(player.location.z);
      
      for (let x = -6; x <= 6; x++) {
        for (let y = -4; y <= 4; y++) {
          for (let z = -6; z <= 6; z++) {
            const b = player.dimension.getBlock({ x: px + x, y: py + y, z: pz + z });
            if (b) registerTower(b, player.dimension);
          }
        }
      }
    }

    for (const [key, tower] of activeTowers.entries()) {
      const { type, location, dimension } = tower;
      const block = dimension.getBlock(location);

      if (!block || block.typeId !== type) {
        activeTowers.delete(key);
        continue;
      }

      const machineChest = getAdjacentChestContainer(dimension, location);
      if (!machineChest) continue;

      const radius = 8;

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

            // 2. FERTILIZADOR SUPREMO
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
