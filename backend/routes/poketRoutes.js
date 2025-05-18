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
    const [petRows] = await db
      .promise()
      .query("SELECT experience, lvl, species_id FROM pet WHERE id = ?", [
        pet_id,
      ]);

    if (petRows.length === 0) return;

    let { experience, lvl, species_id } = petRows[0];
    experience += expGained;
    let newLevel = lvl;
    let evolved = false;

    while (newLevel < maxLevel && experience >= expTable[newLevel + 1]) {
      newLevel++;
      const didEvolve = await checkEvolution(pet_id, species_id, newLevel);
      if (didEvolve) evolved = true;
    }

    await db
      .promise()
      .query("UPDATE pet SET lvl = ?, experience = ? WHERE id = ?", [
        newLevel,
        experience,
        pet_id,
      ]);

    console.log(
      `Mascota ${pet_id} ahora tiene nivel ${newLevel}, experiencia ${experience}${
        evolved ? " y ha evolucionado" : ""
      }`
    );
  } catch (error) {
    console.error("Error al actualizar nivel y evolución:", error);
  }
}

async function checkEvolution(pet_id, species_id, newLevel) {
  try {
    console.log(
      `Comprobando evolución para especie ID ${species_id} en nivel ${newLevel}`
    );

    // Si es Eevee (ID 133), manejamos la evolución manualmente
    if (species_id === 133) {
      console.log(
        "✨ Eevee ha alcanzado un nivel de evolución. Debes elegir su evolución manualmente."
      );

      // Lista fija de evoluciones válidas de Eevee
      const eeveeVariants = [
        "Vaporeon",
        "Jolteon",
        "Flareon",
        "Espeon",
        "Umbreon",
        "Leafeon",
        "Glaceon",
        "Sylveon",
      ];

      // Obtener todas las especies para buscar los IDs
      const [rows] = await db
        .promise()
        .query(
          "SELECT id, species_name FROM species WHERE species_name IN (?)",
          [eeveeVariants]
        );

      // Mapear resultado a objetos { id, name }
      const eeveeEvolutions = rows.map((row) => ({
        id: row.id,
        name: row.species_name,
      }));

      console.log("📜 Opciones de evolución para Eevee:", eeveeEvolutions);

      return { manual: true, evolutions: eeveeEvolutions };
    }

    // 🔹 Si NO es Eevee, seguimos con la evolución normal
    const speciesResponse = await axios.get(
      `https://pokeapi.co/api/v2/pokemon-species/${species_id}/`
    );
    const evolutionChainUrl = speciesResponse.data.evolution_chain.url;
    const evolutionChainId = evolutionChainUrl.split("/").slice(-2, -1)[0];

    console.log(`ID de cadena de evolución obtenido: ${evolutionChainId}`);

    const evolutionResponse = await axios.get(
      `https://pokeapi.co/api/v2/evolution-chain/${evolutionChainId}`
    );
    const evolutionData = evolutionResponse.data;

    let evolvedSpeciesId = null;
    let evolvedSpeciesName = null;
    let evolvedPokemonData = null;
    let currentStage = evolutionData.chain;

    while (currentStage) {
      if (
        currentStage.species.url.includes(`/pokemon-species/${species_id}/`)
      ) {
        for (const evolution of currentStage.evolves_to) {
          if (
            evolution.evolution_details.some(
              (detail) => detail.min_level === newLevel
            )
          ) {
            evolvedSpeciesId = parseInt(
              evolution.species.url.split("/").slice(-2, -1)[0]
            );
            evolvedSpeciesName = evolution.species.name;
            break;
          }
        }
        break;
      }
      currentStage = currentStage.evolves_to[0];
    }

    if (evolvedSpeciesId) {
      const evolvedResponse = await axios.get(
        `https://pokeapi.co/api/v2/pokemon/${evolvedSpeciesId}/`
      );
      evolvedPokemonData = {
        id: evolvedResponse.data.id,
        name: evolvedResponse.data.name,
        types: evolvedResponse.data.types.map((t) => t.type.name),
        image: evolvedResponse.data.sprites.front_default,
      };

      await db
        .promise()
        .query("UPDATE pet SET species_id = ? WHERE id = ?", [
          evolvedSpeciesId,
          pet_id,
        ]);

      console.log(`🎉 ¡Tu Pokémon ha evolucionado! 🎉`);
      console.log(
        `📌 Nuevo Pokémon: ${evolvedPokemonData.name.toUpperCase()} (ID: ${
          evolvedPokemonData.id
        })`
      );
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
  sleep: { ph: 30, happiness: -5 }
};

// 🔹 Interactuar con una mascota (Solo usuarios autenticados
Object.entries(interactions).forEach(([action, changes]) => {
  router.post(`/${action}/:pet_id`, authenticateToken, async (req, res) => {
    try {
      const { pet_id } = req.params;
      let query = "UPDATE pet SET ";
      let values = [];

      if (changes.ph !== undefined) {
        query += "ph = LEAST(GREATEST(ph + ?, 0), 100), ";
        values.push(changes.ph);
      }

      if (changes.happiness !== undefined) {
        query += "happiness = LEAST(GREATEST(happiness + ?, 0), 100), ";
        values.push(changes.happiness);
      }

      if (changes.experience !== undefined) {
        query += "experience = experience + ?, ";
        values.push(changes.experience);
      }

      // ✅ Elimina coma final de forma segura
      query = query.replace(/, $/, '') + " WHERE id = ?";
      values.push(pet_id);

      // ✅ Ejecutar UPDATE
      await db.promise().query(query, values);
      console.log(`Mascota ${pet_id} ha realizado acción: ${action}`);

      // ✅ Verifica evolución y nivel si aplica
      if (changes.experience) {
        await updateLevelAndEvolution(pet_id, changes.experience);
      }

      // ✅ Obtener datos actualizados
      const [updatedRows] = await db
        .promise()
        .query(
          `SELECT 
            pet.*, 
            species.specie_name AS specie_name 
           FROM 
            pet 
           JOIN 
            species ON pet.species_id = species.id 
           WHERE 
            pet.id = ?`,
          [pet_id]
        );

      if (updatedRows.length === 0) {
        return res.status(404).json({ error: "Mascota no encontrada" });
      }

      const updatedPet = updatedRows[0];

      // ✅ Obtener tipos desde la PokéAPI usando el nombre de la especie
      const pokeResponse = await axios.get(
        `https://pokeapi.co/api/v2/pokemon/${updatedPet.specie_name.toLowerCase()}`
      );

      const types = pokeResponse.data.types.map((t) => t.type.name);

      // ✅ Devolver mascota con tipos
      res.json({ ...updatedPet, types });

    } catch (error) {
      console.error(`Error en acción ${action}:`, error);
      res.status(500).json({ error: `Error al procesar ${action}` });
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

// 🔹 Eliminar una mascota (Solo usuarios autenticados
router.delete("/delete/:pet_id", authenticateToken, (req, res) => {
  const pet_id = req.params.pet_id;
  const user_id = req.user.id;

  db.query(
    "DELETE FROM pet WHERE id = ? AND user_id = ?",
    [pet_id, user_id],
    (err, result) => {
      if (err)
        return res.status(500).json({ error: "Error al eliminar la mascota" });
      if (result.affectedRows === 0)
        return res.status(404).json({ error: "Mascota no encontrada" });

      res.json({ message: "Mascota eliminada exitosamente" });
    }
  );
});

// 🔹 Obtener todas las mascotas del usuario autenticado
router.get("/user", authenticateToken, (req, res) => {
 
  const user_id = req.user.id;

  db.query(
    `SELECT p.id,
            p.alias,
            s.specie_name,
            p.location,
            p.happiness,
            p.ph,
            p.experience,
            p.lvl
     FROM pet p
     JOIN species s ON p.species_id = s.id
     WHERE p.user_id = ?`,
    [user_id],
    (err, results) => {
      if (err) {
        console.error("Error en la consulta SQL:", err); // <--- Agrega esto para debug
        return res.status(500).json({ error: "Error al obtener las mascotas" });
      }
      if (results.length === 0)
        return res.status(404).json({ error: "No hay mascotas registradas" });

      res.json({ pets: results });
    }
  );
});

// 🔹 Obtener un Pokémon específico de un usuario (Requiere autenticación)
 router.get("/user/:pet_id", authenticateToken, async (req, res) => {
  const user_id = req.user.id;
  const pet_id = req.params.pet_id;

  try {
    const [results] = await db
      .promise()
      .query(
        `SELECT p.id, p.alias, s.specie_name, p.location, p.happiness, p.ph, p.experience, p.lvl         
         FROM pet p
         JOIN species s ON p.species_id = s.id
         WHERE p.user_id = ? AND p.id = ?`,
        [user_id, pet_id]
      );

    if (results.length === 0) {
      return res.status(404).json({ error: "Mascota no encontrada" });
    }

    const pet = results[0];
    const speciesName = pet.specie_name.toLowerCase();

    try {
      const pokeApiResponse = await axios.get(
        `https://pokeapi.co/api/v2/pokemon/${speciesName}`
      );
      const types = pokeApiResponse.data.types.map((t) => t.type.name);
      pet.types = types;
    } catch (error) {
      console.error("Error al obtener tipos desde PokéAPI:", error);
      pet.types = []; // Puedes enviar un array vacío o no enviar nada
    }

    res.json({ pet });
  } catch (err) {
    console.error("Error al obtener la mascota:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}); 

module.exports = router;
