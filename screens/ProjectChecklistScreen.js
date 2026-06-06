import React, { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, Alert, Modal, ScrollView } from 'react-native';
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

  // 🎛️ NUEVOS ESTADOS SEGUROS PARA LA VENTANA MODAL (EL LAPICITO)
  const [modalVisible, setModalVisible] = useState(false);
  const [etapaSeleccionada, setEtapaSeleccionada] = useState(null);
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState('');
  const [laborDelDia, setLaborDelDia] = useState('');
  const [guardandoProgreso, setGuardandoProgreso] = useState(false);

  // 📸 ESTADO PARA ALMACENAR LA FOTO SELECCIONADA
  const [foto, setFoto] = useState(null);

  // 👁️ NUEVOS ESTADOS SEGUROS PARA EL VISUALIZADOR DE REPORTES GUARDADOS
  const [modalVerReporteVisible, setModalVerReporteVisible] = useState(false);
  const [etapaVerReporte, setEtapaVerReporte] = useState(null);

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

  // 🎛️ NUEVA ACCIÓN: Abrir modal preparando los datos de la etapa seleccionada
  const abrirEditorEtapa = (etapa) => {
    setEtapaSeleccionada(etapa);
    setNuevoPorcentaje(etapa.porcentaje_avance.toString());
    setLaborDelDia(''); // Siempre inicia limpio para reportar el trabajo de hoy
    setFoto(null);      // Limpia la foto anterior para el nuevo reporte
    setModalVisible(true);
  };

  // 👁️ NUEVA ACCIÓN: Abrir modal para ver los datos del último reporte guardado
  const abrirVisualizadorReporte = (etapa) => {
    setEtapaVerReporte(etapa);
    setModalVerReporteVisible(true);
  };

  // 📸 ACCONES MULTIMEDIA: CAMARA Y GALERÍA NATIVA
  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para capturar la evidencia.');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setFoto(result.assets[0].uri);
    }
  };

  const seleccionarDeGaleria = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería para seleccionar imágenes.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!result.canceled) {
      setFoto(result.assets[0].uri);
    }
  };

  // 🎛️ NUEVA ACCIÓN: Guardar bitácora acumulativa y porcentaje en el backend (Modificado para Multimedia)
  const guardarCambiosEtapa = async () => {
    const porcentajeNum = parseInt(nuevoPorcentaje);
    if (isNaN(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100) {
      Alert.alert("Dato Inválido", "El porcentaje de avance debe ser un número entero entre 0 y 100.");
      return;
    }

    try {
      setGuardandoProgreso(true);

      // Usamos FormData obligatorio para transportar archivos binarios al Backend
      const formData = new FormData();
      formData.append('etapa_id', etapaSeleccionada.id);
      formData.append('porcentaje_avance', porcentajeNum);
      formData.append('notes_progreso', laborDelDia); // Mantenemos compatibilidad con tu backend
      formData.append('notas_progreso', laborDelDia);

      // Si el técnico capturó una foto, la empaquetamos correctamente
      if (foto) {
        const filename = foto.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;

        formData.append('foto', {
          uri: foto,
          name: filename,
          type: type,
        });
      }

      // Envío multipart/form-data a la API
      const res = await api.post(
        `inventario/proyectos/${proyectoSeleccionado.id}/checklist/`, 
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      // Invocamos una consulta directa de refresco al servidor para traer las URLs de archivos recién creadas
      const resChecklist = await api.get(`inventario/proyectos/${proyectoSeleccionado.id}/checklist/`);
      setChecklist(resChecklist.data.checklist || []);

      setModalVisible(false);
      setFoto(null); // Reseteo preventivo seguro
      Alert.alert("¡Éxito!", "El reporte de labor diaria y la evidencia multimedia fueron registrados.");
    } catch (error) {
      console.error("Error actualizando etapa con foto:", error);
      Alert.alert("Error", "No se pudieron guardar los cambios en el servidor.");
    } finally {
      setGuardandoProgreso(false);
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
      // 👁️ Enlazamos la tarjeta completa a la visualización del último reporte guardado
      <TouchableOpacity style={styles.filaEtapa} onPress={() => abrirVisualizadorReporte(item)}>
        <View style={[styles.barraColor, { backgroundColor: colorIndicador }]} />
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text style={styles.etapaNombre}>{item.nombre_etapa}</Text>
          <Text style={styles.etapaProgreso}>Progreso: {item.porcentaje_avance}%</Text>
          {item.notas_progreso ? (
            <Text style={styles.etapaNotas} numberOfLines={2}>📝 {item.notas_progreso.replace(/\n/g, ' | ')}</Text>
          ) : (
            <Text style={[styles.etapaNotas, { color: '#AAA', fontStyle: 'italic' }]}>Sin reportes previos. Toca para ver.</Text>
          )}
        </View>
        <TouchableOpacity 
          style={styles.btnEditar}
          onPress={() => abrirEditorEtapa(item)}
        >
          <Text style={{ fontSize: 16 }}>✏️</Text>
        </TouchableOpacity>
      </TouchableOpacity>
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

        {/* 🪟 VENTANA MODAL INTEGRADA PARA EL REPORTE DIARIO DE LABOR */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.capaFondoModal}>
            <View style={styles.contenidoModal}>
              {etapaSeleccionada && (
                <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitulo}>Reportar Labor Diaria</Text>
                  <Text style={styles.modalSubtitulo}>Etapa: {etapaSeleccionada.nombre_etapa}</Text>

                  {/* Campo Numérico para porcentaje */}
                  <Text style={styles.modalLabel}>Porcentaje de Avance General (0-100%):</Text>
                  <TextInput
                    style={styles.modalInputCorto}
                    keyboardType="numeric"
                    maxLength={3}
                    value={nuevoPorcentaje}
                    onChangeText={setNuevoPorcentaje}
                  />

                  {/* Campo de texto multilínea para la labor de la cuadrilla */}
                  <Text style={styles.modalLabel}>¿Qué labor técnica se realizó hoy?:</Text>
                  <TextInput
                    style={styles.modalInputLargo}
                    multiline={true}
                    numberOfLines={3}
                    placeholder="Ej: Se instalaron 20 soportes en ele y 5 rieles."
                    placeholderTextColor="#999"
                    value={laborDelDia}
                    onChangeText={setLaborDelDia}
                  />

                  {/* 📸 SECCIÓN ADICIONADA: ADJUNTAR EVIDENCIA FOTOGRÁFICA */}
                  <Text style={styles.modalLabel}>Evidencia Fotográfica de Obra:</Text>
                  <View style={styles.camaraBotonera}>
                    <TouchableOpacity onPress={tomarFoto} style={styles.btnCamaraAccion}>
                      <Text style={styles.btnCamaraTexto}>📸 Cámara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={seleccionarDeGaleria} style={[styles.btnCamaraAccion, { backgroundColor: '#546E7A' }]}>
                      <Text style={styles.btnCamaraTexto}>🖼️ Galería</Text>
                    </TouchableOpacity>
                  </View>

                  {foto && (
                    <View style={styles.contenedorPreview}>
                      <Image source={{ uri: foto }} style={styles.fotoPreview} />
                      <TouchableOpacity onPress={() => setFoto(null)} style={styles.btnBorrarFoto}>
                        <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 12 }}>Quitar Foto ❌</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Historial acumulado en scrollview interno para no estorbar la pantalla */}
                  {etapaSeleccionada.notes_progreso || etapaSeleccionada.notas_progreso ? (
                    <View style={styles.contenedorHistorial}>
                      <Text style={styles.labelHistorial}>Último Historial Registrado:</Text>
                      <Text style={styles.textoHistorial}>
                        {etapaSeleccionada.notas_progreso || etapaSeleccionada.notes_progreso}
                      </Text>
                    </View>
                  ) : null}

                  {/* Botonera inferior de control */}
                  <View style={styles.modalBotonera}>
                    <TouchableOpacity 
                      style={[styles.modalBtn, styles.modalBtnCancelar]} 
                      onPress={() => setModalVisible(false)}
                      disabled={guardandoProgreso}
                    >
                      <Text style={styles.btnTextoBlanco}>Cancelación</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[styles.modalBtn, styles.modalBtnGuardar]} 
                      onPress={guardarCambiosEtapa}
                      disabled={guardandoProgreso}
                    >
                      <Text style={styles.btnTextoBlanco}>
                        {guardandoProgreso ? "Guardando..." : "Guardar Reporte"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* 👁️ NUEVA VENTANA MODAL INTEGRADA PARA VISUALIZAR EL REPORTE REAL (AL TOCAR LA TARJETA) */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={modalVerReporteVisible}
          onRequestClose={() => setModalVerReporteVisible(false)}
        >
          <View style={styles.capaFondoModal}>
            <View style={styles.contenidoModal}>
              {etapaVerReporte && (
                <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitulo}>Detalle de Avance Guardado</Text>
                  <Text style={[styles.modalSubtitulo, { color: '#0284c7' }]}>Etapa: {etapaVerReporte.nombre_etapa}</Text>

                  <View style={styles.contenedorDetalleInfo}>
                    <Text style={styles.modalLabel}>Progreso Actualizado en Obra:</Text>
                    <Text style={styles.textoDestacadoProgreso}>{etapaVerReporte.porcentaje_avance}% Completado</Text>

                    <Text style={styles.modalLabel}>Última Labor Técnica Registrada:</Text>
                    <View style={styles.cajaNotasGuardadas}>
                      <Text style={styles.textoNotasGuardadas}>
                        {etapaVerReporte.notas_progreso ? etapaVerReporte.notas_progreso : "No se registraron comentarios escritos en esta bitácora."}
                      </Text>
                    </View>

                    <Text style={styles.modalLabel}>Evidencia Multimedia en Servidor:</Text>
                    {etapaVerReporte.foto_evidencia_url ? (
                      <Image 
                        source={{ uri: etapaVerReporte.foto_evidencia_url }} 
                        style={styles.fotoEvidenciaBackend} 
                      />
                    ) : (
                      <View style={styles.sinFotoContenedor}>
                        <Text style={{ color: '#78909C', fontSize: 13, fontWeight: '500' }}>⚠️ No hay registros fotográficos adjuntos.</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ marginTop: 25 }}>
                    <TouchableOpacity 
                      style={[styles.modalBtn, { backgroundColor: '#455A64', width: '100%' }]} 
                      onPress={() => setModalVerReporteVisible(false)}
                    >
                      <Text style={styles.btnTextoBlanco}>Cerrar Vista</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

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

  pestanasPrincipales: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#ECEFF1', marginBottom: 15 },
  tabPrincipal: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabPrincipalActiva: { borderBottomColor: '#87C442' },
  tabPrincipalTexto: { fontSize: 14, fontWeight: '600', color: '#78909C' },
  tabPrincipalTextoActivo: { color: '#87C442', fontWeight: 'bold' },

  subPasosContainer: { flexDirection: 'row', backgroundColor: '#ECEFF1', padding: 4, borderRadius: 10, marginBottom: 15 },
  subPasoBoton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  subPasoBotonActivo: { backgroundColor: '#FFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  subPasoTexto: { fontSize: 13, fontWeight: '600', color: '#78909C' },
  subPasoTextoActivo: { color: '#2196F3', fontWeight: 'bold' },

  filaEtapa: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E1E5EB', alignItems: 'center' },
  barraColor: { width: 6, height: '100%', minHeight: 45, borderRadius: 3 },
  etapaNombre: { fontSize: 14, fontWeight: '600', color: '#2D2E31' },
  etapaProgreso: { fontSize: 12, color: '#7A7B80', marginTop: 2 },
  etapaNotas: { fontSize: 11, color: '#546E7A', fontStyle: 'italic', marginTop: 4 },
  btnEditar: { padding: 10, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#CFD8DC', marginLeft: 10 },

  materialFila: { flexDirection: 'row', backgroundColor: '#FFF', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center', justifyContent: 'space-between' },
  materialNombre: { fontSize: 15, fontWeight: '600', color: '#2D2E31' },
  materialUnidad: { fontSize: 12, color: '#7A7B80', marginTop: 2 },
  badgeCantidad: { backgroundColor: '#87C442', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeTexto: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  capaFondoModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, paddingVertical: 30 },
  contenidoModal: { width: '100%', maxHeight: '90%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: '#2D2E31', marginBottom: 5, textAlign: 'center' },
  modalSubtitulo: { fontSize: 14, fontWeight: '600', color: '#F39C12', marginBottom: 15, textAlign: 'center' },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#546E7A', marginBottom: 6, marginTop: 12 },
  modalInputCorto: { width: 80, backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#CFD8DC', borderRadius: 8, padding: 8, fontSize: 16, textAlign: 'center', color: '#333' },
  modalInputLargo: { width: '100%', backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#CFD8DC', borderRadius: 8, padding: 12, fontSize: 14, color: '#333', textAlignVertical: 'top' },
  
  camaraBotonera: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  btnCamaraAccion: { backgroundColor: '#0284c7', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8, flex: 0.48, alignItems: 'center' },
  btnCamaraTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  contenedorPreview: { width: '100%', alignItems: 'center', marginVertical: 10 },
  fotoPreview: { width: '100%', height: 160, borderRadius: 8, resizeMode: 'cover' },
  btnBorrarFoto: { backgroundColor: '#ef4444', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 5, marginTop: 6 },

  contenedorHistorial: { width: '100%', backgroundColor: '#ECEFF1', borderRadius: 8, padding: 10, marginTop: 15, borderWidth: 1, borderColor: '#CFD8DC' },
  labelHistorial: { fontSize: 11, fontWeight: 'bold', color: '#78909C', marginBottom: 4, textTransform: 'uppercase' },
  textoHistorial: { fontSize: 12, color: '#455A64', lineHeight: 16 },

  // 👁️ ESTILOS ADICIONADOS PARA EL VISUALIZADOR DE REPORTES GUARDADOS
  contenedorDetalleInfo: { width: '100%', marginTop: 5 },
  textoDestacadoProgreso: { fontSize: 18, fontWeight: 'bold', color: '#87C442', marginVertical: 6 },
  cajaNotasGuardadas: { width: '100%', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E1E5EB' },
  textoNotasGuardadas: { fontSize: 14, color: '#333', lineHeight: 20 },
  fotoEvidenciaBackend: { width: '100%', height: 210, borderRadius: 10, marginTop: 10, resizeMode: 'cover', borderWidth: 1, borderColor: '#CFD8DC' },
  sinFotoContenedor: { width: '100%', backgroundColor: '#F1F3F5', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#CFD8DC', borderStyle: 'dashed' },

  modalBotonera: { flexDirection: 'row', marginTop: 20, width: '100%', gap: 10, marginBottom: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancelar: { backgroundColor: '#90A4AE' },
  modalBtnGuardar: { backgroundColor: '#87C442' },
  btnTextoBlanco: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  textoVacio: { fontSize: 14, color: '#7A7B80', textAlign: 'center', marginTop: 20, paddingHorizontal: 10 },
  btnVolver: { backgroundColor: '#495057', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  btnVolverTexto: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});