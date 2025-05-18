require("dotenv").config();
const express = require("express");
const cors = require('cors');

const poketRoutes = require("./routes/poketRoutes");
const { router: authRoutes } = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const db = require("./config/db");

const app = express();

// 🛡️ Configura CORS para permitir acceso desde React

const corsOptions = {
  origin: ['http://localhost:3000', 'http://localhost:5173'],  // Permite ambas URLs
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true, // Si estás enviando cookies o tokens
};

app.use(cors(corsOptions));

app.use(express.json());

// 🔹 Enlazamos correctamente las rutas
app.use("/pet", poketRoutes);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("¡Servidor Tamagotchi Pokémon en marcha! 🚀");
});

// Configurar el puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
