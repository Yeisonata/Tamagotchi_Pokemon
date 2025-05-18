const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro';

// 🔹 Registro de usuario
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const role = req.body.role || 'USER'; // USER por defecto

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            'INSERT INTO user (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, role],
            (err, result) => {
                if (err) return res.status(500).json({ error: 'Error al registrar usuario' });
                res.status(201).json({ message: 'Usuario registrado correctamente' });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});
router.post('/login', (req, res) => {
    const { username, email, password } = req.body;
  
    // Verifica si se envió el email o el username
    const query = email ? 'SELECT * FROM user WHERE email = ?' : 'SELECT * FROM user WHERE username = ?';
    const value = email || username;
  
    db.query(query, [value], async (err, results) => {
      if (err) return res.status(500).json({ error: 'Error en la BD' });
  
      if (results.length === 0) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }
  
      const user = results[0];
  
      // Comparar la contraseña
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
      }
  
      // Generar JWT
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );
  
      res.json({ 
        message: 'Inicio de sesión exitoso', 
        token, 
        role: user.role // 👈 Agrega esto
      });
    });
  });
  

// 🔹 Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization');

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado' });
    }

    jwt.verify(token.split(' ')[1], JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

// 🔹 Ruta protegida para obtener el perfil del usuario
router.get('/profile', authenticateToken, (req, res) => {
    res.json({ message: 'Perfil de usuario', user: req.user });
});

// 🔹 Cambiar rol de usuario (Solo Admin puede cambiar roles)
router.put('/user/:id/role', authenticateToken, (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permisos para cambiar roles' });
    }

    const { id } = req.params;
    const { role } = req.body;

    db.query('UPDATE user SET role = ? WHERE id = ?', [role, id], (err, result) => {
        if (err) return res.status(500).json({ error: 'Error al actualizar el rol' });
        res.json({ message: 'Rol actualizado correctamente' });
    });
});

// 🔹 Restablecer contraseña (Admin puede restablecer cualquier contraseña)
router.put('/user/:id/password', authenticateToken, async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'No tienes permisos para restablecer contraseñas' });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.query('UPDATE user SET password = ? WHERE id = ?', [hashedPassword, id], (err, result) => {
            if (err) return res.status(500).json({ error: 'Error al actualizar la contraseña' });
            res.json({ message: 'Contraseña actualizada correctamente' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

module.exports = { router, authenticateToken };