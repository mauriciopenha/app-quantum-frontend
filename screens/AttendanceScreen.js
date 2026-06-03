import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Location from 'expo-location'; // Importamos el GPS
import api from '../api'; // Tu conexión con el backend
import EmpresaLoader from './EmpresaLoader';

export default function AttendanceScreen({ token, onBack }) {
  const [loading, setLoading] = useState(false);
  const handleRegisterAttendance = async (tipoMovimiento) => {
    setLoading(true);

    try {

      // 1. Pedir permiso para acceder a la ubicación del celular

      let { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso al GPS para validar el registro de asistencia en campo.');
        setLoading(false);
        return;
      }
      // 2. Obtener la ubicación actual con alta precisión

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const latitud = location.coords.latitude;
      const longitud = location.coords.longitude;

      // 3. Preparar los datos para enviar a Django
      // Ajusta los nombres de los campos según tu modelo 'Asistencia' en el backend
      const datosAsistencia = {
        tipo: tipoMovimiento, // 'ENTRADA' o 'SALIDA'
        latitud: latitud,
        longitud: longitud,
      };

      // 4. Enviar a Django incluyendo el Token de seguridad en las cabeceras (Headers)

      const response = await api.post('asistencia/', datosAsistencia, {
        headers: {
          'Authorization': `Bearer ${token}`, // Verifica que tenga las comillas invertidas `` y la palabra Bearer bien escrita
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 201 || response.status === 200) {
        Alert.alert(
          '¡Registro Exitoso!',
          `Se ha registrado tu ${tipoMovimiento}.\n📍 Ubicación capturada correctamente.`
        );
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'No se pudo conectar con el servidor para registrar la asistencia.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Módulo de Asistencia</Text>
      <Text style={styles.subtitle}>Registra tus horas de entrada y salida con validación GPS</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <EmpresaLoader /> {/* 🔌 Cambiado */}
          <Text style={styles.loadingText}>Obteniendo ubicación GPS y sincronizando...</Text>
        </View>

      ) : (

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.buttonIn]} 
            onPress={() => handleRegisterAttendance('ENTRADA')}
          >
            <Text style={styles.buttonText}>REGISTRAR ENTRADA</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.buttonOut]} 
            onPress={() => handleRegisterAttendance('SALIDA')}
          >
            <Text style={styles.buttonText}>REGISTRAR SALIDA</Text>
          </TouchableOpacity>
        </View>

      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', paddingHorizontal: 30 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#2D2E31', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#7A7B80', marginBottom: 40, textAlign: 'center' },
  buttonContainer: { gap: 20 },
  button: { paddingVertical: 18, borderRadius: 14, alignItems: 'center', elevation: 3 },
  buttonIn: { backgroundColor: '#87C442' },
  buttonOut: { backgroundColor: '#7A7B80' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  loadingContainer: { alignItems: 'center', marginVertical: 20 },
  loadingText: { marginTop: 12, color: '#7A7B80', fontSize: 15, fontWeight: '500' },
}); 

