require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Importa solo el router desde authRoutes y las demás rutas correctamente
const poketRoutes = require("./routes/poketRoutes");
const { router: authRoutes } = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const db = require("./config/db");

const app = express();

app.use(express.json());
app.use(cors());

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
