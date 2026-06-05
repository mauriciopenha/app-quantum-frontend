import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import api from '../api';
import EmpresaLoader from './EmpresaLoader';

export default function ProjectChecklistScreen({ token, onVolver }) {
  const [cargando, setCargando] = useState(true);
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  // 1. Cargar la lista de proyectos desde el backend
  const cargarProyectos = async () => {
    try {
      setCargando(true);
      // ⚠️ Ajusta la URL si en tu urls.py general tiene un prefijo (ej: 'inventario/proyectos/')
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

  // 2. Cargar el checklist de un proyecto específico al picarlo
  const seleccionarProyecto = async (proyecto) => {
    try {
      setCargando(true);
      
      // 🟢 Asegúrate de que termine en barra diagonal '/' al final
      const res = await api.get(`inventario/proyectos/${proyecto.id}/checklist/`);
      
      setChecklist(res.data.checklist || []);
      setProyectoSeleccionado(proyecto);
    } catch (error) {
      console.error("Error cargando etapas del proyecto:", error);
      Alert.alert("Error", "Este proyecto no tiene etapas asignadas o la ruta es inválida.");
    } finally {
      setCargando(false);
    }
  };

  const proyectosFiltrados = proyectos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Renders de la interfaz
  const renderItemProyecto = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => seleccionarProyecto(item)}>
      <Text style={styles.cardTitulo}>🏗️ {item.nombre}</Text>
      <Text style={styles.cardLink}>Ver avance técnico →</Text>
    </TouchableOpacity>
  );

  const renderItemEtapa = ({ item }) => {
    let colorIndicador = '#DC3545'; // ROJO
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

  if (cargando && proyectos.length === 0) {
    return (
      <View style={styles.centro}>
        <EmpresaLoader />
        <Text style={styles.textoCarga}>Cargando frentes de obra...</Text>
      </View>
    );
  }

  // VISTA 2: VER EL AVANCE DEL CHECKLIST DEL PROYECTO SELECCIONADO
  if (proyectoSeleccionado) {
    return (
      <View style={styles.container}>
        <View style={styles.headerProyecto}>
          <Text style={styles.headerSub}>Checklist de Instalación</Text>
          <Text style={styles.headerTitle}>{proyectoSeleccionado.nombre}</Text>
        </View>

        {cargando ? (
          <View style={styles.centro}>
            <EmpresaLoader />
          </View>
        ) : (
          <FlatList
            data={checklist}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItemEtapa}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <Text style={styles.textoVacio}>No hay etapas registradas para este proyecto.</Text>
            }
          />
        )}

        <TouchableOpacity style={styles.btnVolver} onPress={() => setProyectoSeleccionado(null)}>
          <Text style={styles.btnVolverTexto}>← Volver a la Lista</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // VISTA 1: LISTA GENERAL DE PROYECTOS EN EL NUEVO MÓDULO
  return (
    <View style={styles.container}>
      <Text style={styles.tituloSeccion}>Selecciona una obra para ver su avance:</Text>
      
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
  headerSub: { fontSize: 11, fontWeight: 'bold', color: '#D35400', textTransform: 'uppercase' },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#A04000', marginTop: 2 },

  filaEtapa: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E1E5EB', alignItems: 'center' },
  barraColor: { width: 6, height: '100%', minHeight: 45, borderRadius: 3 },
  etapaNombre: { fontSize: 14, fontWeight: '600', color: '#2D2E31' },
  etapaProgreso: { fontSize: 12, color: '#7A7B80', marginTop: 2 },
  etapaNotas: { fontSize: 11, color: '#546E7A', fontStyle: 'italic', marginTop: 4 },
  btnEditar: { padding: 10, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#CFD8DC', marginLeft: 10 },

  textoVacio: { fontSize: 14, color: '#7A7B80', textAlign: 'center', marginTop: 20 },
  btnVolver: { backgroundColor: '#495057', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  btnVolverTexto: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});