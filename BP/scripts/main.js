import { world, system, BlockPermutation, ItemStack, EquipmentSlot } from "@minecraft/server";

// Mensagem de teste para sabermos se o script carregou no mundo
world.afterEvents.worldInitialize.subscribe(() => {
  console.warn(">>> ADD-ON SUPREMO CARREGADO COM SUCESSO! <<<");
});

// ==========================================
// REGISTRO DE TORRES INDUSTRIAIS
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
  try { registerTower(event.block, event.dimension); } catch (e) {}
});

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  try { registerTower(event.block, event.player.dimension); } catch (e) {}
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  try {
    const { block, dimension } = event;
    const key = `${block.location.x},${block.location.y},${block.location.z},${dimension.id}`;
    activeTowers.delete(key);
  } catch (e) {}
});

// ==========================================
// 1. GERENCIAMENTO DA PAXEL
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
// 2. ARADO 3x3 E DESCASCAR MADEIRA
// ==========================================
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

world.afterEvents.itemUseOn.subscribe((event) => {
  try {
    const { itemStack, block } = event;
    if (!itemStack || itemStack.typeId !== "meu_addon:paxel") return;
    if (!block) return;

    const dimension = block.dimension;
    const validSoil = new Set([
      "minecraft:grass_block",
      "minecraft:dirt",
      "minecraft:dirt_with_roots",
      "minecraft:coarse_dirt"
    ]);

    // Arado 3x3
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
                  targetBlock.setPermutation(BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 }));
                }
              }
            }
          }
        } catch (err) {}
      });
      return;
    }

    // Descascar Madeira
    if (STRIPPED_LOGS[block.typeId]) {
      const strippedId = STRIPPED_LOGS[block.typeId];
      system.run(() => {
        try {
          block.setType(strippedId);
        } catch (err) {}
      });
    }
  } catch (e) {}
});

// ==========================================
// 3. AUXILIARES E LÓGICA DAS TORRES
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

            if (type === "meu_addon:industrial_planter") {
              let hasCactus = false;
              let hasSapling = false;
              let hasCrops = false;
              let hasReeds = false;
              let hasBamboo = false;

              for (let i = 0; i < machineChest.size; i++) {
                const item = machineChest.getItem(i);
                if (item) {
                  if (item.typeId === "minecraft:cactus") hasCactus = true;
                  if (SAPLINGS[item.typeId]) hasSapling = true;
                  if (["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"].includes(item.typeId)) hasCrops = true;
                  if (item.typeId === "minecraft:reeds") hasReeds = true;
                  if (item.typeId === "minecraft:bamboo") hasBamboo = true;
                }
              }

              if (hasCactus && aboveBlock.typeId === "minecraft:air") {
                if (groundBlock.typeId !== "minecraft:sand") groundBlock.setType("minecraft:sand");
                if (consumeItemFromContainer(machineChest, "minecraft:cactus", 1)) {
                  aboveBlock.setType("minecraft:cactus");
                  continue;
                }
              }

              if (hasCrops && aboveBlock.typeId === "minecraft:air") {
                if (groundBlock.typeId !== "minecraft:farmland") {
                  groundBlock.setPermutation(BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 }));
                }
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
                continue;
              }
            }

            if (type === "meu_addon:industrial_fertilizer") {
              const isSapling = Object.keys(SAPLINGS).includes(aboveBlock.typeId);
              const growable = ["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"];

              if (growable.includes(aboveBlock.typeId) || isSapling) {
                if (consumeItemFromContainer(machineChest, "minecraft:bone_meal", 1)) {
                  try {
                    if (isSapling) {
                      dimension.runCommand(`place feature minecraft:oak_tree ${targetLoc.x} ${targetLoc.y + 1} ${targetLoc.z}`);
                      aboveBlock.setType("minecraft:air");
                    } else {
                      aboveBlock.setPermutation(aboveBlock.permutation.withState("growth", 7));
                    }
                  } catch (e) {}
                }
              }
            }

            if (type === "meu_addon:industrial_harvester") {
              if (aboveBlock.typeId === "minecraft:wheat") {
                let isMax = false;
                try { isMax = aboveBlock.permutation.getState("growth") === 7; } catch (e) {}
                if (isMax) {
                  aboveBlock.setType("minecraft:air");
                  addItemToContainer(machineChest, "minecraft:wheat", 1);
                  addItemToContainer(machineChest, "minecraft:wheat_seeds", 1);
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
