import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import * as Location from 'expo-location'; 
import api from '../api'; 
import EmpresaLoader from './EmpresaLoader';

export default function AttendanceScreen({ token, onBack }) {
  const [loading, setLoading] = useState(false);
  const [ultimoMovimiento, setUltimoMovimiento] = useState(null); // 'ENTRADA', 'SALIDA' o null

  // 🔄 1. Consultar el último estado al abrir la pantalla para bloquear botones
  // 🔄 1. Consultar el último estado al abrir la pantalla para bloquear botones (Con reseteo diario)
  const verificarUltimoMovimiento = async () => {
    try {
      const response = await api.get('asistencia/historial/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const datosRaw = response.data || [];
      
      if (datosRaw.length > 0) {
        const ultimaMarca = datosRaw[0]; // La más reciente
        
        // Obtener la fecha de hoy en formato local "DD/MM/YYYY" para comparar
        const hoy = new Date();
        const dia = String(hoy.getDate()).padStart(2, '0');
        const mes = String(hoy.getMonth() + 1).padStart(2, '0'); // Enero es 0
        const anio = hoy.getFullYear();
        const fechaHoyStr = `${dia}/${mes}/${anio}`; // Queda "04/06/2026"

        // Extraemos solo la fecha de la marca de Django (ej: "02/06/2026 08:07 PM" -> "02/06/2026")
        const fechaMarcaStr = ultimaMarca.fecha_hora.split(" ")[0];

        // 🧠 REGLA DE ORO:
        if (ultimaMarca.tipo === 'ENTRADA' && fechaMarcaStr !== fechaHoyStr) {
          // Si fue una ENTRADA pero NO fue hoy, asumimos olvido. 
          // Reseteamos el estado a null para que AMBOS botones queden libres, priorizando que pueda entrar hoy.
          setUltimoMovimiento(null);
        } else {
          // Si fue hoy, o si fue una SALIDA, opera el bloqueo normal intercalado
          setUltimoMovimiento(ultimaMarca.tipo);
        }
      }
    } catch (error) {
      console.log("Error consultando último estado:", error);
    }
  };

  useEffect(() => {
    verificarUltimoMovimiento();
  }, []);

  // 🛰️ 2. Lógica para capturar GPS y guardar en Django
  const ejecutarRegistroBackend = async (tipoMovimiento) => {
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso al GPS para validar el registro de asistencia en campo.');
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const latitud = location.coords.latitude;
      const longitud = location.coords.longitude;

      const datosAsistencia = {
        tipo: tipoMovimiento, 
        latitud: latitud,
        longitud: longitud,
      };

      const response = await api.post('asistencia/', datosAsistencia, {
        headers: {
          'Authorization': `Bearer ${token}`, 
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 201 || response.status === 200) {
        Alert.alert(
          '¡Registro Exitoso!',
          `Se ha registrado tu ${tipoMovimiento}.\n📍 Ubicación capturada correctamente.`
        );
        setUltimoMovimiento(tipoMovimiento); // Actualiza el estado para cambiar el bloqueo de los botones
      }
    } catch (error) {
      console.log(error);
      Alert.alert('Error', 'No se pudo conectar con el servidor para registrar la asistencia.');
    } finally {
      setLoading(false);
    }
  };

  // ❓ 3. Lanzar la ventana modal de confirmación antes de disparar el GPS
  const handleRegisterAttendance = (tipoMovimiento) => {
    Alert.alert(
      'Confirmar Registro',
      `¿Estás seguro de que deseas marcar tu ${tipoMovimiento} en este momento?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, registrar', onPress: () => ejecutarRegistroBackend(tipoMovimiento) }
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Módulo de Asistencia</Text>
      <Text style={styles.subtitle}>Registra tus horas de entrada y salida con validación GPS</Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <EmpresaLoader /> 
          <Text style={styles.loadingText}>Obteniendo ubicación GPS y sincronizando...</Text>
        </View>
      ) : (
        <View style={styles.buttonContainer}>
          
          {/* BOTÓN ENTRADA: Se bloquea si el último registro ya fue una ENTRADA */}
          <TouchableOpacity 
            style={[
              styles.button, 
              styles.buttonIn,
              ultimoMovimiento === 'ENTRADA' && styles.buttonDeshabilitado
            ]} 
            onPress={() => handleRegisterAttendance('ENTRADA')}
            disabled={ultimoMovimiento === 'ENTRADA'}
          >
            <Text style={styles.buttonText}>REGISTRAR ENTRADA</Text>
          </TouchableOpacity>

          {/* BOTÓN SALIDA: Se bloquea si el último registro ya fue una SALIDA */}
          <TouchableOpacity 
            style={[
              styles.button, 
              styles.buttonOut,
              ultimoMovimiento === 'SALIDA' && styles.buttonDeshabilitado
            ]} 
            onPress={() => handleRegisterAttendance('SALIDA')}
            disabled={ultimoMovimiento === 'SALIDA'}
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
  buttonDeshabilitado: { backgroundColor: '#E0E0E0', opacity: 0.6, elevation: 0 }, // Estilo gris de bloqueo
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  loadingContainer: { alignItems: 'center', marginVertical: 20 },
  loadingText: { marginTop: 12, color: '#7A7B80', fontSize: 15, fontWeight: '500' },
});