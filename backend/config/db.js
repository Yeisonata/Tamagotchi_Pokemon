const mysql = require('mysql2');
require('dotenv').config();

const connection = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'pokeapi'
});

connection.connect(error => {
    if (error) {
        console.error('Error conectando a MySQL:', error);
        return;
    }
    console.log('📦 Conectado a la base de datos MySQL');
});

module.exports = connection;
