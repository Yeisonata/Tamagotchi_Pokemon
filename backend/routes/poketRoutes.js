const express = require("express");
const axios = require("axios");
const db = require("../config/db");
const fs = require("fs");
const { authenticateToken } = require("./authRoutes"); // ✅ Importar autenticación

const router = express.Router();

// Cargar datos de los JSON
const defaultTypes = JSON.parse(
  fs.readFileSync("./data/default_types.json", "utf8")
);
const defaultLocations = JSON.parse(
  fs.readFileSync("./data/default_locations.json", "utf8")
);

// 🔹 Tabla de experiencia y niveles
const maxLevel = 100;
const maxExp = 1000000;
const expTable = Array.from({ length: maxLevel + 1 }, (_, lvl) =>
  Math.floor((lvl ** 3 * maxExp) / maxLevel ** 3)
);

async function updateLevelAndEvolution(pet_id, expGained) {
  try {
    const [pet] = await db
      .promise()
      .query("SELECT experience, lvl, species_id FROM pet WHERE id = ?", [
        pet_id,
      ]);
    if (pet.length === 0) return;

    let { experience, lvl, species_id } = pet[0];
    experience += expGained;
    let newLevel = lvl;

    while (newLevel < maxLevel && experience >= expTable[newLevel + 1]) {
      newLevel++;
      await checkEvolution(pet_id, species_id, newLevel);
    }

    await db
      .promise()
      .query("UPDATE pet SET lvl = ?, experience = ? WHERE id = ?", [
        newLevel,
        experience,
        pet_id,
      ]);
    console.log(
      `Mascota ${pet_id} ahora tiene nivel ${newLevel} y experiencia ${experience}`
    );
  } catch (error) {
    console.error("Error al actualizar nivel y evolución:", error);
  }
}

async function checkEvolution(pet_id, species_id, newLevel) {
  try {
      console.log(`Comprobando evolución para especie ID ${species_id} en nivel ${newLevel}`);

      // Si es Eevee (ID 133), manejamos la evolución manualmente
      if (species_id === 133) {
          console.log("✨ Eevee ha alcanzado un nivel de evolución. Debes elegir su evolución manualmente.");

          // Obtener las posibles evoluciones de Eevee
          const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${species_id}/`);
          const evolutionChainUrl = speciesResponse.data.evolution_chain.url;
          const evolutionChainId = evolutionChainUrl.split("/").slice(-2, -1)[0];

          const evolutionResponse = await axios.get(`https://pokeapi.co/api/v2/evolution-chain/${evolutionChainId}`);
          const evolutionData = evolutionResponse.data.chain.evolves_to;

          let eeveeEvolutions = evolutionData.map(evo => ({
              id: parseInt(evo.species.url.split("/").slice(-2, -1)[0]),
              name: evo.species.name
          }));

          console.log("📜 Opciones de evolución para Eevee:", eeveeEvolutions);

          return { manual: true, evolutions: eeveeEvolutions };
      }

      // 🔹 Si NO es Eevee, seguimos con la evolución normal
      const speciesResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${species_id}/`);
      const evolutionChainUrl = speciesResponse.data.evolution_chain.url;
      const evolutionChainId = evolutionChainUrl.split("/").slice(-2, -1)[0];

      console.log(`ID de cadena de evolución obtenido: ${evolutionChainId}`);

      const evolutionResponse = await axios.get(`https://pokeapi.co/api/v2/evolution-chain/${evolutionChainId}`);
      const evolutionData = evolutionResponse.data;

      let evolvedSpeciesId = null;
      let evolvedSpeciesName = null;
      let evolvedPokemonData = null;
      let currentStage = evolutionData.chain;

      while (currentStage) {
          if (currentStage.species.url.includes(`/pokemon-species/${species_id}/`)) {
              for (const evolution of currentStage.evolves_to) {
                  if (evolution.evolution_details.some(detail => detail.min_level === newLevel)) {
                      evolvedSpeciesId = parseInt(evolution.species.url.split("/").slice(-2, -1)[0]);
                      evolvedSpeciesName = evolution.species.name;
                      break;
                  }
              }
              break;
          }
          currentStage = currentStage.evolves_to[0];
      }

      if (evolvedSpeciesId) {
          const evolvedResponse = await axios.get(`https://pokeapi.co/api/v2/pokemon/${evolvedSpeciesId}/`);
          evolvedPokemonData = {
              id: evolvedResponse.data.id,
              name: evolvedResponse.data.name,
              types: evolvedResponse.data.types.map(t => t.type.name),
              image: evolvedResponse.data.sprites.front_default
          };

          await db.promise().query("UPDATE pet SET species_id = ? WHERE id = ?", [evolvedSpeciesId, pet_id]);

          console.log(`🎉 ¡Tu Pokémon ha evolucionado! 🎉`);
          console.log(`📌 Nuevo Pokémon: ${evolvedPokemonData.name.toUpperCase()} (ID: ${evolvedPokemonData.id})`);
          console.log(`🔥 Tipos: ${evolvedPokemonData.types.join(", ")}`);
          console.log(`\n🖼️ Imagen: ${evolvedPokemonData.image}`);

          return evolvedPokemonData;
      } else {
          console.log("No se encontró una evolución válida.");
          return null;
      }
  } catch (error) {
      console.error("Error al comprobar evolución:", error);
      return null;
  }
}


