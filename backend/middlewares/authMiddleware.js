const jwt = require('jsonwebtoken');
const db = require("../config/db");
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado, token requerido' });
    }

    try {
        const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).json({ error: 'Token inválido' });
    }
};

// Middleware para verificar si es Admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'Admin') {
        return res.status(403).json({ error: 'Acceso solo para administradores' });
    }
    next();
};
// Tiempos de cooldown para cada acción (en ms)
const ACTION_COOLDOWNS = {
  FEED: 5 * 60 * 1000,      // 5 minutos
  PLAY: 4 * 60 * 1000,      // 4 minutos
  TRAIN: 3 * 60 * 1000,     // 3 minutos
  EXPLORE: 2 * 60 * 1000,   // 2 minutos
  HEAL: 1 * 60 * 1000,      // 1 minuto
  SLEEP: 4.5 * 60 * 1000    // 4.5 minutos
};

// Función para verificar cooldown
async function checkCooldown(pet_id, action) {
  const [rows] = await db
    .promise()
    .query(
      `SELECT last_performed FROM action_log 
       WHERE pet_id = ? AND action_type = ?
       ORDER BY last_performed DESC LIMIT 1`,
      [pet_id, action.toUpperCase()]
    );

  if (rows.length === 0) return true;

  const lastActionTime = new Date(rows[0].last_performed).getTime();
  const now = Date.now();
  const cooldown = ACTION_COOLDOWNS[action.toUpperCase()];

  return (now - lastActionTime) >= cooldown;
}



module.exports = { authMiddleware, isAdmin, checkCooldown };
