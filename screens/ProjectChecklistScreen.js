import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import api from '../api';
import EmpresaLoader from './EmpresaLoader';

export default function ProjectChecklistScreen({ token, onVolver }) {
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  // 🎛️ CONTROL DE PESTAÑA PRINCIPAL: 'AVANCE' o 'MATERIALES'
  const [pestanaActiva, setPestanaActiva] = useState('AVANCE');

  // ESTADOS DEL MÓDULO 1: AVANCE (Checklist)
  const [checklist, setChecklist] = useState([]);

  // ESTADOS DEL MÓDULO 2: MATERIALES (Bodega vs Compra Directa)
  const [materialesBodega, setMaterialesBodega] = useState([]);
  const [materialesCompra, setMaterialesCompra] = useState([]);
  const [origenMaterial, setOrigenMaterial] = useState('BODEGA'); // 'BODEGA' o 'COMPRA'
  const [busquedaMaterial, setBusquedaMaterial] = useState('');

  // 1. Cargar la lista general de proyectos
  const cargarProyectos = async () => {
    try {
      setCargando(true);
      const res = await api.get('inventario/proyectos/'); 
      setProyectos(res.data);
    } catch (error) {
      console.error("Error obteniendo proyectos en checklist:", error);
      Alert.alert("Error", "No se pudo sincronizar la lista de frentes de obra.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProyectos();
  }, [token]);

  // 2. Cargar TODA la información del proyecto seleccionado (Checklist + Materiales en paralelo)
  const seleccionarProyecto = async (proyecto) => {
    try {
      setCargandoDetalle(true);
      setProyectoSeleccionado(proyecto);
      setPestanaActiva('AVANCE');      // Resetea a la primera pestaña siempre
      setOrigenMaterial('BODEGA');     // Resetea sub-pestaña de materiales
      setBusquedaMaterial('');         // Limpia buscador de materiales
      
      // Ejecutamos ambas peticiones al mismo tiempo para no hacer esperar al usuario 🚀
      const [resChecklist, resMateriales] = await Promise.all([
        api.get(`inventario/proyectos/${proyecto.id}/checklist/`),
        api.get(`inventario/proyectos/${proyecto.id}/materiales/`)
      ]);

      setChecklist(resChecklist.data.checklist || []);
      setMaterialesBodega(resMateriales.data.salido_bodega || []);
      setMaterialesCompra(resMateriales.data.compra_directa || []);
    } catch (error) {
      console.error("Error cargando datos integrales del proyecto:", error);
      Alert.alert("Error", "Hubo un problema al traer la información del proyecto.");
    } finally {
      setCargandoDetalle(false);
    }
  };

  // FILTRADOS EN MEMORIA
  const proyectosFiltrados = proyectos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const materialesFiltrados = (origenMaterial === 'BODEGA' ? materialesBodega : materialesCompra).filter(mat => 
    mat.nombre.toLowerCase().includes(busquedaMaterial.toLowerCase())
  );

  const totalMaterialesPestaña = origenMaterial === 'BODEGA' ? materialesBodega.length : materialesCompra.length;

  // RENDERS DE LISTAS
  const renderItemProyecto = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => seleccionarProyecto(item)}>
      <Text style={styles.cardTitulo}>🏗️ {item.nombre}</Text>
      <Text style={styles.cardLink}>Gestionar Obra →</Text>
    </TouchableOpacity>
  );

  const renderItemEtapa = ({ item }) => {
    let colorIndicador = '#DC3545';
    if (item.estado_color === 'VERDE') colorIndicador = '#87C442';
    if (item.estado_color === 'NARANJA') colorIndicador = '#FF9800';

    return (
      <View style={styles.filaEtapa}>
        <View style={[styles.barraColor, { backgroundColor: colorIndicador }]} />
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text style={styles.etapaNombre}>{item.nombre_etapa}</Text>
          <Text style={styles.etapaProgreso}>Progreso: {item.porcentaje_avance}%</Text>
          {item.notas_progreso ? <Text style={styles.etapaNotas}>📝 {item.notas_progreso}</Text> : null}
        </View>
        <TouchableOpacity 
          style={styles.btnEditar}
          onPress={() => Alert.alert("Modificar Avance", `Aquí cambiaremos el % de: \n${item.nombre_etapa}`)}
        >
          <Text style={{ fontSize: 16 }}>✏️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFilaMaterial = ({ item }) => (
    <View style={styles.materialFila}>
      <View style={{ flex: 1 }}>
        <Text style={styles.materialNombre}>{item.nombre}</Text>
        <Text style={styles.materialUnidad}>Unidad: {item.unidad_medida ? item.unidad_medida.toUpperCase() : 'UND'}</Text>
      </View>
      <View style={[styles.badgeCantidad, origenMaterial === 'COMPRA' && { backgroundColor: '#FF9800' }]}>
        <Text style={styles.badgeTexto}>{item.cantidad_en_obra}</Text>
      </View>
    </View>
  );

  if (cargando && proyectos.length === 0) {
    return (
      <View style={styles.centro}>
        <EmpresaLoader />
        <Text style={styles.textoCarga}>Sincronizando frentes de obra...</Text>
      </View>
    );
  }

  // 🚧 VISTA B: DETALLE INTEGRAL DEL PROYECTO SELECCIONADO
  if (proyectoSeleccionado) {
    return (
      <View style={styles.container}>
        
        {/* REQUERIMIENTO 1: TÍTULO DINÁMICO CON EL NOMBRE DEL PROYECTO */}
        <View style={styles.headerProyecto}>
          <Text style={styles.headerSub}>Frente de Obra Seleccionado</Text>
          <Text style={styles.headerTitle}>🏗️ {proyectoSeleccionado.nombre}</Text>
        </View>

        {/* REQUERIMIENTO 3: BOTONES DE AVANCE DE PROYECTO Y MATERIALES UTILIZADOS */}
        <View style={styles.pestanasPrincipales}>
          <TouchableOpacity 
            style={[styles.tabPrincipal, pestanaActiva === 'AVANCE' && styles.tabPrincipalActivo]}
            onPress={() => setPestanaActiva('AVANCE')}
          >
            <Text style={[styles.tabPrincipalTexto, pestanaActiva === 'AVANCE' && styles.tabPrincipalTextoActivo]}>
              📊 Avance de Proyecto
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabPrincipal, pestanaActiva === 'MATERIALES' && styles.tabPrincipalActivo]}
            onPress={() => setPestanaActiva('MATERIALES')}
          >
            <Text style={[styles.tabPrincipalTexto, pestanaActiva === 'MATERIALES' && styles.tabPrincipalTextoActivo]}>
              📦 Materiales Utilizados
            </Text>
          </TouchableOpacity>
        </View>

        {cargandoDetalle ? (
          <View style={styles.centro}>
            <EmpresaLoader />
            <Text style={styles.textoCarga}>Cargando datos del frente...</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            
            {/* SUB-VISTA INTERNA 1: CHECKLIST DE AVANCE */}
            {pestanaActiva === 'AVANCE' && (
              <FlatList
                data={checklist}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItemEtapa}
                contentContainerStyle={{ paddingBottom: 15 }}
                ListEmptyComponent={
                  <Text style={styles.textoVacio}>No hay etapas registradas para este proyecto.</Text>
                }
              />
            )}

            {/* REQUERIMIENTO 2 Y 3: SUB-VISTA INTERNA 2: MATERIALES CON SUB-BOTONES */}
            {pestanaActiva === 'MATERIALES' && (
              <View style={{ flex: 1 }}>
                
                {/* Sub-botones para el origen del material */}
                <View style={styles.subPasosContainer}>
                  <TouchableOpacity 
                    style={[styles.subPasoBoton, origenMaterial === 'BODEGA' && styles.subPasoBotonActivo]}
                    onPress={() => { setOrigenMaterial('BODEGA'); setBusquedaMaterial(''); }}
                  >
                    <Text style={[styles.subPasoTexto, origenMaterial === 'BODEGA' && styles.subPasoTextoActivo]}>
                      🏢 Salido de Bodega
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.subPasoBoton, origenMaterial === 'COMPRA' && styles.subPasoBotonActivo]}
                    onPress={() => { setOrigenMaterial('COMPRA'); setBusquedaMaterial(''); }}
                  >
                    <Text style={[styles.subPasoTexto, origenMaterial === 'COMPRA' && styles.subPasoTextoActivo]}>
                      🛒 Compra Directa
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Buscador de materiales */}
                {totalMaterialesPestaña > 0 && (
                  <TextInput
                    style={styles.buscador}
                    placeholder={`🔍 Buscar en ${origenMaterial === 'BODEGA' ? 'salidas de bodega' : 'compras directas'}...`}
                    placeholderTextColor="#9E9E9E"
                    value={busquedaMaterial}
                    onChangeText={setBusquedaMaterial}
                  />
                )}

                <FlatList
                  data={materialesFiltrados}
                  keyExtractor={(item) => item.id.toString()}
                  renderItem={renderFilaMaterial}
                  contentContainerStyle={{ paddingBottom: 15 }}
                  ListEmptyComponent={
                    <Text style={styles.textoVacio}>
                      {totalMaterialesPestaña > 0 
                        ? "❌ No se encontraron materiales en la búsqueda."
                        : `📦 No hay registros de materiales de esta categoría en la obra.`}
                    </Text>
                  }
                />
              </View>
            )}

          </View>
        )}

        <TouchableOpacity 
          style={styles.btnVolver} 
          onPress={() => {
            setProyectoSeleccionado(null);
            setChecklist([]);
            setMaterialesBodega([]);
            setMaterialesCompra([]);
            cargarProyectos();
          }}
        >
          <Text style={styles.btnVolverTexto}>← Volver a la Lista</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // 🏢 VISTA A: LISTA GENERAL DE PROYECTOS
  return (
    <View style={styles.container}>
      <Text style={styles.tituloSeccion}>Selecciona una obra para gestionar:</Text>
      
      <TextInput
        style={styles.buscador}
        placeholder="🔍 Buscar proyecto..."
        placeholderTextColor="#9E9E9E"
        value={busqueda}
        onChangeText={setBusqueda}
      />

      <FlatList
        data={proyectosFiltrados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItemProyecto}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.textoVacio}>No se encontraron proyectos activos.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 20, paddingTop: 15 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  textoCarga: { marginTop: 10, color: '#7A7B80', fontSize: 14, fontWeight: '500' },
  tituloSeccion: { fontSize: 15, fontWeight: '600', color: '#555', marginBottom: 15 },
  buscador: { backgroundColor: '#F1F3F5', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 10, fontSize: 15, color: '#333', marginBottom: 15, borderWidth: 1, borderColor: '#E1E5EB' },
  
  card: { backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E1E5EB', elevation: 1 },
  cardTitulo: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  cardLink: { fontSize: 12, color: '#F39C12', fontWeight: '600', marginTop: 8, textAlign: 'right' },
  
  headerProyecto: { backgroundColor: '#FFF9E6', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#FFEAA7' },
  headerSub: { fontSize: 11, fontWeight: 'bold', color: '#E67E22', textTransform: 'uppercase' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: '#D35400', marginTop: 2 },

  // Estilos de las pestañas principales
  pestanasPrincipales: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#ECEFF1', marginBottom: 15 },
  tabPrincipal: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabPrincipalActiva: { borderBottomColor: '#87C442' },
  tabPrincipalTexto: { fontSize: 14, fontWeight: '600', color: '#78909C' },
  tabPrincipalTextoActivo: { color: '#87C442', fontWeight: 'bold' },

  // Estilos de las sub-pestañas de materiales
  subPasosContainer: { flexDirection: 'row', backgroundColor: '#ECEFF1', padding: 4, borderRadius: 10, marginBottom: 15 },
  subPasoBoton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  subPasoBotonActivo: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  subPasoTexto: { fontSize: 13, fontWeight: '600', color: '#78909C' },
  subPasoTextoActivo: { color: '#2196F3', fontWeight: 'bold' },

  // Filas del checklist
  filaEtapa: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E1E5EB', alignItems: 'center' },
  barraColor: { width: 6, height: '100%', minHeight: 45, borderRadius: 3 },
  etapaNombre: { fontSize: 14, fontWeight: '600', color: '#2D2E31' },
  etapaProgreso: { fontSize: 12, color: '#7A7B80', marginTop: 2 },
  etapaNotas: { fontSize: 11, color: '#546E7A', fontStyle: 'italic', marginTop: 4 },
  btnEditar: { padding: 10, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#CFD8DC', marginLeft: 10 },

  // Filas de materiales utilizados
  materialFila: { flexDirection: 'row', backgroundColor: '#FFF', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center', justifyContent: 'space-between' },
  materialNombre: { fontSize: 15, fontWeight: '600', color: '#2D2E31' },
  materialUnidad: { fontSize: 12, color: '#7A7B80', marginTop: 2 },
  badgeCantidad: { backgroundColor: '#87C442', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeTexto: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  textoVacio: { fontSize: 14, color: '#7A7B80', textAlign: 'center', marginTop: 20, paddingHorizontal: 10 },
  btnVolver: { backgroundColor: '#495057', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  btnVolverTexto: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});