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
// 2. VEIN MINE UNIVERSAL E FORTUNE (Corrigido com Drops)
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

    // Drop com efeito Fortune simulado para minérios quebrados individualmente
    if (ORE_DROPS[blockTypeId]) {
      const dropItem = ORE_DROPS[blockTypeId];
      const bonusAmount = Math.floor(Math.random() * 4) + 3; 
      dimension.spawnItem(new ItemStack(dropItem, bonusAmount), block.location);
    }

    // Se não estiver agachado, não ativa o Vein Mine em cadeia
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
              // Usa comando para destruir e dropar o bloco corretamente em cadeia
              dimension.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`);
            }
            count++;

            // Se for minério no Vein Mine, garante o drop bonus
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
// ARADO 3x3 E DESCASCAR MADEIRA (Corrigido com beforeEvents)
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

    // 1. Descascar Madeira
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

    // 2. Arado 3x3
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
                  targetBlock.setPermutation(BlockPermutation.resolve("minecraft:farmland", { "moisture": 7 }));
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
// 3. AUXILIARES E LÓGICA DAS TORRES INDUSTRIAIS
// ==========================================
function getAdjacentChestContainer(dimension, loc) {
  try {
    // Procura baús ao redor (incluindo em cima e embaixo para suportar pilhas de baús)
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

// Loop principal de execução das Torres
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

      const radius = 6;

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
              let hasCrops = false;

              for (let i = 0; i < machineChest.size; i++) {
                const item = machineChest.getItem(i);
                if (item) {
                  if (item.typeId === "minecraft:cactus") hasCactus = true;
                  if (["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot_seeds"].includes(item.typeId)) hasCrops = true;
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

            // 2. FERTILIZADOR SUPREMO
            if (type === "meu_addon:industrial_fertilizer") {
              const growable = ["minecraft:wheat", "minecraft:carrots", "minecraft:potatoes", "minecraft:beetroot"];

              if (growable.includes(aboveBlock.typeId)) {
                if (consumeItemFromContainer(machineChest, "minecraft:bone_meal", 1)) {
                  try {
                    aboveBlock.setPermutation(aboveBlock.permutation.withState("growth", 7));
                  } catch (e) {}
                }
              }
            }

            // 3. COLHEDOR SUPREMO
            if (type === "meu_asset:industrial_harvester" || type === "meu_addon:industrial_harvester") {
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
