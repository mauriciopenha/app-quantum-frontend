import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TouchableOpacity, Linking } from 'react-native';
import api from '../api'; 
import EmpresaLoader from './EmpresaLoader'; 

// 📊 COMPONENTE CORREGIDO: EXTRAS ORDINARIAS DE SEMANA VS EXTRAS FESTIVAS
const TarjetaResumenQuincenal = ({ historial }) => {
  const obtenerTotalesQuincena = () => {
    let acumuladoExtrasOrdinarias = 0; // 💼 Antes llamadas ordinarias, ahora son extras de semana
    let acumuladoExtrasDF = 0;         // ⏱️ Extras de Domingos y Festivos

    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1; // Junio = 6
    const anioActual = hoy.getFullYear(); // 2026
    const diaActual = hoy.getDate();

    const esPrimeraQuincena = diaActual <= 15;
    const diaInicio = esPrimeraQuincena ? 1 : 16;
    const diaFin = esPrimeraQuincena ? 15 : 31;

    historial.forEach(dia => {
      if (!dia.fecha) return;

      const partes = dia.fecha.split('/');
      if (partes.length !== 3) return; 

      const diaNum = parseInt(partes[0], 10);
      const mesNum = parseInt(partes[1], 10); 
      const anioNum = parseInt(partes[2], 10);

      // 🎯 FILTRO QUINCENAL ESTRICTO
      if (mesNum === mesActual && anioNum === anioActual && diaNum >= diaInicio && diaNum <= diaFin) {
        
        // Obtenemos las extras ya calculadas por tu función matemática (vienen como string)
        const horasExtrasCalculadas = parseInt(dia.totalExtras, 10) || 0;

        if (dia.tagDia === 'Festivo/Domingo') {
          // Si el tag es festivo, se va a la bolsa de festivas
          acumuladoExtrasDF += horasExtrasCalculadas;
        } else {
          // 🟢 SI ES DÍA DE SEMANA O SÁBADO:
          // Sumamos las horas extras aquí (las del 2 y 6 de junio caerán exactamente aquí)
          acumuladoExtrasOrdinarias += horasExtrasCalculadas;
        }
      }
    });

    const ultimoDiaMes = new Date(anioActual, mesActual, 0).getDate();

    return {
      rango: esPrimeraQuincena ? "1 al 15" : `16 al ${ultimoDiaMes}`,
      extrasOrdinarias: acumuladoExtrasOrdinarias,
      extrasDF: acumuladoExtrasDF   
    };
  };

  const { rango, extrasOrdinarias, extrasDF } = obtenerTotalesQuincena();
  const nombreMes = new Date().toLocaleString('es-CO', { month: 'long' }).toUpperCase();

  return (
    <View style={styles.resumenCard}>
      <Text style={styles.resumenPeriodo}>📅 ACUMULADO QUINCENA: DEL {rango} DE {nombreMes}</Text>
      <View style={styles.resumenContenedorFilas}>
        <View style={styles.resumenBloque}>
          <Text style={styles.resumenEtiqueta}>💼 Extras Ordinarias</Text>
          <Text style={styles.resumenValorOrdinario}>{extrasOrdinarias} hrs</Text>
        </View>
        <View style={styles.resumenVerticalDivisor} />
        <View style={styles.resumenBloque}>
          <Text style={styles.resumenEtiqueta}>⏱️ Extras / Festivos</Text>
          <Text style={styles.resumenValorExtra}>{extrasDF} hrs</Text>
        </View>
      </View>
    </View>
  );
};

