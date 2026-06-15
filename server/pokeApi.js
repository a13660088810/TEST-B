const POKE_BASE = "https://pokeapi.co/api/v2";

export const typeLabels = {
  normal: "一般",
  fire: "火",
  water: "水",
  electric: "电",
  grass: "草",
  ice: "冰",
  fighting: "格斗",
  poison: "毒",
  ground: "地面",
  flying: "飞行",
  psychic: "超能力",
  bug: "虫",
  rock: "岩石",
  ghost: "幽灵",
  dragon: "龙",
  dark: "恶",
  steel: "钢",
  fairy: "妖精"
};

const statLabels = {
  hp: "HP",
  attack: "攻击",
  defense: "防御",
  "special-attack": "特攻",
  "special-defense": "特防",
  speed: "速度"
};

const pokemonAliases = {
  皮卡丘: "pikachu",
  喷火龙: "charizard",
  妙蛙花: "venusaur",
  水箭龟: "blastoise",
  耿鬼: "gengar",
  快龙: "dragonite",
  路卡利欧: "lucario",
  烈咬陆鲨: "garchomp",
  暴鲤龙: "gyarados",
  巨沼怪: "swampert",
  巨金怪: "metagross",
  沙奈朵: "gardevoir",
  班基拉斯: "tyranitar",
  伊布: "eevee",
  甲贺忍蛙: "greninja",
  火焰鸡: "blaziken",
  胡地: "alakazam",
  卡比兽: "snorlax"
};

const typeAliases = {
  一般: "normal",
  普通: "normal",
  火: "fire",
  火系: "fire",
  水: "water",
  水系: "water",
  电: "electric",
  电系: "electric",
  草: "grass",
  草系: "grass",
  冰: "ice",
  冰系: "ice",
  格斗: "fighting",
  格斗系: "fighting",
  毒: "poison",
  毒系: "poison",
  地面: "ground",
  地面系: "ground",
  飞行: "flying",
  飞行系: "flying",
  超能力: "psychic",
  虫: "bug",
  虫系: "bug",
  岩石: "rock",
  岩石系: "rock",
  幽灵: "ghost",
  龙: "dragon",
  龙系: "dragon",
  恶: "dark",
  恶系: "dark",
  钢: "steel",
  钢系: "steel",
  妖精: "fairy",
  妖精系: "fairy"
};

const moveAliases = {
  十万伏特: "thunderbolt",
  喷射火焰: "flamethrower",
  水炮: "hydro-pump",
  地震: "earthquake",
  冰冻光束: "ice-beam",
  精神强念: "psychic",
  暗影球: "shadow-ball",
  龙爪: "dragon-claw",
  月亮之力: "moonblast",
  近身战: "close-combat"
};

const teamPresets = {
  balanced: ["charizard", "venusaur", "blastoise", "pikachu", "gengar", "dragonite"],
  anti_fire: ["swampert", "gyarados", "garchomp", "starmie", "tyranitar", "dragonite"],
  anti_water: ["venusaur", "pikachu", "jolteon", "raichu", "ludicolo", "dragonite"],
  anti_rock: ["swampert", "lucario", "venusaur", "scizor", "milotic", "garchomp"],
  anti_dragon: ["gardevoir", "mamoswine", "metagross", "lapras", "clefable", "dragonite"],
  fast_offense: ["greninja", "gengar", "jolteon", "talonflame", "lucario", "garchomp"],
  bulky: ["snorlax", "blastoise", "metagross", "venusaur", "umbreon", "milotic"]
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PokeAPI request failed: ${response.status}`);
  }
  return response.json();
}

function normalizeName(value = "") {
  const raw = String(value).trim();
  return pokemonAliases[raw] || raw.toLowerCase().replace(/\s+/g, "-");
}

function normalizeType(value = "") {
  const raw = String(value).trim().toLowerCase();
  return typeAliases[String(value).trim()] || typeAliases[raw] || raw.replace(/\s+/g, "-");
}

function normalizeMove(value = "") {
  const raw = String(value).trim();
  return moveAliases[raw] || raw.toLowerCase().replace(/\s+/g, "-");
}

function labelType(typeName) {
  return {
    name: typeName,
    label: typeLabels[typeName] || typeName
  };
}

function mapRelations(list = []) {
  return list.map((item) => labelType(item.name));
}

function parseFlavorText(species) {
  const entries = species.flavor_text_entries || [];
  const zh = entries.find((entry) => entry.language?.name === "zh-Hans");
  const en = entries.find((entry) => entry.language?.name === "en");
  return (zh || en)?.flavor_text?.replace(/\s+/g, " ") || "";
}

function parseEvolutionChain(node) {
  if (!node) return [];
  const current = node.species?.name ? [node.species.name] : [];
  return current.concat(...(node.evolves_to || []).map(parseEvolutionChain));
}

async function getSpeciesAndEvolution(nameOrId) {
  try {
    const species = await fetchJson(`${POKE_BASE}/pokemon-species/${encodeURIComponent(nameOrId)}`);
    let evolution = [];

    if (species.evolution_chain?.url) {
      const chain = await fetchJson(species.evolution_chain.url);
      evolution = parseEvolutionChain(chain.chain);
    }

    return { species, evolution };
  } catch {
    return { species: null, evolution: [] };
  }
}

function compactPokemon(pokemon, species = null, evolution = []) {
  const stats = pokemon.stats.map((entry) => ({
    key: entry.stat.name,
    label: statLabels[entry.stat.name] || entry.stat.name,
    value: entry.base_stat
  }));

  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: species?.names?.find((item) => item.language?.name === "zh-Hans")?.name || pokemon.name,
    height: pokemon.height,
    weight: pokemon.weight,
    types: pokemon.types.map((entry) => labelType(entry.type.name)),
    abilities: pokemon.abilities.map((entry) => ({
      name: entry.ability.name,
      hidden: entry.is_hidden
    })),
    stats,
    totalStats: stats.reduce((sum, item) => sum + item.value, 0),
    image:
      pokemon.sprites?.other?.["official-artwork"]?.front_default ||
      pokemon.sprites?.front_default ||
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`,
    sprite: pokemon.sprites?.front_default,
    flavorText: species ? parseFlavorText(species) : "",
    generation: species?.generation?.name,
    habitat: species?.habitat?.name,
    evolution
  };
}

