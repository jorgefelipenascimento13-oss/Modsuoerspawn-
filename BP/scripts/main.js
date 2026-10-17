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

// VEIN MINE SEGURO
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

// ARADO 3X3 SEGURO
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
      const farmland = BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 });
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
                  targetBlock.setPermutation(farmland);
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
// 2. FUNÇÕES AUXILIARES DE INVENTÁRIO
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

// ==========================================
// 3. AUTOMAÇÃO DAS TORRES (1 SEGUNDO)
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

      const chestContainer = getAdjacentChestContainer(dimension, location);
      if (!chestContainer) continue;

      const radius = 4;
      const baseY = location.y;

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const targetLoc = { x: location.x + dx, y: baseY, z: location.z + dz };
          const groundBlock = dimension.getBlock(targetLoc);
          const aboveBlock = dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z });

          if (!groundBlock || !aboveBlock) continue;

          // 1. PLANTADOR
          if (type === "meu_addon:industrial_planter") {
            if (groundBlock.typeId === "minecraft:dirt" || groundBlock.typeId === "minecraft:grass_block") {
              const farmland = BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 });
              groundBlock.setPermutation(farmland);
            } else if (groundBlock.typeId === "minecraft:farmland" && aboveBlock.typeId === "minecraft:air") {
              const seeds = ["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"];
              for (const seedId of seeds) {
                if (consumeItemFromContainer(chestContainer, seedId, 1)) {
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

          // 2. FERTILIZADOR
          if (type === "meu_addon:industrial_fertilizer") {
            const crops = ["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"];
            if (crops.includes(aboveBlock.typeId)) {
              if (consumeItemFromContainer(chestContainer, "minecraft:bone_meal", 1)) {
                try {
                  aboveBlock.setPermutation(aboveBlock.permutation.withState("growth", 7));
                } catch (e) {}
              }
            } else if (aboveBlock.typeId === "minecraft:sugar_cane") {
              if (consumeItemFromContainer(chestContainer, "minecraft:bone_meal", 1)) {
                let topY = targetLoc.y + 1;
                let height = 0;
                while (dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z })?.typeId === "minecraft:sugar_cane" && height < 3) {
                  topY++;
                  height++;
                }
                if (height < 3 && dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z })?.typeId === "minecraft:air") {
                  dimension.getBlock({ x: targetLoc.x, y: topY, z: targetLoc.z }).setType("minecraft:sugar_cane");
                }
              }
            }
          }

          // 3. COLHEDOR
          if (type === "meu_addon:industrial_harvester") {
            if (aboveBoxTest(aboveBlock)) { // fallback check
              // handled below
            }
            if (aboveBlock.typeId === "minecraft:wheat") {
              let isMaxGrowth = false;
              try {
                isMaxGrowth = aboveBlock.permutation.getState("growth") === 7;
              } catch (e) {}

              if (isMaxGrowth) {
                aboveBlock.setType("minecraft:air");
                addItemToContainer(chestContainer, "minecraft:wheat", 1);
                addItemToContainer(chestContainer, "minecraft:wheat_seeds", 1);
              }
            }
          }

        }
      }
    }
  } catch (e) {}
}, 20);

function aboveBoxTest(block) {
  return block && block.typeId;
}
