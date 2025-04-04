# 🐾 Tamagotchi PokéAPI

Este es un proyecto de un **Tamagotchi basado en la PokéAPI**, donde los usuarios pueden adoptar y cuidar Pokémon como mascotas virtuales. Incluye funcionalidades de evolución, entrenamiento y gestión de cuentas.

## 🚀 Características
- **Autenticación con JWT** (Roles: Admin/User)
- **Gestión de Mascotas** (Crear, eliminar y administrar Pokémon)
- **Sistema de Interacciones** (Alimentar, entrenar, explorar, jugar, curar y dormir)
- **Evolución** (Automática y manual para Eevee)
- **Dashboard de Administración**
- **Base de datos en MySQL**
- **Frontend en React**

## 🛠️ Tecnologías
- **Backend:** Node.js + Express.js
- **Base de datos:** MySQL
- **Frontend:** React.js
- **API:** PokéAPI

## 📦 Instalación
1. Clona el repositorio:
   ```sh
   git clone https://github.com/tu-usuario/tamagotchi-pokeapi.git
   ```
2. Instala las dependencias:
   ```sh
   cd tamagotchi-pokeapi
   npm install
   ```
3. Configura la base de datos en `.env`
4. Inicia el servidor:
   ```sh
   npm start
   ```

## 📌 Endpoints Principales
- `POST /register` → Registro de usuarios
- `POST /login` → Iniciar sesión
- `GET /pets` → Listar mascotas
- `POST /pets` → Crear una mascota
- `POST /evolve_eevee/:petId` → Evolucionar un Eevee manualmente

## ✨ Autor
[Yeison Andrés Tobón Andrades](https://github.com/tu-usuario)

¡Disfruta criando tu Pokémon! 🎮🔥

