import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import api from '../api'; // Importamos la configuración con tu IP
import EmpresaLoader from './EmpresaLoader';

export default function LoginScreen({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      alert('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    try {
      // Mandamos los datos a la ruta de login de tu Django
      const response = await api.post('token/', {
        username: username,
        password: password,
      });

      // Si Django nos devuelve el token, el login es correcto
      if (response.data.access) {
        alert('¡Bienvenido a Quantum Energy!');
        onLoginSuccess(response.data.access); // Le avisamos a la app que ya entramos
      }
    } catch (error) {
      console.log(error);
      alert('Usuario o contraseña incorrectos, o error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo de la empresa */}
      <Image 
        source={require('../assets/logo.png')} 
        style={styles.logoImage} 
        resizeMode="contain"
      />
      
      <Text style={styles.title}>Iniciar Sesión</Text>
      <Text style={styles.subtitle}>Ingresa tus credenciales de Quantum Energy</Text>

      {/* Campo de Usuario */}
      <TextInput 
        style={styles.input}
        placeholder="Nombre de usuario"
        placeholderTextColor="#A0A1A5"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      {/* Campo de Contraseña */}
      <TextInput 
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor="#A0A1A5"
        secureTextEntry={true} // Oculta el texto con puntitos
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />

      {/* Botón de Ingresar con fondo blanco y borde verde */}
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <View style={{ transform: [{ scale: 0.8 }] }}>
            <EmpresaLoader />
          </View>
        ) : (
          <Text style={styles.buttonText}>INGRESAR</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logoImage: {
    width: '100%',
    height: 70,
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2D2E31',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#7A7B80',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#2D2E31',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  button: {
    backgroundColor: '#ffffff', // Fondo blanco limpio
    borderWidth: 2,             // Grosor del borde
    borderColor: '#87C442',     // Borde Verde Quantum
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,               // Sombra ligera para mantener la profundidad
    shadowColor: '#000',        // Sombra para iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  buttonText: {
    color: '#87C442',           // Texto en verde para hacer juego con el borde
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});