// 🔹 Evolucionar un Eevee a una de sus evoluciones (Solo usuarios autenticados)


// 🔹 Interacciones con la mascota
const interactions = {
  feed: { ph: 15, happiness: 10 },
  play: { ph: -10, happiness: 15, experience: 20 },
  rest: { ph: 20, happiness: 5 },
  train: { ph: -15, happiness: -5, experience: 30 },
  heal: { ph: 50, happiness: 10 },
  explore: { ph: -5, happiness: 10, experience: 25 },
};

Object.entries(interactions).forEach(([action, changes]) => {
  router.post(`/${action}/:pet_id`, authenticateToken, async (req, res) => {
    try {
      const { pet_id } = req.params;
      let query = "UPDATE pet SET ";
      let values = [];

      if (changes.ph)
        (query += "ph = LEAST(GREATEST(ph + ?, 0), 100), "),
          values.push(changes.ph);
      if (changes.happiness)
        (query += "happiness = LEAST(GREATEST(happiness + ?, 0), 100), "),
          values.push(changes.happiness);
      if (changes.experience)
        (query += "experience = experience + ?, "),
          values.push(changes.experience);

      query = query.slice(0, -2) + " WHERE id = ?";
      values.push(pet_id);

      await db.promise().query(query, values);
      console.log(`Mascota ${pet_id} ha realizado acción: ${action}`);
      if (changes.experience) {
        await updateLevelAndEvolution(pet_id, changes.experience);
      }
      res.json({
        message: `Tu Pokémon ha sido ${
          action === "heal" ? "curado" : action
        } con éxito`,
      });
    } catch (error) {
      res.status(500).json({ error: `Error al ${action}` });
    }
  });
});

// 🔹 Crear una nueva mascota (Solo usuarios autenticados)
router.post("/create", authenticateToken, (req, res) => {
  const { alias, species } = req.body;
  const user_id = req.user.id;

  if (!alias || !species) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const location = defaultLocations[species] || "POKECENTER";

  db.query(
    "SELECT id FROM species WHERE specie_name = ?",
    [species],
    (err, results) => {
      if (err)
        return res.status(500).json({ error: "Error al buscar la especie" });
      if (results.length === 0)
        return res.status(400).json({ error: "Especie no encontrada" });

      const species_id = results[0].id;

      db.query(
        `INSERT INTO pet (alias, species_id, location, user_id, happiness, ph, experience) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [alias, species_id, location, user_id, 50, 100, 0], // Valores iniciales
        (err, result) => {
          if (err)
            return res.status(500).json({ error: "Error al crear la mascota" });
          res.status(201).json({
            message: "Mascota creada exitosamente",
            petId: result.insertId,
          });
        }
      );
    }
  );
});

// 🔹 Obtener todas las mascotas del usuario autenticado
router.get("/user", authenticateToken, (req, res) => {
  const user_id = req.user.id;

  db.query(
    `SELECT p.id, p.alias, s.specie_name, p.location, p.happiness, p.ph, p.experience 
         FROM pet p
         JOIN species s ON p.species_id = s.id
         WHERE p.user_id = ?`,
    [user_id],
    (err, results) => {
      if (err)
        return res.status(500).json({ error: "Error al obtener las mascotas" });
      if (results.length === 0)
        return res.status(404).json({ error: "No hay mascotas registradas" });

      res.json({ pets: results });
    }
  );
});
// 🔹 Obtener un Pokémon específico de un usuario (Requiere autenticación)
router.get("/:user_id/pets/:pet_id", authenticateToken, (req, res) => {
  const { user_id, pet_id } = req.params;

  // Validar si el usuario autenticado es el dueño o es un ADMIN
  if (req.user.id !== parseInt(user_id) && req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Acceso denegado" });
  }

  db.query(
    `SELECT pet.id, pet.alias, species.specie_name, pet.lvl, pet.experience, pet.happiness, pet.ph 
         FROM pet 
         INNER JOIN species ON pet.species_id = species.id 
         WHERE pet.id = ? AND pet.user_id = ?`,
    [pet_id, user_id],
    (err, results) => {
      if (err)
        return res.status(500).json({ error: "Error al buscar el Pokémon" });

      if (results.length === 0) {
        return res
          .status(404)
          .json({ error: "Pokémon no encontrado para este usuario" });
      }

      res.json(results[0]);
    }
  );
});

module.exports = router;