export async function searchPokemon({ name = "", id = "", query = "", limit = 1 } = {}) {
  const target = normalizeName(name || id || query || "pikachu");
  const pokemon = await fetchJson(`${POKE_BASE}/pokemon/${encodeURIComponent(target)}`);
  const { species, evolution } = await getSpeciesAndEvolution(pokemon.id);
  return {
    pokemon: [compactPokemon(pokemon, species, evolution)].slice(0, Number(limit) || 1),
    search: { query: target }
  };
}

export async function getTypeMatchups({ type = "", name = "" } = {}) {
  const target = normalizeType(type || name || "fire");
  const data = await fetchJson(`${POKE_BASE}/type/${encodeURIComponent(target)}`);
  const relations = data.damage_relations || {};

  return {
    matchup: {
      type: labelType(data.name),
      doubleDamageTo: mapRelations(relations.double_damage_to),
      halfDamageTo: mapRelations(relations.half_damage_to),
      noDamageTo: mapRelations(relations.no_damage_to),
      doubleDamageFrom: mapRelations(relations.double_damage_from),
      halfDamageFrom: mapRelations(relations.half_damage_from),
      noDamageFrom: mapRelations(relations.no_damage_from)
    }
  };
}

export async function getMoveDetail({ move = "", name = "" } = {}) {
  const target = normalizeMove(move || name || "thunderbolt");
  const data = await fetchJson(`${POKE_BASE}/move/${encodeURIComponent(target)}`);
  const effect = data.effect_entries?.find((entry) => entry.language?.name === "en")?.short_effect || "";

  return {
    move: {
      id: data.id,
      name: data.name,
      type: labelType(data.type?.name),
      power: data.power,
      accuracy: data.accuracy,
      pp: data.pp,
      priority: data.priority,
      damageClass: data.damage_class?.name,
      effect
    }
  };
}

async function analyzeCoverage(team) {
  const typeNames = [...new Set(team.flatMap((pokemon) => pokemon.types.map((type) => type.name)))];
  const relations = await Promise.all(typeNames.map((type) => getTypeMatchups({ type })));
  const offensive = new Set();
  const weaknessCounts = {};

  relations.forEach(({ matchup }) => {
    matchup.doubleDamageTo.forEach((type) => offensive.add(type.name));
  });

  for (const pokemon of team) {
    for (const type of pokemon.types) {
      const { matchup } = await getTypeMatchups({ type: type.name });
      matchup.doubleDamageFrom.forEach((weak) => {
        weaknessCounts[weak.name] = (weaknessCounts[weak.name] || 0) + 1;
      });
    }
  }

  const majorWeaknesses = Object.entries(weaknessCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ ...labelType(type), count }));

  return {
    offensiveSuperEffectiveTypes: [...offensive].sort().map(labelType),
    majorWeaknesses,
    notes: majorWeaknesses.length
      ? `队伍需要注意 ${majorWeaknesses.slice(0, 3).map((item) => item.label).join("、")} 属性的反制。`
      : "队伍属性分布较均衡。"
  };
}

export async function recommendTeam({ strategy = "", opponent_type = "", preference = "" } = {}) {
  const opponentType = normalizeType(opponent_type);
  const strategyText = `${strategy} ${preference}`.toLowerCase();
  let key = "balanced";

  if (opponentType && teamPresets[`anti_${opponentType}`]) key = `anti_${opponentType}`;
  else if (strategyText.includes("fast") || strategyText.includes("速攻") || strategyText.includes("进攻")) key = "fast_offense";
  else if (strategyText.includes("bulk") || strategyText.includes("耐久") || strategyText.includes("防守")) key = "bulky";

  const team = await Promise.all(teamPresets[key].map((name) => searchPokemon({ name })));
  const pokemon = team.flatMap((item) => item.pokemon);
  const coverage = await analyzeCoverage(pokemon);

  return {
    team: {
      strategy: key,
      opponentType: opponentType ? labelType(opponentType) : null,
      pokemon,
      coverage
    }
  };
}
