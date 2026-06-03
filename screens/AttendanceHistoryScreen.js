import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import api from '../api'; 
import EmpresaLoader from './EmpresaLoader'; 

export default function AttendanceHistoryScreen({ token }) { 
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 🛠️ Función calcular extras con reglas de Sábados y Festivos
  const calcularHorasYExtras = (entradaStr, salidaStr, tagDia) => {
    if (!entradaStr || !salidaStr) return { total: '--', extras: '0.0' };

    const entrada = new Date(entradaStr.replace(" ", "T"));
    const salida = new Date(salidaStr.replace(" ", "T"));

    const diferenciaMs = salida - entrada;
    if (isNaN(diferenciaMs) || diferenciaMs <= 0) return { total: '--', extras: '0.0' };

    const totalHoras = diferenciaMs / (1000 * 60 * 60); 
    let horasExtras = 0;

    // Saber el día de la semana (0 = Domingo, 6 = Sábado)
    const numeroDiaSemana = entrada.getDay(); 

    if (tagDia === 'Festivo/Domingo' || numeroDiaSemana === 0) {
      // 1. Domingo o Festivo: Todo el tiempo son extras
      horasExtras = totalHoras;
    } else if (numeroDiaSemana === 6) {
      // 2. Sábado: Más de 4 horas es extra
      horasExtras = totalHoras > 4 ? totalHoras - 4 : 0;
    } else {
      // 3. Lunes a Viernes: Más de 8 horas es extra
      horasExtras = totalHoras > 8 ? totalHoras - 8 : 0;
    }

    return {
      total: totalHoras.toFixed(1),
      extras: horasExtras.toFixed(1)
    };
  };

  const obtenerHistorial = async () => {
    try {
      setCargando(true);
      
      if (!token) {
        Alert.alert("Error", "No se encontró una sesión activa.");
        return;
      }
      
      const response = await api.get('asistencia/historial/', {
        headers: {
          'Authorization': `Bearer ${token}`, 
        },
      });

      const datosRaw = response.data || [];
      const diasAgrupados = {};

      // --- AGRUPACIÓN MEJORADA POR DÍA REAL ---
      datosRaw.forEach(marca => {
        if (!marca.fecha_hora) return;

        // Extraemos solo la fecha "YYYY-MM-DD" del string completo para agrupar correctamente
        const fechaDia = marca.fecha_hora.split(" ")[0] || marca.fecha_hora.split("T")[0];

        if (!diasAgrupados[fechaDia]) {
          diasAgrupados[fechaDia] = {
            id: marca.id,
            fecha: fechaDia,
            tagDia: marca.detalle_dia || 'Ordinario', // "Ordinario" o "Festivo/Domingo"
            entrada: null,
            salida: null,
            latitud: marca.latitud,
            longitud: marca.longitud
          };
        }

        if (marca.tipo === 'ENTRADA') {
          diasAgrupados[fechaDia].entrada = marca.fecha_hora;
        } else if (marca.tipo === 'SALIDA') {
          diasAgrupados[fechaDia].salida = marca.fecha_hora;
        }
      });

      const listaProcesada = Object.values(diasAgrupados);
      // Las ordenamos para que aparezcan las más recientes arriba
      listaProcesada.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      
      setHistorial(listaProcesada);

    } catch (error) {
      console.error("Error al traer historial:", error);
      Alert.alert("Error", "No se pudo obtener el historial de asistencias.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerHistorial();
  }, []);

  const renderItem = ({ item }) => {
    const { total, extras } = calcularHorasYExtras(item.entrada, item.salida, item.tagDia);
    const tieneExtras = parseFloat(extras) > 0;

    // Extrae de forma segura la hora limpia "HH:MM" del string de Django
    const extraerHora = (fechaCompleta) => {
      if (!fechaCompleta) return '--:--';
      // Si viene como "2026-06-01 08:30:00", saca "08:30"
      const partes = fechaCompleta.split(" ");
      if (partes[1]) return partes[1].substring(0, 5);
      // Si viene en formato ISO "2026-06-01T08:30:00Z"
      const partesISO = fechaCompleta.split("T");
      if (partesISO[1]) return partesISO[1].substring(0, 5);
      return '--:--';
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {/* Mostramos la fecha real del día en grande */}
          <Text style={styles.fechaTitulo}>📅 {item.fecha}</Text>
          <Text style={styles.cardTag}>{item.tagDia}</Text>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.horasFila}>
            <Text style={styles.horaDetalle}><Text style={styles.entradaTexto}>🟢 Ent:</Text> {extraerHora(item.entrada)}</Text>
            <Text style={styles.horaDetalle}><Text style={styles.salidaTexto}>🔴 Sal:</Text> {extraerHora(item.salida)}</Text>
            <Text style={styles.horaDetalle}><Text style={styles.totalTexto}>Total:</Text> {total} hrs</Text>
          </View>

          {tieneExtras && (
            <View style={styles.badgeExtra}>
              <Text style={styles.badgeExtraTexto}>⏱️ ¡Buen trabajo! +{extras} horas extras acumuladas</Text>
            </View>
          )}

          <Text style={styles.geoText}>
            📍 Lat: {item.latitud ? item.latitud.toFixed(4) : '0.0000'} | Lon: {item.longitud ? item.longitud.toFixed(4) : '0.0000'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi Historial de Asistencia</Text>
      
      {cargando ? (
        <View style={styles.pantallaCentro}>
          <EmpresaLoader />
          <Text style={styles.textoCarga}>Calculando jornadas de tiempo...</Text>
        </View>
      ) : (
        <FlatList
          data={historial}
          keyExtractor={(item) => item.fecha}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tienes registros de asistencia todavía.</Text>
          }
          onRefresh={obtenerHistorial}
          refreshing={cargando}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 10, paddingHorizontal: 15 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2D2E31', marginBottom: 15, textAlign: 'center' },
  listContainer: { paddingBottom: 20 },
  pantallaCentro: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  textoCarga: { marginTop: 12, color: '#7A7B80', fontSize: 14, fontWeight: '500' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
    paddingBottom: 8,
    marginBottom: 10 
  },
  fechaTitulo: { fontSize: 15, fontWeight: 'bold', color: '#2D2E31' },
  cardTag: { 
    fontSize: 11, 
    color: '#87C442', 
    fontWeight: 'bold', 
    backgroundColor: '#E8F5E9', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 6 
  },
  cardBody: { marginTop: 4 },
  horasFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  horaDetalle: { fontSize: 13, color: '#2D2E31', fontWeight: '600' },
  entradaTexto: { color: '#155724', fontWeight: 'bold' },
  salidaTexto: { color: '#721c24', fontWeight: 'bold' },
  totalTexto: { color: '#87C442', fontWeight: 'bold' },
  badgeExtra: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FFEBAA',
    marginBottom: 8,
    alignItems: 'center'
  },
  badgeExtraTexto: { color: '#856404', fontSize: 12, fontWeight: '700' },
  geoText: { fontSize: 12, color: '#6c757d', fontStyle: 'italic', marginTop: 4 },
  emptyText: { textAlign: 'center', color: '#6c757d', marginTop: 30, fontSize: 16 },
});