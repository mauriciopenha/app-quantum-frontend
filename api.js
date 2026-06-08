import axios from 'axios';

// Tu IP local para conectar el celular con la computadora
const API_URL = 'http://192.168.1.23:8000/api/'; 

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // Elevado a 15 segundos para evitar caídas por latencia local
  headers: {
    'Content-Type': 'application/json',
  }
});

export default api;