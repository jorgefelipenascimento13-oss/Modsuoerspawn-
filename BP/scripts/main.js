import { world, system, BlockPermutation, ItemStack, EquipmentSlot } from "@minecraft/server";

// Confirmação de carregamento no console do servidor/jogo
console.warn(">>> ADD-ON SUPREMO CARREGADO COM SUCESSO! <<<");

// ==========================================
// REGISTRO E DETECÇÃO DE TORRES INDUSTRIAIS
// ==========================================
const activeTowers = new Map();

function getTowerKey(dimension, loc) {
  return `${loc.x},${loc.y},${loc.z},${dimension.id}`;
}

function scanAndRegisterTowers() {
  try {
    for (const player of world.getAllPlayers()) {
      const dim = player.dimension;
      const px = Math.floor(player.location.x);
      const py = Math.floor(player.location.y);
      const pz = Math.floor(player.location.z);

      for (let x = -12; x <= 12; x++) {
        for (let y = -2; y <= 2; y++) {
          for (let z = -12; z <= 12; z++) {
            const loc = { x: px + x, y: py + y, z: pz + z };
            const block = dim.getBlock(loc);
            if (block) {
              const typeId = block.typeId;
              if (
                typeId === "meu_addon:industrial_planter" ||
                typeId === "meu_addon:industrial_fertilizer" ||
                typeId === "meu_addon:industrial_harvester"
              ) {
                const key = getTowerKey(dim, loc);
                if (!activeTowers.has(key)) {
                  activeTowers.set(key, { type: typeId, location: loc, dimension: dim });
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {}
}

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  try {
    const { block, dimension } = event;
    const typeId = block.typeId;
    if (
      typeId === "meu_addon:industrial_planter" ||
      typeId === "meu_addon:industrial_fertilizer" ||
      typeId === "meu_addon:industrial_harvester"
    ) {
      const key = getTowerKey(dimension, block.location);
      activeTowers.set(key, { type: typeId, location: block.location, dimension: dimension });
    }
  } catch (e) {}
});

world.afterEvents.playerBreakBlock.subscribe((event) => {
  try {
    const { block, dimension } = event;
    const key = getTowerKey(dimension, block.location);
    if (activeTowers.has(key)) {
      activeTowers.delete(key);
    }
  } catch (e) {}
});

// ==========================================
// 1. GERENCIAMENTO DA PAXEL (Durabilidade e Encantamentos)
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
// 2. VEIN MINE UNIVERSAL E FORTUNE (Com Drops Naturais)
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

world.afterEvents.playerBreakBlock.subscribe((event) => {
  try {
    const { player, brokenBlockPermutation, block, dimension } = event;
    const equippable = player.getComponent("equippable");
    if (!equippable) return;

    const mainHand = equippable.getEquipment(EquipmentSlot.Mainhand);
    if (!mainHand || mainHand.typeId !== "meu_addon:paxel") return;

    const blockTypeId = brokenBlockPermutation.type.id;

    if (ORE_DROPS[blockTypeId]) {
      const dropItem = ORE_DROPS[blockTypeId];
      const bonusAmount = Math.floor(Math.random() * 4) + 3; 
      dimension.spawnItem(new ItemStack(dropItem, bonusAmount), block.location);
    }

    if (!player.isSneaking) return;

    const initialLoc = block.location;
    const queue = [initialLoc];
    const visited = new Set();
    const maxBlocks = 128;
    let count = 0;

    system.run(() => {
      try {
        while (queue.length > 0 && count < maxBlocks) {
          const loc = queue.shift();
          const key = `${loc.x},${loc.y},${loc.z}`;

          if (visited.has(key)) continue;
          visited.add(key);

          const targetBlock = dimension.getBlock(loc);
          if (!targetBlock) continue;

          const isStartingBlock = (loc.x === initialLoc.x && loc.y === initialLoc.y && loc.z === initialLoc.z);

          if (isStartingBlock || targetBlock.typeId === blockTypeId) {
            if (!isStartingBlock) {
              // Usa air destroy para forçar a engine a dropar folhas, pedras e itens naturalmente
              dimension.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`);
            }
            count++;

            if (ORE_DROPS[blockTypeId]) {
              const dropItem = ORE_DROPS[blockTypeId];
              const bonusAmount = Math.floor(Math.random() * 4) + 3;
              dimension.spawnItem(new ItemStack(dropItem, bonusAmount), loc);
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

// ==========================================
// ARADO 3x3 E DESCASCAR MADEIRA
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
  "minecraft:warped_stem": "minecraft:stripped_warped_stem",
  "minecraft:oak_wood": "minecraft:stripped_oak_wood",
  "minecraft:spruce_wood": "minecraft:stripped_spruce_wood",
  "minecraft:birch_wood": "minecraft:stripped_birch_wood",
  "minecraft:jungle_wood": "minecraft:stripped_jungle_wood",
  "minecraft:acacia_wood": "minecraft:stripped_acacia_wood",
  "minecraft:dark_oak_wood": "minecraft:stripped_dark_oak_wood",
  "minecraft:mangrove_wood": "minecraft:stripped_mangrove_wood",
  "minecraft:cherry_wood": "minecraft:stripped_cherry_wood"
};

const VALID_SOILS = new Set([
  "minecraft:grass_block",
  "minecraft:dirt",
  "minecraft:dirt_with_roots",
  "minecraft:coarse_dirt"
]);

world.beforeEvents.itemUseOn.subscribe((event) => {
  try {
    const { itemStack, block } = event;
    if (!itemStack || itemStack.typeId !== "meu_addon:paxel") return;
    if (!block) return;

    const dimension = block.dimension;
    const blockTypeId = block.typeId;

    if (STRIPPED_LOGS[blockTypeId]) {
      const strippedId = STRIPPED_LOGS[blockTypeId];
      system.run(() => {
        try {
          const currentBlock = dimension.getBlock(block.location);
          if (currentBlock && currentBlock.typeId === blockTypeId) {
            currentBlock.setType(strippedId);
            dimension.playSound("step.wood", block.location, { volume: 1.0, pitch: 1.0 });
          }
        } catch (e) {}
      });
      return;
    }

    if (VALID_SOILS.has(blockTypeId)) {
      const center = block.location;
      system.run(() => {
        try {
          let convertedAny = false;
          for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
              const targetLoc = { x: center.x + x, y: center.y, z: center.z + z };
              const targetBlock = dimension.getBlock(targetLoc);

              if (targetBlock && VALID_SOILS.has(targetBlock.typeId)) {
                const blockAbove = dimension.getBlock({ x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z });
                if (blockAbove && (blockAbove.typeId === "minecraft:air" || blockAbove.typeId.includes("grass") || blockAbove.typeId.includes("flower"))) {
                  targetBlock.setType("minecraft:farmland");
                  convertedAny = true;
                }
              }
            }
          }
          if (convertedAny) {
            dimension.playSound("use.gravel", block.location, { volume: 1.0, pitch: 0.8 });
          }
        } catch (err) {}
      });
    }
  } catch (e) {}
});

// ==========================================
// 3. TORRES INDUSTRIAIS (Corrigidas e Otimizadas)
// ==========================================
function getAdjacentChestContainer(dimension, loc) {
  try {
    const directions = [
      { x: loc.x + 1, y: loc.y, z: loc.z },
      { x: loc.x - 1, y: loc.y, z: loc.z },
      { x: loc.x, y: loc.y, z: loc.z + 1 },
      { x: loc.x, y: loc.y, z: loc.z - 1 },
      { x: loc.x, y: loc.y + 1, z: loc.z },
      { x: loc.x, y: loc.y, z: loc.z - 1 }
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

const LOGS = new Set([
  "minecraft:oak_log", "minecraft:spruce_log", "minecraft:birch_log",
  "minecraft:jungle_log", "minecraft:acacia_log", "minecraft:dark_oak_log",
  "minecraft:cherry_log", "minecraft:mangrove_log",
  "minecraft:crimson_stem", "minecraft:warped_stem"
]);

// Loop principal de execução das Torres
system.runInterval(() => {
  try {
    scanAndRegisterTowers();

    for (const [key, tower] of activeTowers.entries()) {
      const { type, location, dimension } = tower;
      const block = dimension.getBlock(location);

      if (!block || block.typeId !== type) {
        activeTowers.delete(key);
        continue;
      }

      const machineChest = getAdjacentChestContainer(dimension, location);
      if (!machineChest) continue;

      const horizontalRadius = 10; 
      const groundY = location.y - 1; 

      // 1. PLANTADOR INTELIGENTE (Planta 1 por ciclo)
      if (type === "meu_addon:industrial_planter") {
        let availableSeed = null;
        const seedsList = [
          { seed: "minecraft:wheat_seeds", crop: "minecraft:wheat" },
          { seed: "minecraft:carrot", crop: "minecraft:carrots" },
          { seed: "minecraft:potato", crop: "minecraft:potatoes" },
          { seed: "minecraft:beetroot_seeds", crop: "minecraft:beetroot" }
        ];

        for (let i = 0; i < machineChest.size; i++) {
          const item = machineChest.getItem(i);
          if (item) {
            const found = seedsList.find(s => s.seed === item.typeId);
            if (found) {
              availableSeed = found;
              break;
            }
          }
        }

        if (availableSeed) {
          for (let dx = -horizontalRadius; dx <= horizontalRadius; dx++) {
            for (let dz = -horizontalRadius; dz <= horizontalRadius; dz++) {
              const groundLoc = { x: location.x + dx, y: groundY, z: location.z + dz };
              const groundBlock = dimension.getBlock(groundLoc);
              const aboveBlock = dimension.getBlock({ x: groundLoc.x, y: groundY + 1, z: groundLoc.z });

              if (!groundBlock || !aboveBlock) continue;

              if (groundBlock.typeId !== "minecraft:air" && groundBlock.typeId !== "minecraft:farmland") {
                groundBlock.setType("minecraft:farmland");
                break;
              }

              if (groundBlock.typeId === "minecraft:farmland" && aboveBlock.typeId === "minecraft:air") {
                if (consumeItemFromContainer(machineChest, availableSeed.seed, 1)) {
                  aboveBlock.setType(availableSeed.crop);
                  break; 
                }
              }
            }
          }
        }
      }

      // 2. FERTILIZADOR SUPREMO (Consome 1 Bone Meal para madurar o campo todo)
      if (type === "meu_addon:industrial_fertilizer") {
        const growable = ["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"];
        let hasImmatureCrops = false;
        let cropsToGrow = [];

        for (let dx = -horizontalRadius; dx <= horizontalRadius; dx++) {
          for (let dz = -horizontalRadius; dz <= horizontalRadius; dz++) {
            const groundLoc = { x: location.x + dx, y: groundY, z: location.z + dz };
            const aboveBlock = dimension.getBlock({ x: groundLoc.x, y: groundY + 1, z: groundLoc.z });

            if (aboveBlock && growable.includes(aboveBlock.typeId)) {
              let isMax = false;
              try { 
                const growthVal = aboveBlock.permutation.getState("growth");
                isMax = (growthVal === 7); 
              } catch (e) {}

              if (!isMax) {
                hasImmatureCrops = true;
                cropsToGrow.push(aboveBlock);
              }
            }
          }
        }

        if (hasImmatureCrops && cropsToGrow.length > 0) {
          if (consumeItemFromContainer(machineChest, "minecraft:bone_meal", 1)) {
            for (const cropBlock of cropsToGrow) {
              try {
                cropBlock.setPermutation(cropBlock.permutation.withState("growth", 7));
              } catch (e) {}
            }
          }
        }
      }

      // 3. COLHEDOR SUPREMO (Colhe as maduras da área)
      if (type === "meu_addon:industrial_harvester") {
        for (let dx = -horizontalRadius; dx <= horizontalRadius; dx++) {
          for (let dz = -horizontalRadius; dz <= horizontalRadius; dz++) {
            const groundLoc = { x: location.x + dx, y: groundY, z: location.z + dz };
            const aboveBlock = dimension.getBlock({ x: groundLoc.x, y: groundY + 1, z: groundLoc.z });

            if (!aboveBlock) continue;

            const cropType = aboveBlock.typeId;
            if (["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"].includes(cropType)) {
              let isMax = false;
              try { 
                const growthVal = aboveBlock.permutation.getState("growth");
                isMax = (growthVal === 7); 
              } catch (e) {}

              if (isMax) {
                aboveBlock.setType("minecraft:air");
                if (cropType === "minecraft:wheat") {
                  addItemToContainer(machineChest, "minecraft:wheat", 1);
                  addItemToContainer(machineChest, "minecraft:wheat_seeds", 1);
                } else if (cropType === "minecraft:carrots") {
                  addItemToContainer(machineChest, "minecraft:carrot", 2);
                } else if (cropType === "minecraft:potatoes") {
                  addItemToContainer(machineChest, "minecraft:potato", 2);
                } else if (cropType === "minecraft:beetroot") {
                  addItemToContainer(machineChest, "minecraft:beetroot", 1);
                  addItemToContainer(machineChest, "minecraft:beetroot_seeds", 1);
                }
                break; 
              }
            }

            if (LOGS.has(aboveBlock.typeId)) {
              const logType = aboveBlock.typeId;
              aboveBlock.setType("minecraft:air");
              addItemToContainer(machineChest, logType, 1);
              break;
            }
          }
        }
      }
    }
  } catch (e) {}
}, 20);