// COMPONENTE INDEPENDIENTE PARA LA TARJETA
const TarjetaAsistencia = ({ item }) => {
  const [expandido, setExpandido] = useState(false);
  const tieneExtras = parseFloat(item.totalExtras) > 0;

  const abrirMapa = (latitud, longitud) => {
    if (!latitud || !longitud || latitud === 0 || longitud === 0) {
      Alert.alert("Sin ubicación", "Este registro no cuenta con coordenadas GPS válidas.");
      return;
    }
    const url = `http://maps.google.com/?q=${latitud},${longitud}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "No se pudo abrir Google Maps.");
    });
  };

  const extraerHoraDetalle = (fechaCompleta) => {
    if (!fechaCompleta) return '--:--';
    const partes = fechaCompleta.split(" ");
    if (partes[1] && partes[2]) {
      return `${partes[1]} ${partes[2]}`;
    }
    return partes[1] ? partes[1].substring(0, 5) : '--:--';
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.fechaTitulo}>📅 {item.fecha}</Text>
        <Text style={[styles.cardTag, item.tagDia === 'Festivo/Domingo' && {backgroundColor: '#e63946', color: '#fff'}]}>
          {item.tagDia}
        </Text>
      </View>
      
      <View style={styles.cardBody}>
        <View style={styles.horasFila}>
          <Text style={styles.horaDetalle}><Text style={styles.entradaTexto}>🟢 Ent:</Text> {item.entrada}</Text>
          <Text style={styles.horaDetalle}><Text style={styles.salidaTexto}>🔴 Sal:</Text> {item.salida}</Text>
          <Text style={styles.horaDetalle}><Text style={styles.totalTexto}>Total:</Text> {item.totalHoras} hrs</Text>
        </View>

        {tieneExtras && item.tagDia !== 'Festivo/Domingo' && (
          <View style={styles.badgeExtra}>
            <Text style={styles.badgeExtraTexto}>⏱️ ¡Buen trabajo! +{item.totalExtras} horas extras acumuladas</Text>
          </View>
        )}

        {expandido && (
          <View style={styles.seccionDetalleContenedor}>
            <View style={styles.divisorLine} />
            <Text style={styles.tituloDetalleMarcas}>📋 Detalle de Movimientos del Día:</Text>
            
            {item.marcas && item.marcas.map((marca, index) => {
              const tieneGps = marca.latitud && marca.longitud && parseFloat(marca.latitud) !== 0 && parseFloat(marca.longitud) !== 0;

              return (
                <View key={marca.id || index} style={styles.marcaDetalleItem}>
                  <View style={styles.marcaDetalleIzquierda}>
                    <Text style={marca.tipo === 'ENTRADA' ? styles.entradaTexto : styles.salidaTexto}>
                      {marca.tipo === 'ENTRADA' ? '📥 ENTRADA' : '📤 SALIDA'}
                    </Text>
                    <Text style={styles.horaMarcadaTexto}>🕗 {extraerHoraDetalle(marca.fecha_hora)}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.btnMapa, !tieneGps && styles.btnMapaDeshabilitated]}
                    onPress={() => abrirMapa(marca.latitud, marca.longitud)}
                    disabled={!tieneGps}
                  >
                    <Text style={styles.btnMapaTexto}>{tieneGps ? '📍 Ver Mapa' : '❌ Sin GPS'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity 
          onPress={() => setExpandido(!expandido)} 
          activeOpacity={0.6}
          style={{ marginTop: 10, paddingVertical: 4 }}
        >
          <Text style={styles.indicadorToque}>
            {expandido ? '🔼 Toca aquí para ocultar detalles' : '🔽 Toca aquí para ver las marcas y lugar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// COMPONENTE PRINCIPAL DE LA PANTALLA
export default function AttendanceHistoryScreen({ token }) { 
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  const calcularHorasYExtras = (marcasDelDia, tagDia) => {
    if (!marcasDelDia || !Array.isArray(marcasDelDia)) {
      return { total: '--', extras: '0.0' };
    }

    const parsearFechaDjango = (stringFecha) => {
      if (!stringFecha) return null;
      try {
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

    const marcasProcesadas = marcasDelDia
      .map(m => ({ ...m, dateObj: parsearFechaDjango(m.fecha_hora) }))
      .filter(m => m.dateObj !== null);

    if (marcasProcesadas.length < 2) return { total: '--', extras: '0.0' };

    const marcasOrdenadas = marcasProcesadas.sort((a, b) => a.dateObj - b.dateObj);
    let totalHorasTrabajadas = 0;

    for (let i = 0; i < marcasOrdenadas.length; i++) {
      const marcaActual = marcasOrdenadas[i];
      if (marcaActual.tipo === 'ENTRADA') {
        const siguienteSalida = marcasOrdenadas.find((m, index) => index > i && m.tipo === 'SALIDA');
        if (siguienteSalida) {
          const diferenciaMs = siguienteSalida.dateObj - marcaActual.dateObj;
          if (!isNaN(diferenciaMs) && diferenciaMs > 60000) { 
            totalHorasTrabajadas += diferenciaMs / (1000 * 60 * 60);
          }
          i = marcasOrdenadas.indexOf(siguienteSalida);
        }
      }
    }

    if (totalHorasTrabajadas === 0) return { total: '--', extras: '0' };

    let horasExtrasBrutas = 0;
    const numeroDiaSemana = marcasOrdenadas[0].dateObj.getDay();

    if (tagDia === 'Festivo/Domingo' || numeroDiaSemana === 0) {
      horasExtrasBrutas = totalHorasTrabajadas;
    } else if (numeroDiaSemana === 6) {
      horasExtrasBrutas = totalHorasTrabajadas > 4 ? totalHorasTrabajadas - 4 : 0;
    } else {
      horasExtrasBrutas = totalHorasTrabajadas > 8 ? totalHorasTrabajadas - 8 : 0;
    }

    let horasExtrasRedondeadas = 0;
    if (horasExtrasBrutas > 0) {
      const parteEntera = Math.floor(horasExtrasBrutas); 
      const residuoDecimal = horasExtrasBrutas - parteEntera; 

      if (residuoDecimal >= 0.75) {
        horasExtrasRedondeadas = parteEntera + 1; 
      } else {
        horasExtrasRedondeadas = parteEntera; 
      }
    }

    return {
      total: totalHorasTrabajadas.toFixed(1), 
      extras: horasExtrasRedondeadas.toString() 
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
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const datosRaw = response.data || [];
      const diasAgrupados = {};

      datosRaw.forEach(marca => {
        if (!marca.fecha_hora) return;
        const fechaDia = marca.fecha_hora.split(" ")[0] || marca.fecha_hora.split("T")[0];

        if (!diasAgrupados[fechaDia]) {
          diasAgrupados[fechaDia] = {
            id: marca.id,
            fecha: fechaDia,
            tagDia: marca.detalle_dia || 'Ordinario', 
            marcas: [], 
            latitud: marca.latitud,
            longitud: marca.longitud
          };
        }
        diasAgrupados[fechaDia].marcas.push(marca);
      });

      const listaProcesada = Object.values(diasAgrupados).map(dia => {
        const { total, extras } = calcularHorasYExtras(dia.marcas, dia.tagDia);
        const entradas = dia.marcas.filter(m => m.tipo === 'ENTRADA').sort((a, b) => a.id - b.id);
        const salidas = dia.marcas.filter(m => m.tipo === 'SALIDA').sort((a, b) => a.id - b.id);

        return {
          ...dia,
          totalHoras: total,
          totalExtras: extras,
          entrada: entradas[0] ? entradas[0].fecha_hora.split(" ")[1].substring(0, 5) : '--:--',
          salida: salidas[salidas.length - 1] ? salidas[salidas.length - 1].fecha_hora.split(" ")[1].substring(0, 5) : '--:--',
        };
      });

      // 🔄 ORDENAMIENTO SEGURO: Parseamos de forma manual "DD/MM/YYYY" para evitar el bug de JS
      listaProcesada.sort((a, b) => {
        const [diaA, mesA, anioA] = a.fecha.split('/').map(Number);
        const [diaB, mesB, anioB] = b.fecha.split('/').map(Number);
        
        // Creamos objetos de fecha reales y comparables con el orden correcto (Año, Mes-1, Día)
        return new Date(anioB, mesB - 1, diaB) - new Date(anioA, mesA - 1, diaA);
      });

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
          // 📦 AGREGAMOS NUESTRA TARJETA DE RESUMEN COMO CABECERA DE LA LISTA
          ListHeaderComponent={historial.length > 0 ? <TarjetaResumenQuincenal historial={historial} /> : null}
          renderItem={({ item }) => <TarjetaAsistencia item={item} />} 
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

  seccionDetalleContenedor: { marginTop: 10, backgroundColor: '#f1f3f5', padding: 10, borderRadius: 8 },
  divisorLine: { height: 1, backgroundColor: '#dee2e6', marginBottom: 10 },
  tituloDetalleMarcas: { fontSize: 13, fontWeight: '700', color: '#495057', marginBottom: 8 },
  marcaDetalleItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    backgroundColor: '#ffffff', 
    padding: 8, 
    borderRadius: 6, 
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#87C442'
  },
  marcaDetalleIzquierda: { flex: 1 },
  marcaDetalleDerecha: { alignItems: 'flex-end', justifyContent: 'center' },
  horaMarcadaTexto: { fontSize: 12, fontWeight: '600', color: '#2D2E31', marginTop: 2 },
  geoDetalleText: { fontSize: 11, color: '#6c757d', fontFamily: 'monospace' },
  indicadorToque: { textAlign: 'center', fontSize: 11, color: '#A0A1A6', marginTop: 6, fontWeight: '500' },

  // 🟢 
  btnMapa: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  btnMapaDeshabilitado: {
    backgroundColor: '#ECEFF1',
    borderColor: '#CFD8DC',
  },
  btnMapaTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32',
  },
  resumenCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resumenPeriodo: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  resumenContenedorFilas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  resumenBloque: {
    alignItems: 'center',
    flex: 1,
  },
  resumenEtiqueta: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  resumenValorOrdinario: {
    color: '#f8fafc',
    fontSize: 20,
    fontWeight: 'bold',
  },
  resumenValorExtra: {
    color: '#f59e0b',
    fontSize: 20,
    fontWeight: 'bold',
  },
  resumenVerticalDivisor: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
  },
});