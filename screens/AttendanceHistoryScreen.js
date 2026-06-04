import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import api from '../api'; 
import EmpresaLoader from './EmpresaLoader'; 

export default function AttendanceHistoryScreen({ token }) { 
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  // 🛠️ Función calcular extras - PROTECCIÓN ABSOLUTA CONTRA REGISTROS VIEJOS
  const calcularHorasYExtras = (marcasDelDia, tagDia) => {
  if (!marcasDelDia || !Array.isArray(marcasDelDia)) {
    return { total: '--', extras: '0.0' };
  }

  // Helper para convertir "DD/MM/YYYY hh:mm A" a un objeto Date real de JavaScript
  const parsearFechaDjango = (stringFecha) => {
    if (!stringFecha) return null;
    try {
      // Separar fecha de hora ("02/06/2026" y "08:07 PM")
      const [fecha, tiempo, periodo] = stringFecha.split(" ");
      const [dia, mes, anio] = fecha.split("/");
      let [horas, minutos] = tiempo.split(":");
      
      let horaInt = parseInt(horas, 10);
      if (periodo === "PM" && horaInt < 12) horaInt += 12;
      if (periodo === "AM" && horaInt === 12) horaInt = 0;
      
      return new Date(anio, mes - 1, dia, horaInt, parseInt(minutos, 10));
    } catch (e) {
      return null;
    }
  };

  // 1. Filtrar registros válidos y parsear sus fechas
  const marcasProcesadas = marcasDelDia
    .map(m => ({ ...m, dateObj: parsearFechaDjango(m.fecha_hora) }))
    .filter(m => m.dateObj !== null);

  if (marcasProcesadas.length < 2) return { total: '--', extras: '0.0' };

  // 2. Ordenar cronológicamente
  const marcasOrdenadas = marcasProcesadas.sort((a, b) => a.dateObj - b.dateObj);

  let totalHorasTrabajadas = 0;

  // 3. Emparejar ENTRADA con la SIGUIENTE SALIDA disponible de forma estricta
  for (let i = 0; i < marcasOrdenadas.length; i++) {
    const marcaActual = marcasOrdenadas[i];
    
    if (marcaActual.tipo === 'ENTRADA') {
      // Busca la primera salida cronológica que ocurra DESPUÉS de esta entrada
      const siguienteSalida = marcasOrdenadas.find((m, index) => index > i && m.tipo === 'SALIDA');
      
      if (siguienteSalida) {
          const diferenciaMs = siguienteSalida.dateObj - marcaActual.dateObj;
          // Evitamos que sume 0 si fueron hechas en el mismo minuto por error
          if (!isNaN(diferenciaMs) && diferenciaMs > 60000) { 
            totalHorasTrabajadas += diferenciaMs / (1000 * 60 * 60);
          }
          // Avanzamos el índice hasta donde encontramos la salida para continuar el flujo
          i = marcasOrdenadas.indexOf(siguienteSalida);
        }
      }
    }

    if (totalHorasTrabajadas === 0) return { total: '--', extras: '0' };

    // 4. Reglas de negocio sobre horas netas iniciales
    let horasExtrasBrutas = 0;
    const numeroDiaSemana = marcasOrdenadas[0].dateObj.getDay(); // 0 = Domingo, 6 = Sábado

    if (tagDia === 'Festivo/Domingo' || numeroDiaSemana === 0) {
      horasExtrasBrutas = totalHorasTrabajadas;
    } else if (numeroDiaSemana === 6) {
      horasExtrasBrutas = totalHorasTrabajadas > 4 ? totalHorasTrabajadas - 4 : 0;
    } else {
      horasExtrasBrutas = totalHorasTrabajadas > 8 ? totalHorasTrabajadas - 8 : 0;
    }

    // 🧠 --- NUEVA LÓGICA DE REDONDEO ESTRICTO (Umbral de 45 minutos) ---
    let horasExtrasRedondeadas = 0;

    if (horasExtrasBrutas > 0) {
      const parteEntera = Math.floor(horasExtrasBrutas); // Las horas completas (ej: de 1.8 saca 1)
      const residuoDecimal = horasExtrasBrutas - parteEntera; // Los minutos en decimal (ej: 0.8)

      // 45 minutos equivalen a 0.75 en base decimal (45 / 60 = 0.75)
      if (residuoDecimal >= 0.75) {
        horasExtrasRedondeadas = parteEntera + 1; // Cumplió el umbral, se le paga la siguiente hora entera
      } else {
        horasExtrasRedondeadas = parteEntera; // No llegó a los 45 min, se queda con las horas enteras que llevaba
      }
    }

    return {
      total: totalHorasTrabajadas.toFixed(1), // Mantiene el total real trabajado con un decimal
      extras: horasExtrasRedondeadas.toString() // Devuelve el número entero limpio (ej: "1", "2", "0")
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

      // --- AGRUPACIÓN MEJORADA PARA 4 MARCAS ---
      datosRaw.forEach(marca => {
        if (!marca.fecha_hora) return;

        // Extraemos solo la fecha "YYYY-MM-DD" para agrupar correctamente
        const fechaDia = marca.fecha_hora.split(" ")[0] || marca.fecha_hora.split("T")[0];

        if (!diasAgrupados[fechaDia]) {
          diasAgrupados[fechaDia] = {
            id: marca.id,
            fecha: fechaDia,
            tagDia: marca.detalle_dia || 'Ordinario', // "Ordinario" o "Festivo/Domingo"
            marcas: [], // <-- Aquí metemos todas las marcas del día (las 4)
            latitud: marca.latitud,
            longitud: marca.longitud
          };
        }

        // Metemos la marca completa al listado de ese día
        diasAgrupados[fechaDia].marcas.push(marca);
      });

      // --- PROCESAMIENTO DE HORAS Y EXTRAS ---
      const listaProcesada = Object.values(diasAgrupados).map(dia => {
        // Ejecutamos el calculador pasándole el arreglo de marcas de este día
        const { total, extras } = calcularHorasYExtras(dia.marcas, dia.tagDia);

        // Clasificamos entradas y salidas ordenadas por ID para saber cuál fue la primera y cuál la última
        const entradas = dia.marcas.filter(m => m.tipo === 'ENTRADA').sort((a, b) => a.id - b.id);
        const salidas = dia.marcas.filter(m => m.tipo === 'SALIDA').sort((a, b) => a.id - b.id);

        return {
          ...dia,
          totalHoras: total,
          totalExtras: extras,
          // Guardamos las horas limpias formateadas en "HH:MM" para que la tarjeta las pinte
          entrada: entradas[0] ? entradas[0].fecha_hora.split(" ")[1].substring(0, 5) : '--:--',
          salida: salidas[salidas.length - 1] ? salidas[salidas.length - 1].fecha_hora.split(" ")[1].substring(0, 5) : '--:--',
        };
      });

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
    // CORRECCIÓN: Leemos directamente los datos que ya calculamos en obtenerHistorial
    const tieneExtras = parseFloat(item.totalExtras) > 0;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {/* Mostramos la fecha real del día en grande */}
          <Text style={styles.fechaTitulo}>📅 {item.fecha}</Text>
          <Text style={styles.cardTag}>{item.tagDia}</Text>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.horasFila}>
            <Text style={styles.horaDetalle}><Text style={styles.entradaTexto}>🟢 Ent:</Text> {item.entrada}</Text>
            <Text style={styles.horaDetalle}><Text style={styles.salidaTexto}>🔴 Sal:</Text> {item.salida}</Text>
            <Text style={styles.horaDetalle}><Text style={styles.totalTexto}>Total:</Text> {item.totalHoras} hrs</Text>
          </View>

          {tieneExtras && (
            <View style={styles.badgeExtra}>
              <Text style={styles.badgeExtraTexto}>⏱️ ¡Buen trabajo! +{item.totalExtras} horas extras acumuladas</Text>
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