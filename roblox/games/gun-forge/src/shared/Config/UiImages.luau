-- UI image registry. id = "rbxassetid://0" means NOT uploaded yet: UIKit falls back to the code-drawn look.
-- Generate art: python roblox/tools/mcp/gemini_image/server.py batch roblox/games/gun-forge/art/ui/gemini_spec.json
-- Upload + fill ids: python roblox/tools/upload_assets.py   (see README_TH.md). Keep ONE entry per line; the script rewrites only id.
local I = {}

I.menu_shop = { id = "rbxassetid://0", file = "art/ui/menu_shop.png" }
I.menu_rewards = { id = "rbxassetid://0", file = "art/ui/menu_rewards.png" }
I.menu_quests = { id = "rbxassetid://0", file = "art/ui/menu_quests.png" }
I.menu_games = { id = "rbxassetid://0", file = "art/ui/menu_games.png" }
I.menu_forge = { id = "rbxassetid://0", file = "art/ui/menu_forge.png" }
I.menu_bag = { id = "rbxassetid://0", file = "art/ui/menu_bag.png" }
I.menu_pets = { id = "rbxassetid://0", file = "art/ui/menu_pets.png" }
I.menu_pvp = { id = "rbxassetid://0", file = "art/ui/menu_pvp.png" }
I.menu_rebirth = { id = "rbxassetid://0", file = "art/ui/menu_rebirth.png" }
I.menu_clan = { id = "rbxassetid://0", file = "art/ui/menu_clan.png" }
I.menu_gems = { id = "rbxassetid://0", file = "art/ui/menu_gems.png" }
I.menu_raid = { id = "rbxassetid://0", file = "art/ui/menu_raid.png" }
I.menu_pass = { id = "rbxassetid://0", file = "art/ui/menu_pass.png" }
I.menu_goals = { id = "rbxassetid://0", file = "art/ui/menu_goals.png" }
I.menu_spin = { id = "rbxassetid://0", file = "art/ui/menu_spin.png" }
I.menu_settings = { id = "rbxassetid://0", file = "art/ui/menu_settings.png" }
I.cur_coins = { id = "rbxassetid://0", file = "art/ui/cur_coins.png" }
I.cur_gems = { id = "rbxassetid://0", file = "art/ui/cur_gems.png" }
I.cur_raid = { id = "rbxassetid://0", file = "art/ui/cur_raid.png" }
I.cur_power = { id = "rbxassetid://0", file = "art/ui/cur_power.png" }
I.gun_pistol = { id = "rbxassetid://0", file = "art/ui/gun_pistol.png" }
I.gun_smg = { id = "rbxassetid://0", file = "art/ui/gun_smg.png" }
I.gun_shotgun = { id = "rbxassetid://0", file = "art/ui/gun_shotgun.png" }
I.gun_rifle = { id = "rbxassetid://0", file = "art/ui/gun_rifle.png" }
I.gun_blaster = { id = "rbxassetid://0", file = "art/ui/gun_blaster.png" }
I.gun_railgun = { id = "rbxassetid://0", file = "art/ui/gun_railgun.png" }
I.armor_helmet = { id = "rbxassetid://0", file = "art/ui/armor_helmet.png" }
I.armor_vest = { id = "rbxassetid://0", file = "art/ui/armor_vest.png" }
I.armor_boots = { id = "rbxassetid://0", file = "art/ui/armor_boots.png" }
I.mat_slime_goo = { id = "rbxassetid://0", file = "art/ui/mat_slime_goo.png" }
I.mat_slime_core = { id = "rbxassetid://0", file = "art/ui/mat_slime_core.png" }
I.mat_king_jelly = { id = "rbxassetid://0", file = "art/ui/mat_king_jelly.png" }
I.mat_scrap_metal = { id = "rbxassetid://0", file = "art/ui/mat_scrap_metal.png" }
I.mat_gear_core = { id = "rbxassetid://0", file = "art/ui/mat_gear_core.png" }
I.mat_sand_titan_shard = { id = "rbxassetid://0", file = "art/ui/mat_sand_titan_shard.png" }
I.mat_frost_shard = { id = "rbxassetid://0", file = "art/ui/mat_frost_shard.png" }
I.mat_ice_core = { id = "rbxassetid://0", file = "art/ui/mat_ice_core.png" }
I.mat_yeti_fang = { id = "rbxassetid://0", file = "art/ui/mat_yeti_fang.png" }
I.mat_magma_rock = { id = "rbxassetid://0", file = "art/ui/mat_magma_rock.png" }
I.mat_flame_core = { id = "rbxassetid://0", file = "art/ui/mat_flame_core.png" }
I.mat_forge_heart = { id = "rbxassetid://0", file = "art/ui/mat_forge_heart.png" }
I.mat_void_dust = { id = "rbxassetid://0", file = "art/ui/mat_void_dust.png" }
I.mat_void_core = { id = "rbxassetid://0", file = "art/ui/mat_void_core.png" }
I.mat_void_crown = { id = "rbxassetid://0", file = "art/ui/mat_void_crown.png" }
I.pet_gooey = { id = "rbxassetid://0", file = "art/ui/pet_gooey.png" }
I.pet_pip = { id = "rbxassetid://0", file = "art/ui/pet_pip.png" }
I.pet_bubbles = { id = "rbxassetid://0", file = "art/ui/pet_bubbles.png" }
I.pet_jelly_kid = { id = "rbxassetid://0", file = "art/ui/pet_jelly_kid.png" }
I.pet_bolt = { id = "rbxassetid://0", file = "art/ui/pet_bolt.png" }
I.pet_cogsy = { id = "rbxassetid://0", file = "art/ui/pet_cogsy.png" }
I.pet_dune_fox = { id = "rbxassetid://0", file = "art/ui/pet_dune_fox.png" }
I.pet_titan_cub = { id = "rbxassetid://0", file = "art/ui/pet_titan_cub.png" }
I.pet_frosty = { id = "rbxassetid://0", file = "art/ui/pet_frosty.png" }
I.pet_ice_bun = { id = "rbxassetid://0", file = "art/ui/pet_ice_bun.png" }
I.pet_yeti_pup = { id = "rbxassetid://0", file = "art/ui/pet_yeti_pup.png" }
I.pet_cinder = { id = "rbxassetid://0", file = "art/ui/pet_cinder.png" }
I.pet_lava_lizard = { id = "rbxassetid://0", file = "art/ui/pet_lava_lizard.png" }
I.pet_forge_spirit = { id = "rbxassetid://0", file = "art/ui/pet_forge_spirit.png" }
I.pet_wisp = { id = "rbxassetid://0", file = "art/ui/pet_wisp.png" }
I.pet_glitchy = { id = "rbxassetid://0", file = "art/ui/pet_glitchy.png" }
I.pet_nebula = { id = "rbxassetid://0", file = "art/ui/pet_nebula.png" }
I.pet_void_dragon = { id = "rbxassetid://0", file = "art/ui/pet_void_dragon.png" }
I.card_frame_1 = { id = "rbxassetid://0", file = "art/ui/card_frame_1.png", slice = { 48, 48, 208, 272 } }
I.card_frame_2 = { id = "rbxassetid://0", file = "art/ui/card_frame_2.png", slice = { 48, 48, 208, 272 } }
I.card_frame_3 = { id = "rbxassetid://0", file = "art/ui/card_frame_3.png", slice = { 48, 48, 208, 272 } }
I.card_frame_4 = { id = "rbxassetid://0", file = "art/ui/card_frame_4.png", slice = { 48, 48, 208, 272 } }
I.card_frame_5 = { id = "rbxassetid://0", file = "art/ui/card_frame_5.png", slice = { 48, 48, 208, 272 } }
I.panel_bg = { id = "rbxassetid://0", file = "art/ui/panel_bg.png", slice = { 64, 64, 192, 192 } }
I.btn_green = { id = "rbxassetid://0", file = "art/ui/btn_green.png", slice = { 48, 48, 208, 80 } }
I.btn_gold = { id = "rbxassetid://0", file = "art/ui/btn_gold.png", slice = { 48, 48, 208, 80 } }
I.btn_red = { id = "rbxassetid://0", file = "art/ui/btn_red.png", slice = { 48, 48, 208, 80 } }
I.btn_blue = { id = "rbxassetid://0", file = "art/ui/btn_blue.png", slice = { 48, 48, 208, 80 } }
I.badge_x2 = { id = "rbxassetid://0", file = "art/ui/badge_x2.png" }
I.banner_stage1 = { id = "rbxassetid://0", file = "art/ui/banner_stage1.png" }
I.banner_stage2 = { id = "rbxassetid://0", file = "art/ui/banner_stage2.png" }
I.banner_stage3 = { id = "rbxassetid://0", file = "art/ui/banner_stage3.png" }
I.banner_stage4 = { id = "rbxassetid://0", file = "art/ui/banner_stage4.png" }
I.banner_stage5 = { id = "rbxassetid://0", file = "art/ui/banner_stage5.png" }
I.loading = { id = "rbxassetid://0", file = "art/ui/loading.png" }
I.banner_shop = { id = "rbxassetid://0", file = "art/ui/banner_shop.png" }

return I
