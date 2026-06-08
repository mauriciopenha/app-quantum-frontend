import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, TouchableOpacity, Linking } from 'react-native';
import api from '../api'; 
import EmpresaLoader from './EmpresaLoader'; 

// 📊 COMPONENTE TARJETA DE RESUMEN: ADAPTADO A MES Y QUINCENAS DETALLADAS EN TIEMPO REAL
const TarjetaResumenPeriodo = ({ historial, mesSeleccionado, filtroPeriodo }) => {
  const obtenerTotalesFiltrados = () => {
    let acumuladoExtrasOrdinarias = 0; 
    let acumuladoExtrasDF = 0;         

    const hoy = new Date();
    const anioActual = hoy.getFullYear(); 

    historial.forEach(dia => {
      if (!dia.fecha) return;

      const partes = dia.fecha.split('/');
      if (partes.length !== 3) return; 

      const diaNum = parseInt(partes[0], 10);
      const mesNum = parseInt(partes[1], 10); 
      const anioNum = parseInt(partes[2], 10);

      if (mesNum === mesSeleccionado && anioNum === anioActual) {
        let pasaFiltroPeriodo = false;
        if (filtroPeriodo === 'COMPLETO') pasaFiltroPeriodo = true;
        if (filtroPeriodo === 'Q1' && diaNum <= 15) pasaFiltroPeriodo = true;
        if (filtroPeriodo === 'Q2' && diaNum >= 16) pasaFiltroPeriodo = true;

        if (pasaFiltroPeriodo) {
          const horasExtrasCalculadas = parseInt(dia.totalExtras, 10) || 0;

          if (dia.tagDia === 'Festivo/Domingo') {
            acumuladoExtrasDF += horasExtrasCalculadas;
          } else {
            acumuladoExtrasOrdinarias += horasExtrasCalculadas;
          }
        }
      }
    });

    return {
      extrasOrdinarias: acumuladoExtrasOrdinarias,
      extrasDF: acumuladoExtrasDF   
    };
  };

  const { extrasOrdinarias, extrasDF } = obtenerTotalesFiltrados();
  
  const fechaMes = new Date();
  fechaMes.setMonth(mesSeleccionado - 1);
  const nombreMes = fechaMes.toLocaleString('es-CO', { month: 'long' }).toUpperCase();

  let textoTitulo = `📊 ACUMULADO TOTAL: MES DE ${nombreMes}`;
  if (filtroPeriodo === 'Q1') textoTitulo = `📅 ACUMULADO: 1RA QUINCENA DE ${nombreMes}`;
  if (filtroPeriodo === 'Q2') textoTitulo = `📅 ACUMULADO: 2DA QUINCENA DE ${nombreMes}`;

  return (
    <View style={styles.resumenCard}>
      <Text style={styles.resumenPeriodo}>{textoTitulo}</Text>
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

// COMPONENTE INDEPENDIENTE PARA LA TARJETA DE CADA DÍA
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
                    style={[styles.btnMapa, !tieneGps && styles.btnMapaDeshabilitado]}
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

  // Estados de filtrado
  const mesActualDelSistema = new Date().getMonth() + 1; // 6 para Junio
  const [mesSeleccionado, setMesSeleccionado] = useState(mesActualDelSistema);
  const [filtroPeriodo, setFiltroPeriodo] = useState('COMPLETO');
  const [historialFiltrado, setHistorialFiltrado] = useState([]);

  // Referencia para controlar el scroll del carrusel de meses
  const flatListMesesRef = useRef(null);

  const mesesBase = [
    { id: 1, nombre: 'Ene' }, { id: 2, nombre: 'Feb' }, { id: 3, nombre: 'Mar' },
    { id: 4, nombre: 'Abr' }, { id: 5, nombre: 'May' }, { id: 6, nombre: 'Jun' },
    { id: 7, nombre: 'Jul' }, { id: 8, nombre: 'Ago' }, { id: 9, nombre: 'Sep' },
    { id: 10, nombre: 'Oct' }, { id: 11, nombre: 'Nov' }, { id: 12, merge: 'Dic', nombre: 'Dic' }
  ];

  // Generamos una lista larga repitiendo los meses para simular el bucle infinito circular
  const REPETICIONES = 50; 
  const mesesInfinitos = Array.from({ length: REPETICIONES }, (_, i) => 
    mesesBase.map(m => ({ ...m, unicoId: `${m.id}-${i}` }))
  ).flat();

  // El "centro" real inicial de nuestra lista larga correspondiente al mes en curso
  const indiceCentroInicial = (Math.floor(REPETICIONES / 2) * 12) + (mesActualDelSistema - 1);

  // Función encargada de centrar suavemente un mes específico en la pantalla
  const centrarMesEnPantalla = (idMes, animar = true) => {
    if (!flatListMesesRef.current) return;
    
    // Buscamos el índice que esté más cerca del centro visual de la lista infinita
    const indicesCoincidentes = [];
    mesesInfinitos.forEach((m, idx) => {
      if (m.id === idMes) indicesCoincidentes.push(idx);
    });

    const centroIdeal = Math.floor(mesesInfinitos.length / 2);
    const indiceMasCercanoAlCentro = indicesCoincidentes.reduce((prev, curr) => 
      Math.abs(curr - centroIdeal) < Math.abs(prev - centroIdeal) ? curr : prev
    );

    flatListMesesRef.current.scrollToIndex({
      index: indiceMasCercanoAlCentro,
      viewPosition: 0.5, // ⭐ 0.5 fuerza a React Native a ubicar el ítem exactamente en el medio horizontal de la pantalla
      animated: animar
    });
  };

  // 🎯 NUEVO EFECTO: Fuerza el centrado inicial correcto de Junio apenas abre la pantalla
  useEffect(() => {
    const timer = setTimeout(() => {
      centrarMesEnPantalla(mesSeleccionado, false);
    }, 450); // Le damos un pequeño respiro a la UI para renderizar antes de centrar

    return () => clearTimeout(timer);
  }, []);

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

      listaProcesada.sort((a, b) => {
        const [diaA, mesA, anioA] = a.fecha.split('/').map(Number);
        const [diaB, mesB, anioB] = b.fecha.split('/').map(Number);
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

  // 🔄 MOTOR DE FILTRADO DINÁMICO
  useEffect(() => {
    if (historial.length > 0) {
      const filtrados = historial.filter(dia => {
        const partes = dia.fecha.split('/');
        if (partes.length !== 3) return false;
        
        const diaNum = parseInt(partes[0], 10);
        const mesNum = parseInt(partes[1], 10);

        if (mesNum !== mesSeleccionado) return false;

        if (filtroPeriodo === 'Q1' && diaNum > 15) return false;
        if (filtroPeriodo === 'Q2' && diaNum < 16) return false;

        return true;
      });
      setHistorialFiltrado(filtrados);
    } else {
      setHistorialFiltrado([]);
    }
  }, [historial, mesSeleccionado, filtroPeriodo]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mi Historial de Asistencia</Text>
      
      {/* 🗓️ 1️⃣ SELECTOR DE MESES INFINITO COHRENTE Y CENTRADO VISUALMENTE */}
      <View style={styles.contenedorMesesExterior}>
        <FlatList
          ref={flatListMesesRef}
          data={mesesInfinitos}
          horizontal
          keyExtractor={(item) => item.unicoId}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollMesesContenido}
          initialScrollIndex={indiceCentroInicial} 
          getItemLayout={(data, index) => ({
            length: 71, // 55 minWidth + 16 (marginHorizontal de 8 a cada lado)
            offset: 71 * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListMesesRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.5 });
            }, 50);
          }}
          renderItem={({ item }) => {
            const esActivo = item.id === mesSeleccionado;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setMesSeleccionado(item.id);
                  centrarMesEnPantalla(item.id, true);
                }}
                style={[styles.botonMes, esActivo && styles.botonMesActivo]}
              >
                <Text style={[styles.textoMes, esActivo && styles.textoMesActivo]}>
                  {item.nombre}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* 📅 2️⃣ SELECTOR DE QUINCENAS */}
      <View style={styles.contenedorQuincenas}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setFiltroPeriodo('COMPLETO')}
          style={[styles.botonPeriodo, filtroPeriodo === 'COMPLETO' && styles.botonPeriodoActivo]}
        >
          <Text style={[styles.textoPeriodo, filtroPeriodo === 'COMPLETO' && styles.textoPeriodoActivo]}>
            Mes Completo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setFiltroPeriodo('Q1')}
          style={[styles.botonPeriodo, filtroPeriodo === 'Q1' && styles.botonPeriodoActivo]}
        >
          <Text style={[styles.textoPeriodo, filtroPeriodo === 'Q1' && styles.textoPeriodoActivo]}>
            1ra Quincena
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setFiltroPeriodo('Q2')}
          style={[styles.botonPeriodo, filtroPeriodo === 'Q2' && styles.botonPeriodoActivo]}
        >
          <Text style={[styles.textoPeriodo, filtroPeriodo === 'Q2' && styles.textoPeriodoActivo]}>
            2da Quincena
          </Text>
        </TouchableOpacity>
      </View>

      {cargando ? (
        <View style={styles.pantallaCentro}>
          <EmpresaLoader /> 
          <Text style={styles.textoCarga}>Calculando jornadas de tiempo...</Text>
        </View>
      ) : (
        <FlatList
          data={historialFiltrado}
          keyExtractor={(item) => item.fecha}
          ListHeaderComponent={
            historial.length > 0 ? (
              <TarjetaResumenPeriodo 
                historial={historial} 
                mesSeleccionado={mesSeleccionado} 
                filtroPeriodo={filtroPeriodo}
              />
            ) : null
          }
          renderItem={({ item }) => <TarjetaAsistencia item={item} />} 
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tienes registros en el periodo seleccionado.</Text>
          }
          onRefresh={obtenerHistorial}
          refreshing={cargando}
        />
      )}
    </View>
  );
}

// 🎨 HOJA DE ESTILOS PROPIA INTEGRADA PERFECTAMENTE
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

  contenedorMesesExterior: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    marginHorizontal: -15, 
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
    marginBottom: 5,
  },
  scrollMesesContenido: {
    paddingHorizontal: 15,
  },
  botonMes: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#e9ecef',
    marginHorizontal: 8, // Ajustado a 8 simétrico para el cálculo matemático del offset (71px)
    minWidth: 55, 
    alignItems: 'center',
  },
  botonMesActivo: {
    backgroundColor: '#007bff', 
  },
  textoMes: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '600',
  },
  textoMesActivo: {
    color: '#fff',
  },
  contenedorQuincenas: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 10,
    marginHorizontal: -15, 
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    marginBottom: 15,
  },
  botonPeriodo: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 8,
    backgroundColor: '#f1f3f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  botonPeriodoActivo: {
    backgroundColor: '#28a745', 
    borderColor: '#28a745',
  },
  textoPeriodo: {
    fontSize: 13,
    color: '#495057',
    fontWeight: '500',
  },
  textoPeriodoActivo: {
    color: '#fff',
    fontWeight: 'bold',
  },
});