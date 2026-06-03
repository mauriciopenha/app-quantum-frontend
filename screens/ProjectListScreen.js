import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import api from '../api';
import EmpresaLoader from './EmpresaLoader';

export default function ProjectListScreen({ token }) {
  const [cargandoProyectos, setCargandoProyectos] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  
  // Estados de la base de datos (Django)
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  
  // SEPARACIÓN DE MATERIALES POR ORIGEN
  const [materialesBodega, setMaterialesBodega] = useState([]);
  const [materialesCompra, setMaterialesCompra] = useState([]);

  // CONTROL DEL PASO / ORIGEN ACTIVO: 'BODEGA' o 'COMPRA_DIRECTA'
  const [origenSeleccionado, setOrigenSeleccionado] = useState('BODEGA');

  // NUEVOS ESTADOS PARA MANEJAR LAS BÚSQUEDAS
  const [busquedaProyecto, setBusquedaProyecto] = useState('');
  const [busquedaMaterial, setBusquedaMaterial] = useState('');

  // 1. CARGA INICIAL: Traer todos los proyectos
  const cargarProyectos = async () => {
    try {
      setCargandoProyectos(true);
      const res = await api.get('inventario/proyectos/');
      setProyectos(res.data);
    } catch (error) {
      console.error("Error obteniendo proyectos:", error);
      Alert.alert("Sesión Expirada", "Tu sesión ha caducado. Por favor, vuelve a iniciar sesión.");
    } finally {
      setCargandoProyectos(false);
    }
  };

  useEffect(() => {
    cargarProyectos();
  }, [token]);

  // 2. PETICIÓN AL ENDPOINT: Traer listas separadas
  const verDetalleProyecto = async (proyecto) => {
    try {
      setCargandoDetalle(true);
      setOrigenSeleccionado('BODEGA'); // Resetea siempre al primer paso al cambiar de obra
      setBusquedaMaterial(''); // Limpia búsquedas previas
      
      const res = await api.get(`inventario/proyectos/${proyecto.id}/materiales/`);
      
      setProyectoSeleccionado(proyecto.nombre);
      // Guardamos en sus respectivas cajas independientes
      setMaterialesBodega(res.data.salido_bodega || []);
      setMaterialesCompra(res.data.compra_directa || []);
    } catch (error) {
      console.error("Error cargando materiales del proyecto:", error);
      Alert.alert("Error", "No se pudo consultar el inventario asignado a esta obra.");
    } finally {
      setCargandoDetalle(false);
    }
  };

  // LÓGICA DE FILTRADO EN MEMORIA (REACTIVOS)
  const proyectosFiltrados = proyectos.filter(proy => 
    proy.nombre.toLowerCase().includes(busquedaProyecto.toLowerCase())
  );

  // Filtra dinámicamente según la pestaña en la que estés parado
  const materialesFiltrados = (origenSeleccionado === 'BODEGA' ? materialesBodega : materialesCompra).filter(mat => 
    mat.nombre.toLowerCase().includes(busquedaMaterial.toLowerCase())
  );

  // Cantidad total en la pestaña actual para controlar el buscador/mensajes vacíos
  const totalMaterialesPestaña = origenSeleccionado === 'BODEGA' ? materialesBodega.length : materialesCompra.length;

  // RENDERIZADO DE CADA TARJETA DE PROYECTO (VISTA 1)
  const renderTarjetaProyecto = ({ item }) => (
    <TouchableOpacity 
      style={styles.cardProyecto} 
      onPress={() => verDetalleProyecto(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardIcon}>🚧</Text>
        <Text style={styles.cardTitulo} numberOfLines={2}>{item.nombre}</Text>
      </View>
      <Text style={styles.cardSubtexto}>Toca para revisar materiales asignados →</Text>
    </TouchableOpacity>
  );

  // RENDERIZADO DE CADA FILA DE MATERIAL EN OBRA (VISTA 2)
  const renderFilaMaterial = ({ item }) => (
    <View style={styles.materialFila}>
      <View style={{ flex: 1 }}>
        <Text style={styles.materialNombre}>{item.nombre}</Text>
        <Text style={styles.materialUnidad}>Unidad: {item.unidad_medida ? item.unidad_medida.toUpperCase() : 'UND'}</Text>
      </View>
      <View style={[styles.badgeCantidad, origenSeleccionado === 'COMPRA_DIRECTA' && { backgroundColor: '#FF9800' }]}>
        <Text style={styles.badgeTexto}>{item.cantidad_en_obra}</Text>
      </View>
    </View>
  );

  // PANTALLA DE CARGA PRINCIPAL
  if (cargandoProyectos) {
    return (
      <View style={styles.pantallaCentro}>
        <EmpresaLoader /> {/* 🔌 Cambiado */}
        <Text style={styles.textoCarga}>Sincronizando frentes de obra...</Text>
      </View>
    );
  }

  // INTERFAZ CONDICIONAL: SI PICÓ UN PROYECTO, MUESTRA EL DESGLOSE DE MATERIALES
  if (proyectoSeleccionado !== null) {
    return (
      <View style={styles.container}>
        {/* Encabezado del Detalle */}
        <View style={styles.headerDetalle}>
          <Text style={styles.subtituloDetalle}>Inventario en Obra</Text>
          <Text style={styles.tituloProyectoDetalle}>{proyectoSeleccionado}</Text>
        </View>

        {/* --- PASOS / SELECTOR DE ORIGEN (La pregunta visual) --- */}
        <View style={styles.pasosContainer}>
          <TouchableOpacity 
            style={[styles.pasoBoton, origenSeleccionado === 'BODEGA' && styles.pasoBotonActivo]}
            onPress={() => { setOrigenSeleccionado('BODEGA'); setBusquedaMaterial(''); }}
          >
            <Text style={[styles.pasoTexto, origenSeleccionado === 'BODEGA' && styles.pasoTextoActivo]}>
              🏢 Salido de Bodega
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.pasoBoton, origenSeleccionado === 'COMPRA_DIRECTA' && styles.pasoBotonActivo]}
            onPress={() => { setOrigenSeleccionado('COMPRA_DIRECTA'); setBusquedaMaterial(''); }}
          >
            <Text style={[styles.pasoTexto, origenSeleccionado === 'COMPRA_DIRECTA' && styles.pasoTextoActivo]}>
              🛒 Compra Directa
            </Text>
          </TouchableOpacity>
        </View>

        {/* BUSCADOR INTERNO DE MATERIALES */}
        {!cargandoDetalle && totalMaterialesPestaña > 0 && (
          <TextInput
            style={styles.inputBuscador}
            placeholder={`🔍 Buscar en ${origenSeleccionado === 'BODEGA' ? 'salidas de bodega' : 'compras directas'}...`}
            placeholderTextColor="#9E9E9E"
            value={busquedaMaterial}
            onChangeText={setBusquedaMaterial}
          />
        )}

        {cargandoDetalle ? (
          <View style={{ 
            justifyContent: 'center', 
            alignItems: 'center', 
            paddingVertical: 50,  // 🛠️ Espacio vertical holgado para que el loader respire
            minHeight: 220        // 🛠️ Altura mínima forzada para que el icono se dibuje completo
          }}>
            <EmpresaLoader />
            <Text style={[styles.textoCarga, { color: '#2196F3', marginTop: 15 }]}>
              Calculando materiales en terreno...
            </Text>
          </View>
        ) : (
          <FlatList
            data={materialesFiltrados}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderFilaMaterial}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View style={styles.cajaVacia}>
                <Text style={styles.textoVacio}>
                  {totalMaterialesPestaña > 0 
                    ? "❌ No se encontraron materiales que coincidan con tu búsqueda."
                    : `📦 No hay registros de ${origenSeleccionado === 'BODEGA' ? 'materiales salidos de bodega' : 'compras directas'} en este proyecto.`}
                </Text>
              </View>
            }
          />
        )}

        {/* BOTÓN PARA VOLVER A LA LISTA DE PROYECTOS */}
        <TouchableOpacity 
          style={styles.btnVolver} 
          onPress={() => {
            setProyectoSeleccionado(null);
            setMaterialesBodega([]);
            setMaterialesCompra([]);
            setBusquedaMaterial('');
            cargarProyectos(); 
          }}
        >
          <Text style={styles.btnVolverTexto}>← Volver a Proyectos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // INTERFAZ PRINCIPAL: LISTA DE TARJETAS DE PROYECTOS WITH SEARCH BAR
  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>Frentes de Obra Activos</Text>
      
      {/* BUSCADOR PRINCIPAL DE PROYECTOS */}
      <TextInput
        style={styles.inputBuscador}
        placeholder="🔍 Escribe para buscar una obra o frente..."
        placeholderTextColor="#9E9E9E"
        value={busquedaProyecto}
        onChangeText={setBusquedaProyecto}
      />

      <FlatList
        data={proyectosFiltrados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTarjetaProyecto}
        contentContainerStyle={{ paddingBottom: 30 }}
        ListEmptyComponent={
          <View style={styles.cajaVacia}>
            <Text style={styles.textoVacio}>
              {proyectos.length > 0 
                ? "❌ No se encontraron frentes de obra con ese nombre."
                : "👷‍♂️ No se encontraron proyectos registrados en la base de datos."}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 15 },
  pantallaCentro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 40, },
  textoCarga: { marginTop: 12, color: '#7A7B80', fontSize: 14, fontWeight: '500' },
  mainTitle: { fontSize: 18, fontWeight: 'bold', color: '#2D2E31', marginBottom: 15, textAlign: 'center' },

  inputBuscador: {
    backgroundColor: '#F1F3F5',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    fontSize: 15,
    color: '#333',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E1E5EB'
  },

  cardProyecto: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E5EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardIcon: { fontSize: 20, marginRight: 10 },
  cardTitulo: { fontSize: 15, fontWeight: 'bold', color: '#333', flex: 1 },
  cardSubtexto: { fontSize: 12, color: '#2196F3', fontWeight: '600', textAlign: 'right' },

  headerDetalle: { backgroundColor: '#E3F2FD', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#BDE0FE' },
  subtituloDetalle: { fontSize: 11, fontWeight: 'bold', color: '#1565C0', textTransform: 'uppercase', letterSpacing: 0.5 },
  tituloProyectoDetalle: { fontSize: 16, fontWeight: 'bold', color: '#0D47A1', marginTop: 2 },
  
  // --- NUEVOS ESTILOS PARA LOS PASOS TIPO PESTAÑA ---
  pasosContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#ECEFF1', 
    padding: 4, 
    borderRadius: 10, 
    marginBottom: 15 
  },
  pasoBoton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  pasoBotonActivo: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  pasoTexto: { fontSize: 13, fontWeight: '600', color: '#78909C' },
  pasoTextoActivo: { color: '#2196F3', fontWeight: 'bold' },

  materialFila: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  materialNombre: { fontSize: 15, fontWeight: '600', color: '#2D2E31' },
  materialUnidad: { fontSize: 12, color: '#7A7B80', marginTop: 2 },
  badgeCantidad: { backgroundColor: '#87C442', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeTexto: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  cajaVacia: { alignItems: 'center', padding: 30, marginTop: 10 },
  textoVacio: { fontSize: 14, color: '#7A7B80', textAlign: 'center', lineHeight: 20 },
  btnVolver: { backgroundColor: '#495057', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 30 },
  btnVolverTexto: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});