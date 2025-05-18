const express = require('express');
const db = require('../config/db');
const { authenticateToken } = require('./authRoutes');

const router = express.Router();

// 🔹 Obtener información de un usuario por ID
router.get('/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    // Solo permite que un usuario vea su propia información o que un admin vea todo
    if (req.user.id !== parseInt(id) && req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    db.query('SELECT id, username, email, role FROM user WHERE id = ?', [id], (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en la BD' });

        if (results.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(results[0]);
    });
});

// 🔹 Obtener todos los usuarios (Solo ADMIN)
router.get('/', authenticateToken, (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    db.query('SELECT id, username, email, role FROM user', (err, results) => {
        if (err) return res.status(500).json({ error: 'Error en la BD' });
        res.json(results);
    });
});

// 🔹 Obtener las mascotas de un usuario por su ID
router.get('/user', authenticateToken, (req, res) => {
    const userId = req.user.id; // viene del token

    db.query(
        `SELECT pet.id, pet.alias, species.specie_name, pet.lvl, pet.experience, pet.happiness, pet.ph 
         FROM pet 
         INNER JOIN species ON pet.species_id = species.id 
         WHERE pet.user_id = ?`, 
        [userId], 
        (err, results) => {
            if (err) return res.status(500).json({ error: 'Error al obtener las mascotas' });

            if (results.length === 0) {
                return res.status(404).json({ error: 'No se encontraron mascotas para este usuario' });
            }

            res.json(results);
        }
    );
});


// 🔹 Eliminar una mascota de un usuario


module.exports = router;
