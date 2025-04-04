const axios = require('axios');

const getPokemonData = async (name) => {
    try {
        const response = await axios.get(`https://pokeapi.co/api/v2/pokemon/${name.toLowerCase()}`);
        return response.data;
    } catch (error) {
        throw new Error('No se pudo obtener la información del Pokémon.');
    }
};

module.exports = { getPokemonData };
