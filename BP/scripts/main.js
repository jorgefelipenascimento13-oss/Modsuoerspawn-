{
  "format_version": "1.20.80",
  "minecraft:item": {
    "description": {
      "identifier": "meu_addon:paxel",
      "menu_category": {
        "category": "equipment",
        "group": "itemGroup.name.equipment"
      }
    },
    "components": {
      "minecraft:icon": "paxel",
      "minecraft:display_name": {
        "value": "Paxel Suprema"
      },
      "minecraft:max_stack_size": 1,
      "minecraft:hand_equipped": true,
      "minecraft:can_destroy_in_creative": false,
      "minecraft:durability": {
        "max_durability": 2031,
        "damage_chance": {
          "min": 0,
          "max": 0
        }
      },
      "minecraft:damage": {
        "value": 12
      },
      "minecraft:digger": {
        "use_efficiency": true,
        "destroy_speeds": [
          {
            "block": { "tags": "stone" },
            "speed": 24
          },
          {
            "block": { "tags": "wood" },
            "speed": 24
          },
          {
            "block": { "tags": "dirt" },
            "speed": 24
          },
          {
            "block": { "tags": "sand" },
            "speed": 24
          },
          {
            "block": { "tags": "gravel" },
            "speed": 24
          },
          {
            "block": { "tags": "metal" },
            "speed": 24
          },
          {
            "block": { "tags": "plant" },
            "speed": 24
          },
          {
            "block": { "tags": "leaves" },
            "speed": 24
          },
          {
            "block": { "tags": "crop" },
            "speed": 24
          }
        ]
      },
      "minecraft:enchantable": {
        "value": 30,
        "slot": "pickaxe"
      }
    }
  }
}
