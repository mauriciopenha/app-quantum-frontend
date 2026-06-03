import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity, TextInput, Modal } from 'react-native';
import api from '../api'; 
import EmpresaLoader from './EmpresaLoader';

export default function MaterialInventoryScreen({ token, navigation }) {
  const [materiales, setMateriales] = useState([]);
  const [materialesFiltrados, setMaterialesFiltrados] = useState([]);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  // NUEVOS ESTADOS PARA EL MODAL DE DISTRIBUCIÓN
  const [modalVisible, setModalVisible] = useState(false);
  const [cargandoModal, setCargandoModal] = useState(false);
  const [materialSeleccionado, setMaterialSeleccionado] = useState('');
  const [unidadSeleccionada, setUnidadSeleccionada] = useState('');
  const [proyectosDistribucion, setProyectosDistribucion] = useState([]);

  const obtenerInventario = async () => {
    try {
      setCargando(true);
      if (!token) {
        Alert.alert("Error", "Sesión no válida.");
        return;
      }

      const response = await api.get('inventario/materiales/');
      setMateriales(response.data);
      setMaterialesFiltrados(response.data);
      setTextoBusqueda(''); 
    } catch (error) {
      console.error("Error al obtener inventario:", error);
      Alert.alert("Error", "No se pudo conectar con la bodega.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerInventario();
  }, []);

  // CONSULTAR EL NUEVO ENDPOINT DE DISTRIBUCIÓN
  const verDistribucionMaterial = async (material) => {
    try {
      setMaterialSeleccionado(material.nombre);
      setUnidadSeleccionada(material.unidad_medida.toUpperCase());
      setProyectosDistribucion([]);
      setModalVisible(true);
      setCargandoModal(true);

      const res = await api.get(`inventario/materiales/${material.id}/proyectos/`);
      setProyectosDistribucion(res.data.distribucion || []);
    } catch (error) {
      console.error("Error obteniendo distribución:", error);
      Alert.alert("Error", "No se pudo consultar el desglose de proyectos.");
      setModalVisible(false);
    } finally {
      setCargandoModal(false);
    }
  };

  const handleBuscar = (texto) => {
    setTextoBusqueda(texto);
    if (texto.trim() === '') {
      setMaterialesFiltrados(materiales);
    } else {
      const listaFiltrada = materiales.filter(item => 
        item.nombre.toLowerCase().includes(texto.toLowerCase()) ||
        (item.descripcion && item.descripcion.toLowerCase().includes(texto.toLowerCase()))
      );
      setMaterialesFiltrados(listaFiltrada);
    }
  };

  const renderItem = ({ item }) => {
    const stockBajo = item.stock_bodega <= 5; 

    return (
      /* CONVERTIMOS LA TARJETA EN UN BOTÓN INTERACTIVO */
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => verDistribucionMaterial(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.materialName}>{item.nombre}</Text>
          <Text style={styles.unidadBadge}>{item.unidad_medida.toUpperCase()}</Text>
        </View>

        <Text style={styles.descripcionText}>
          {item.descripcion ? item.descripcion : "Sin descripción de material."}
        </Text>

        <View style={styles.stockContainer}>
          <Text style={styles.stockLabel}>En Bodega:</Text>
          <Text style={[styles.stockValue, stockBajo ? styles.stockAlerta : styles.stockOk]}>
            {item.stock_bodega}
          </Text>
        </View>
        
        <View style={styles.cardFooterHint}>
          <Text style={styles.hintTexto}>🔍 Toca para ver en qué obras está asignado →</Text>
        </View>

        {item.proveedor ? (
          <Text style={styles.proveedorText}>📦 Prov: {item.proveedor}</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventario de Materiales</Text>

      <View style={styles.buscadorContainer}>
        <TextInput
          style={styles.buscadorInput}
          placeholder="🔍 Buscar material por nombre..."
          placeholderTextColor="#7A7B80"
          value={textoBusqueda}
          onChangeText={handleBuscar}
          clearButtonMode="while-editing"
        />
      </View>

      {cargando ? (
        <View style={{ marginTop: 40, alignItems: 'center', justifyContent: 'center' }}>
          <EmpresaLoader />
        </View>
      ) : (
        <FlatList
          data={materialesFiltrados} 
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          onRefresh={obtenerInventario}
          refreshing={cargando}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No se encontraron materiales.</Text>
          }
        />
      )}

      {/* MODAL INYECTADO PARA VER LA DISTRIBUCIÓN POR PROYECTO */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalCentrado}>
          <View style={styles.modalContenido}>
            
            {/* Cabecera del modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalSubtitulo}>Distribución en Terreno</Text>
              <Text style={styles.modalTituloMaterial}>{materialSeleccionado}</Text>
            </View>

            {/* Cuerpo con indicador de carga o lista */}
            {/* Cuerpo con indicador de carga o lista */}
            {cargandoModal ? (
              <View style={styles.modalCargaCaja}>
                <EmpresaLoader /> {/* 🔌 Cambiado por el tuyo */}
                <Text style={styles.modalCargaTexto}>Cruzando datos de logística...</Text>
              </View>
            ) : (
              <FlatList
                data={proyectosDistribucion}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.filaProyectoModal}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.nombreProyectoModal}>🚧 {item.proyecto_nombre}</Text>
                    </View>
                    <View style={styles.badgeCantidadModal}>
                      <Text style={styles.badgeTextoModal}>{item.cantidad_en_obra} {unidadSeleccionada}</Text>
                    </View>
                  </View>
                )}
                contentContainerStyle={{ paddingVertical: 10 }}
                ListEmptyComponent={
                  <View style={styles.modalVacioCaja}>
                    <Text style={styles.modalVacioTexto}>📦 Todo este material se encuentra resguardado en la Bodega Principal (No hay salidas activas a frentes de obra).</Text>
                  </View>
                }
              />
            )}

            {/* Botón de cierre */}
            <TouchableOpacity 
              style={styles.btnCerrarModal} 
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.btnCerrarModalTexto}>Entendido</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      <TouchableOpacity 
        style={styles.botonFlotante}
        onPress={() => navigation('movement')}
      >
        <Text style={styles.botonTexto}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', paddingTop: 15, paddingHorizontal: 15 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#2D2E31', marginBottom: 15, textAlign: 'center' },
  buscadorContainer: { marginBottom: 15, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#E1E5EB', elevation: 2 },
  buscadorInput: { paddingVertical: 10, paddingHorizontal: 15, fontSize: 15, color: '#2D2E31' },
  listContainer: { paddingBottom: 90 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  materialName: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', flex: 1, marginRight: 10 },
  unidadBadge: { fontSize: 11, fontWeight: 'bold', color: '#7A7B80', backgroundColor: '#EAEAEA', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  descripcionText: { fontSize: 13, color: '#6c757d', marginBottom: 12 },
  stockContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#F1F3F5', paddingTop: 10 },
  stockLabel: { fontSize: 14, color: '#495057', fontWeight: '500' },
  stockValue: { fontSize: 18, fontWeight: 'bold' },
  stockOk: { color: '#2E7D32' },
  stockAlerta: { color: '#D32F2F' },
  proveedorText: { fontSize: 11, color: '#9E9E9E', marginTop: 6, fontStyle: 'italic' },
  emptyText: { textAlign: 'center', color: '#6c757d', marginTop: 40, fontSize: 16 },
  botonFlotante: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#87C442', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  botonTexto: { color: '#fff', fontSize: 28, fontWeight: 'bold', lineHeight: 30 },
  
  // NUEVOS INDICADORES EN LA TARJETA
  cardFooterHint: { marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F8F9FA' },
  hintTexto: { fontSize: 12, color: '#2196F3', fontWeight: '600', textAlign: 'right' },

  // ESTILOS DEL MODAL (DESPLIEGUE DESDE ABAJO)
  modalCentrado: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContenido: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingVertical: 22, maxHeight: '75%', minHeight: '40%' },
  modalHeader: { backgroundColor: '#E8F5E9', padding: 14, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#C8E6C9' },
  modalSubtitulo: { fontSize: 11, fontWeight: 'bold', color: '#2E7D32', textTransform: 'uppercase' },
  modalTituloMaterial: { fontSize: 16, fontWeight: 'bold', color: '#1B5E20', marginTop: 2 },
  modalCargaCaja: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  modalCargaTexto: { marginTop: 10, fontSize: 14, color: '#2196F3', fontWeight: '500' },
  
  // Filas internas del modal
  filaProyectoModal: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, marginBottom: 8, alignItems: 'center', borderHorizontalWidth: 1, borderColor: '#E1E5EB' },
  nombreProyectoModal: { fontSize: 14, fontWeight: '600', color: '#333' },
  badgeCantidadModal: { backgroundColor: '#2196F3', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  badgeTextoModal: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  modalVacioCaja: { padding: 30, alignItems: 'center' },
  modalVacioTexto: { fontSize: 13, color: '#7A7B80', textAlign: 'center', lineHeight: 18 },
  
  // Botón de cierre
  btnCerrarModal: { backgroundColor: '#2E2E31', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 15 },
  btnCerrarModalTexto: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});