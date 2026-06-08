import React, { useState, useEffect, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, PanResponder, Animated, TextInput, Alert, Modal, ScrollView, Dimensions } from 'react-native';
import api from '../api';
import EmpresaLoader from './EmpresaLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 🖼️ COMPONENTE DE IMAGEN OPTIMIZADO CON VALIDADOR DE GESTOS COMPARTIDO
const VistaImagenConZoom = ({ uri, setCarruselBloqueado }) => {
  const escala = new Animated.Value(1);
  const ultimoIdDistancia = { current: 0 };

  const panResponder = useRef(
    PanResponder.create({
      // ❌ No interceptar el toque inicial con un solo dedo para dejar que FlatList deslice normalmente
      onStartShouldSetPanResponder: () => false,
      
      // 🤔 Interceptar el movimiento SOLO si hay exactamente 2 dedos en la pantalla (Intención de Zoom)
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const esGestoZoom = gestureState.numberActiveTouches === 2;
        if (esGestoZoom) {
          setCarruselBloqueado(true); // 🛑 Congela el FlatList inmediatamente
        }
        return esGestoZoom;
      },
      
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.numberActiveTouches === 2) {
          const touches = evt.nativeEvent.touches;
          if (touches && touches.length >= 2) {
            // Teorema de Pitágoras para medir la separación de los dedos
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const distancia = Math.sqrt(dx * dx + dy * dy);

            if (ultimoIdDistancia.current === 0) {
              ultimoIdDistancia.current = distancia;
            } else {
              const ratio = distancia / ultimoIdDistancia.current;
              let nuevaEscala = escala._value * ratio;
              
              // Acotar límites lógicos de visualización
              if (nuevaEscala < 1) nuevaEscala = 1;
              if (nuevaEscala > 4) nuevaEscala = 4;

              escala.setValue(nuevaEscala);
              ultimoIdDistancia.current = distancia;
            }
          }
        }
      },
      
      onPanResponderRelease: () => {
        ultimoIdDistancia.current = 0;
        setCarruselBloqueado(false); // 🔓 Libera el FlatList para que el usuario pueda deslizar de nuevo
        
        // Animación suave de retorno si la escala queda muy cercana al tamaño original
        if (escala._value < 1.1) {
          Animated.spring(escala, {
            toValue: 1,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        ultimoIdDistancia.current = 0;
        setCarruselBloqueado(false); // Asegurar desbloqueo ante interrupciones del sistema
      }
    })
  ).current;

  return (
    <View 
      style={{ width: SCREEN_WIDTH, height: '100%', justifyContent: 'center', alignItems: 'center' }}
      {...panResponder.panHandlers}
    >
      <Animated.Image
        source={{ uri: uri }}
        style={{
          width: SCREEN_WIDTH,
          height: '80%',
          transform: [{ scale: escala }],
          resizeMode: 'contain'
        }}
      />
    </View>
  );
};

export default function ProjectChecklistScreen({ token, onVolver }) {
  const [cargando, setCargando] = useState(true);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [proyectos, setProyectos] = useState([]);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  // 🎛️ CONTROL DE PESTAÑA PRINCIPAL: 'AVANCE' o 'MATERIALES'
  const [pestanaActiva, setPestanaActiva] = useState('AVANCE');

  // ESTADOS DEL MÓDULO 1: AVANCE (Checklist por etapas e Informe general)
  const [checklist, setChecklist] = useState([]);
  const [informeGeneralGlobal, setInformeGeneralGlobal] = useState([]);

  // 📂 CONTROL DE ARCHIVOS SELECCIONADOS
  const [etapaHistorialSeleccionada, setEtapaHistorialSeleccionada] = useState(null);
  const [verInformeGeneralActivo, setVerInformeGeneralActivo] = useState(false); 

  // ESTADOS DE EDICIÓN (MÓDULO DE REPORTE DIARIO)
  const [modalVisible, setModalVisible] = useState(false);
  const [etapaSeleccionada, setEtapaSeleccionada] = useState(null);
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState('');
  const [laborDelDia, setLaborDelDia] = useState('');
  const [guardandoProgreso, setGuardandoProgreso] = useState(false);

  // 📸 ARRAY DE FOTOS SELECCIONADAS
  const [listaFotos, setListaFotos] = useState([]);

  // 👁️ MODAL FINAL DE VISUALIZACIÓN
  const [modalVerReporteVisible, setModalVerReporteVisible] = useState(false);
  const [reporteDiaSeleccionado, setReporteDiaSeleccionado] = useState(null);
  const [indiceCarruselActivo, setIndiceCarruselActivo] = useState(0);

  // 🖼️ ESTADOS DEL VISOR DE IMÁGENES PREMIUM
  const [modalVisorVisible, setModalVisorVisible] = useState(false);
  const [fotosVisor, setFotosVisor] = useState([]);
  const [indiceInicialVisor, setIndiceInicialVisor] = useState(0);
  
  // 🔐 CONTROL DE INTERFERENCIA DE GESTOS INTERNOS
  const [carruselBloqueado, setCarruselBloqueado] = useState(false);

  // ESTADOS DEL MÓDULO 2: MATERIALES
  const [materialesBodega, setMaterialesBodega] = useState([]);
  const [materialesCompra, setMaterialesCompra] = useState([]);
  const [origenMaterial, setOrigenMaterial] = useState('BODEGA');
  const [busquedaMaterial, setBusquedaMaterial] = useState('');

  // 🆕 ESTADOS DE CREACIÓN DE NUEVO PROYECTO
  const [modalNuevoProyectoVisible, setModalNuevoProyectoVisible] = useState(false);
  const [nuevoProyectoNombre, setNuevoProyectoNombre] = useState('');
  const [creandoProyecto, setCreandoProyecto] = useState(false);

  // 1. Cargar la lista general de proyectos
  const cargarProyectos = async () => {
    try {
      setCargando(true);
      const res = await api.get('inventario/proyectos/'); 
      setProyectos(res.data);
    } catch (error) {
      console.error("Error obteniendo proyectos:", error);
      Alert.alert("Error", "No se pudo sincronizar la lista de frentes de obra.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProyectos();
  }, [token]);

  // 2. Cargar TODA la información del proyecto seleccionado
  const seleccionarProyecto = async (proyecto) => {
    try {
      setCargandoDetalle(true);
      setProyectoSeleccionado(proyecto);
      setPestanaActiva('AVANCE');      
      setOrigenMaterial('BODEGA');     
      setBusquedaMaterial('');         
      setEtapaHistorialSeleccionada(null); 
      setVerInformeGeneralActivo(false); 
      
      const [resChecklist, resMateriales] = await Promise.all([
        api.get(`inventario/proyectos/${proyecto.id}/checklist/`),
        api.get(`inventario/proyectos/${proyecto.id}/materiales/`)
      ]);

      setChecklist(resChecklist.data.checklist || []);
      setInformeGeneralGlobal(resChecklist.data.informe_general || []);
      setMaterialesBodega(resMateriales.data.salido_bodega || []);
      setMaterialesCompra(resMateriales.data.compra_directa || []);
    } catch (error) {
      console.error("Error cargando datos:", error);
      Alert.alert("Error", "Hubo un problema al traer la información del proyecto.");
    } finally {
      setCargandoDetalle(false);
    }
  };

  // 🆕 3. Enviar datos de nuevo proyecto a Django y autoseleccionar
  const handleCrearProyecto = async () => {
    if (!nuevoProyectoNombre.trim()) {
      Alert.alert("Campo Requerido", "Por favor ingresa un nombre válido para el proyecto.");
      return;
    }

    try {
      setCreandoProyecto(true);
      
      // 👇 AQUÍ SE INSERTA LA RUTA CORREGIDA 👇
      const res = await api.post('inventario/proyectos/crear/', {
        nombre: nuevoProyectoNombre.trim()
      });

      Alert.alert("¡Éxito!", `El proyecto "${nuevoProyectoNombre.trim()}" ha sido creado correctamente.`);
      setModalNuevoProyectoVisible(false);
      setNuevoProyectoNombre('');
      
      // Refrescar listado general e ingresar al proyecto de inmediato
      await cargarProyectos();
      
      // Pasamos el objeto con el ID que nos devuelve Django para que entre directo
      await seleccionarProyecto({ id: res.data.id, nombre: nuevoProyectoNombre.trim() });
      
    } catch (error) {
      console.error("Error creando proyecto:", error);
      Alert.alert("Error", "No se pudo registrar el nuevo proyecto en el servidor.");
    } finally {
      setCreandoProyecto(false);
    }
  };

  const refrescarChecklistSilencioso = async () => {
    try {
      const resChecklist = await api.get(`inventario/proyectos/${proyectoSeleccionado.id}/checklist/`);
      const actualizado = resChecklist.data.checklist || [];
      const informeActualizado = resChecklist.data.informe_general || [];
      
      setChecklist(actualizado);
      setInformeGeneralGlobal(informeActualizado);
      
      if (etapaHistorialSeleccionada) {
        const etapaRefrescada = actualizado.find(e => e.id === etapaHistorialSeleccionada.id);
        if (etapaRefrescada) setEtapaHistorialSeleccionada(etapaRefrescada);
      }
    } catch (e) {
      console.error("Error en refresco automático:", e);
    }
  };

  const abrirEditorEtapa = (etapa) => {
    setEtapaSeleccionada(etapa);
    setNuevoPorcentaje(etapa.porcentaje_avance.toString());
    setLaborDelDia(''); 
    setListaFotos([]); 
    setModalVisible(true);
  };

  const abrirVisualizadorReporteDia = (reporte) => {
    setReporteDiaSeleccionado(reporte);
    setIndiceCarruselActivo(0);
    setModalVerReporteVisible(true);
  };

  const abrirVisorImagen = (urls, indice) => {
    setFotosVisor(urls);
    setIndiceInicialVisor(indice);
    setCarruselBloqueado(false); // Resetear cerrojo de seguridad antes de abrir
    setModalVisorVisible(true);
  };

  const tomarFoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permiso requerido', 'Acceso denegado a cámara.');
    
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      quality: 0.8
    });
    
    if (!result.canceled) {
      setListaFotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const seleccionarDeGaleria = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permiso requerido', 'Acceso denegado a galería.');
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false, 
      allowsMultipleSelection: true, 
      quality: 0.8
    });
    
    if (!result.canceled) {
      const uris = result.assets.map(asset => asset.uri);
      setListaFotos(prev => [...prev, ...uris]);
    }
  };

  const quitarFotoDeLista = (indexQuitar) => {
    setListaFotos(prev => prev.filter((_, index) => index !== indexQuitar));
  };

  const guardarCambiosEtapa = async () => {
    const porcentajeNum = parseInt(nuevoPorcentaje);
    if (isNaN(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100) {
      Alert.alert("Dato Inválido", "El porcentaje debe ser de 0 a 100.");
      return;
    }

    try {
      setGuardandoProgreso(true);
      const formData = new FormData();
      formData.append('etapa_id', etapaSeleccionada.id);
      formData.append('porcentaje_avance', porcentajeNum);
      formData.append('notes_progreso', laborDelDia);
      formData.append('notas_progreso', laborDelDia);

      if (listaFotos && listaFotos.length > 0) {
        listaFotos.forEach((uri, index) => {
          const filename = uri.split('/').pop();
          const match = /\.(\w+)$/.exec(filename || '');
          const type = match ? `image/${match[1]}` : `image/jpeg`;

          formData.append('foto', {
            uri: uri,
            name: filename || `evidencia_${index}.jpg`,
            type: type
          });
        });
      }

      await api.post(`inventario/proyectos/${proyectoSeleccionado.id}/checklist/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await refrescarChecklistSilencioso();
      setModalVisible(false);
      setListaFotos([]);
      Alert.alert("¡Éxito!", "Reporte diario transmitido correctamente.");
    } catch (error) {
      console.error("Error guardando etapa:", error);
      Alert.alert("Error", "No se pudo transmitir el reporte al servidor.");
    } finally {
      setGuardandoProgreso(false);
    }
  };

  const proyectosFiltrados = proyectos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  const materialesFiltrados = (origenMaterial === 'BODEGA' ? materialesBodega : materialesCompra).filter(mat => 
    mat.nombre.toLowerCase().includes(busquedaMaterial.toLowerCase())
  );

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
      <TouchableOpacity style={styles.filaEtapa} onPress={() => setEtapaHistorialSeleccionada(item)}>
        <View style={[styles.barraColor, { backgroundColor: colorIndicador }]} />
        <View style={{ flex: 1, paddingLeft: 12 }}>
          <Text style={styles.etapaNombre}>{item.nombre_etapa}</Text>
          <Text style={styles.etapaProgreso}>Progreso actual: {item.porcentaje_avance}%</Text>
          <Text style={styles.verBitacoraEnlace}>📅 Ver bitácora histórica ({item.historial_reportes?.length || 0} días) →</Text>
        </View>
        <TouchableOpacity style={styles.btnEditar} onPress={() => abrirEditorEtapa(item)}>
          <Text style={{ fontSize: 16 }}>✏️</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderItemDiaHistorial = ({ item }) => (
    <TouchableOpacity style={styles.cardDiaHistorial} onPress={() => abrirVisualizadorReporteDia(item)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.fechaDiaTexto}>📆 Jornada: {item.fecha_reporte}</Text>
        <View style={styles.badgeProgresoDia}>
          <Text style={styles.textoBadgeDia}>{item.porcentaje_al_momento}%</Text>
        </View>
      </View>
      <Text style={styles.resumenLaborDia} numberOfLines={2}>{item.nota_labor}</Text>
      <Text style={styles.linkVerMasModal}>Tocar para ver reporte e imágenes →</Text>
    </TouchableOpacity>
  );

  const renderItemDiaInformeGeneral = ({ item }) => (
    <TouchableOpacity style={[styles.cardDiaHistorial, { borderLeftWidth: 4, borderLeftColor: '#3B82F6' }]} onPress={() => abrirVisualizadorReporteDia(item)}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.fechaDiaTexto}>📆 {item.fecha_reporte}</Text>
        <View style={[styles.badgeProgresoDia, { backgroundColor: '#EFF6FF' }]}>
          <Text style={[styles.textoBadgeDia, { color: '#1D4ED8' }]}>{item.porcentaje_al_momento}%</Text>
        </View>
      </View>
      <Text style={styles.tagEtapaInformeGeneral}>Etapa afectada: {item.nombre_etapa}</Text>
      <Text style={styles.resumenLaborDia} numberOfLines={2}>{item.nota_labor}</Text>
      <Text style={styles.linkVerMasModal}>Ver reporte e imágenes completo →</Text>
    </TouchableOpacity>
  );

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

  const handleScrollCarrusel = (event) => {
    const posicionX = event.nativeEvent.contentOffset.x;
    const indice = Math.round(posicionX / (SCREEN_WIDTH - 80)); 
    setIndiceCarruselActivo(indice);
  };

  if (cargando && proyectos.length === 0) {
    return (
      <View style={styles.centro}>
        <EmpresaLoader />
        <Text style={styles.textoCarga}>Sincronizando frentes de obra...</Text>
      </View>
    );
  }

  if (proyectoSeleccionado) {
    return (
      <View style={styles.container}>
        
        <View style={styles.headerProyecto}>
          <Text style={styles.headerSub}>Frente de Obra Seleccionado</Text>
          <Text style={styles.headerTitle}>🏗️ {proyectoSeleccionado.nombre}</Text>
        </View>

        {etapaHistorialSeleccionada && (
          <View style={{ flex: 1 }}>
            <View style={styles.headerArchivoEtapa}>
              <Text style={styles.subTituloArchivo}>Historial de Bitácoras por Día</Text>
              <Text style={styles.tituloArchivoEtapa}>📋 {etapaHistorialSeleccionada.nombre_etapa}</Text>
            </View>
            <FlatList data={etapaHistorialSeleccionada.historial_reportes} keyExtractor={(item) => item.id.toString()} renderItem={renderItemDiaHistorial} contentContainerStyle={{ paddingBottom: 15 }} />
            <TouchableOpacity style={[styles.btnVolver, { backgroundColor: '#546E7A' }]} onPress={() => setEtapaHistorialSeleccionada(null)}>
              <Text style={styles.btnVolverTexto}>← Volver al Listado de Etapas</Text>
            </TouchableOpacity>
          </View>
        )}

        {verInformeGeneralActivo && (
          <View style={{ flex: 1 }}>
            <View style={[styles.headerArchivoEtapa, { backgroundColor: '#EEF2F6', borderColor: '#CBD5E1' }]}>
              <Text style={[styles.subTituloArchivo, { color: '#334155' }]}>Historial Unificado de la Obra</Text>
              <Text style={[styles.tituloArchivoEtapa, { color: '#1E293B' }]}>🗃️ Archivo de Consultas Generales</Text>
            </View>
            <FlatList 
              data={informeGeneralGlobal} 
              keyExtractor={(item) => item.id.toString()} 
              renderItem={renderItemDiaInformeGeneral} 
              contentContainerStyle={{ paddingBottom: 15 }} 
              ListEmptyComponent={
                <Text style={styles.textoVacio}>No hay reportes diarios asentados en ningún sector del proyecto aún.</Text>
              }
            />
            <TouchableOpacity style={[styles.btnVolver, { backgroundColor: '#546E7A' }]} onPress={() => setVerInformeGeneralActivo(false)}>
              <Text style={styles.btnVolverTexto}>← Volver al Listado de Etapas</Text>
            </TouchableOpacity>
          </View>
        )}

        {!etapaHistorialSeleccionada && !verInformeGeneralActivo && (
          <View style={{ flex: 1 }}>
            <View style={styles.pestanasPrincipales}>
              <TouchableOpacity style={[styles.tabPrincipal, pestanaActiva === 'AVANCE' && styles.tabPrincipalActivo]} onPress={() => setPestanaActiva('AVANCE')}>
                <Text style={[styles.tabPrincipalTexto, pestanaActiva === 'AVANCE' && styles.tabPrincipalTextoActivo]}>📊 Avance de Proyecto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabPrincipal, pestanaActiva === 'MATERIALES' && styles.tabPrincipalActivo]} onPress={() => setPestanaActiva('MATERIALES')}>
                <Text style={[styles.tabPrincipalTexto, pestanaActiva === 'MATERIALES' && styles.tabPrincipalTextoActivo]}>📦 Materiales Utilizados</Text>
              </TouchableOpacity>
            </View>

            {cargandoDetalle ? (
              <View style={styles.centro}><EmpresaLoader /><Text style={styles.textoCarga}>Cargando datos...</Text></View>
            ) : (
              <View style={{ flex: 1 }}>
                {pestanaActiva === 'AVANCE' && (
                  <View style={{ flex: 1 }}>
                    <TouchableOpacity style={styles.cardInformeGeneralUnificado} onPress={() => setVerInformeGeneralActivo(true)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 24, marginRight: 12 }}>🗃️</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tituloSuperTarjeta}>Informe General del Proyecto</Text>
                          <Text style={styles.subtituloSuperTarjeta}>Revisar línea de tiempo completa ({informeGeneralGlobal.length} jornadas anotadas)</Text>
                        </View>
                        <Text style={{ fontSize: 18, color: '#1E3A8A', fontWeight: 'bold' }}>→</Text>
                      </View>
                    </TouchableOpacity>
                    <FlatList data={checklist} keyExtractor={(item) => item.id.toString()} renderItem={renderItemEtapa} contentContainerStyle={{ paddingBottom: 15 }} />
                  </View>
                )}

                {pestanaActiva === 'MATERIALES' && (
                  <View style={{ flex: 1 }}>
                    <View style={styles.subPasosContainer}>
                      <TouchableOpacity style={[styles.subPasoBoton, origenMaterial === 'BODEGA' && styles.subPasoBotonActivo]} onPress={() => { setOrigenMaterial('BODEGA'); setBusquedaMaterial(''); }}>
                        <Text style={[styles.subPasoTexto, origenMaterial === 'BODEGA' && styles.subPasoTextoActivo]}>🏢 Salido de Bodega</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.subPasoBoton, origenMaterial === 'COMPRA' && styles.subPasoBotonActivo]} onPress={() => { setOrigenMaterial('COMPRA'); setBusquedaMaterial(''); }}>
                        <Text style={[styles.subPasoTexto, origenMaterial === 'COMPRA' && styles.subPasoTextoActivo]}>🛒 Compra Directa</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput style={styles.buscador} placeholder="🔍 Buscar material..." placeholderTextColor="#9E9E9E" value={busquedaMaterial} onChangeText={setBusquedaMaterial} />
                    <FlatList data={materialesFiltrados} keyExtractor={(item) => item.id.toString()} renderItem={renderFilaMaterial} contentContainerStyle={{ paddingBottom: 15 }} />
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.btnVolver} onPress={() => { setProyectoSeleccionado(null); setChecklist([]); cargarProyectos(); }}>
              <Text style={styles.btnVolverTexto}>← Volver a Proyectos</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 🪟 MODAL A: REPORTAR LABOR DIARIA */}
        <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.capaFondoModal}>
            <View style={styles.contenidoModal}>
              {etapaSeleccionada && (
                <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitulo}>Reportar Labor Diaria</Text>
                  <Text style={styles.modalSubtitulo}>Etapa: {etapaSeleccionada.nombre_etapa}</Text>
                  
                  <Text style={styles.modalLabel}>Porcentaje de Avance General (0-100%):</Text>
                  <TextInput style={styles.modalInputCorto} keyboardType="numeric" maxLength={3} value={nuevoPorcentaje} onChangeText={setNuevoPorcentaje} />
                  
                  <Text style={styles.modalLabel}>¿Qué labor técnica se realizó hoy?:</Text>
                  <TextInput style={styles.modalInputLargo} multiline={true} numberOfLines={3} placeholder="Ej: Se instalaron soportes y rieles sin cortes estructurales." placeholderTextColor="#999" value={laborDelDia} onChangeText={setLaborDelDia} />
                  
                  <Text style={styles.modalLabel}>Evidencias Fotográficas:</Text>
                  <View style={styles.camaraBotonera}>
                    <TouchableOpacity onPress={tomarFoto} style={styles.btnCamaraAccion}>
                      <Text style={styles.btnCamaraTexto}>📸 Tomar Foto</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={seleccionarDeGaleria} style={[styles.btnCamaraAccion, { backgroundColor: '#546E7A' }]}>
                      <Text style={styles.btnCamaraTexto}>🖼️ Galería</Text>
                    </TouchableOpacity>
                  </View>

                  {listaFotos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                      {listaFotos.map((uri, index) => (
                        <View key={index} style={styles.contenedorMiniatura}>
                          <Image source={{ uri: uri }} style={styles.fotoMiniaturaForm} />
                          <TouchableOpacity onPress={() => quitarFotoDeLista(index)} style={styles.badgeQuitarFoto}>
                            <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>X</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  <View style={styles.modalBotonera}>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancelar]} onPress={() => setModalVisible(false)} disabled={guardandoProgreso}><Text style={styles.btnTextoBlanco}>Cancelar</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGuardar]} onPress={guardarCambiosEtapa} disabled={guardandoProgreso}><Text style={styles.btnTextoBlanco}>{guardandoProgreso ? "Guardando..." : "Guardar Reporte"}</Text></TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* 👁️ MODAL B: VISUALIZADOR DE INFORME CON CARRUSEL DE IMÁGENES */}
        <Modal animationType="fade" transparent={true} visible={modalVerReporteVisible} onRequestClose={() => setModalVerReporteVisible(false)}>
          <View style={styles.capaFondoModal}>
            <View style={styles.contenidoModal}>
              {reporteDiaSeleccionado && (
                <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.modalTitulo}>Reporte de Obra</Text>
                  <Text style={[styles.modalSubtitulo, { color: '#0284c7' }]}>Jornada: {reporteDiaSeleccionado.fecha_reporte}</Text>

                  <View style={styles.contenedorDetalleInfo}>
                    {reporteDiaSeleccionado.nombre_etapa && (
                      <View style={{ marginBottom: 10 }}>
                        <Text style={styles.modalLabel}>Sector / Etapa:</Text>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#334155' }}>📌 {reporteDiaSeleccionado.nombre_etapa}</Text>
                      </View>
                    )}

                    <Text style={styles.modalLabel}>Avance Registrado a la Fecha:</Text>
                    <Text style={styles.textoDestacadoProgreso}>{reporteDiaSeleccionado.porcentaje_al_momento}% Completado</Text>

                    <Text style={styles.modalLabel}>Descripción de Labores de la Cuadrilla:</Text>
                    <View style={styles.cajaNotasGuardadas}>
                      <Text style={styles.textoNotasGuardadas}>{reporteDiaSeleccionado.nota_labor}</Text>
                    </View>

                    <Text style={styles.modalLabel}>Registro de Evidencias (Desliza para ver más):</Text>
                    
                    {reporteDiaSeleccionado.fotos_urls && reporteDiaSeleccionado.fotos_urls.length > 0 ? (
                      <View>
                        <ScrollView 
                          horizontal 
                          pagingEnabled 
                          showsHorizontalScrollIndicator={false}
                          onScroll={handleScrollCarrusel}
                          scrollEventThrottle={16}
                          style={styles.contenedorCarrusel}
                        >
                          {reporteDiaSeleccionado.fotos_urls.map((imgUrl, i) => (
                            <TouchableOpacity
                              key={i}
                              activeOpacity={0.9}
                              onPress={() => abrirVisorImagen(reporteDiaSeleccionado.fotos_urls, i)}
                            >
                              <Image 
                                source={{ uri: imgUrl }} 
                                style={styles.fotoEvidenciaCarrusel} 
                              />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        
                        {reporteDiaSeleccionado.fotos_urls.length > 1 && (
                          <View style={styles.contenedorPuntos}>
                            {reporteDiaSeleccionado.fotos_urls.map((_, i) => (
                              <View 
                                key={i} 
                                style={[
                                  styles.puntoCarrusel, 
                                  indiceCarruselActivo === i ? styles.puntoActivo : styles.puntoInactivo
                                ]} 
                              />
                            ))}
                          </View>
                        )}
                      </View>
                    ) : reporteDiaSeleccionado.foto_evidencia_url ? (
                      <TouchableOpacity 
                        activeOpacity={0.9} 
                        onPress={() => abrirVisorImagen([reporteDiaSeleccionado.foto_evidencia_url], 0)}
                      >
                        <Image source={{ uri: reporteDiaSeleccionado.foto_evidencia_url }} style={styles.fotoEvidenciaCarrusel} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.sinFotoContenedor}>
                        <Text style={{ color: '#78909C', fontSize: 13, fontWeight: '500' }}>⚠️ No se subió evidencia fotográfica este día.</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ marginTop: 25 }}>
                    <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#455A64', width: '100%' }]} onPress={() => setModalVerReporteVisible(false)}>
                      <Text style={styles.btnTextoBlanco}>Cerrar Detalle</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>

        {/* 🖼️ MODAL C: VISOR DE IMÁGENES PREMIUM EN PANTALLA COMPLETA + GESTOS FILTRADOS */}
        <Modal
          visible={modalVisorVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setModalVisorVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)' }}>
                    
            {/* Botón Cerrar */}
            <View style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}>
              <TouchableOpacity 
                onPress={() => setModalVisorVisible(false)}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>X</Text>
              </TouchableOpacity>
            </View>
              
            {/* El carrusel se congela inteligentemente cuando escala la imagen */}
            <FlatList
              data={fotosVisor}
              horizontal
              pagingEnabled
              scrollEnabled={!carruselBloqueado} // 🔒 Desactiva el carrusel temporalmente durante el zoom
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={indiceInicialVisor}
              getItemLayout={(data, index) => (
                { length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index }
              )}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <VistaImagenConZoom 
                  uri={item} 
                  setCarruselBloqueado={setCarruselBloqueado} 
                />
              )}
            />
        
            <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
              <Text style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, fontWeight: '500' }}>
                ↔️ Un dedo para navegar / ✌️ Dos dedos para hacer zoom
              </Text>
            </View>
            
          </View>
        </Modal> 
      </View>
    );
  }

  // 📝 VISTA PRINCIPAL: SELECCIÓN DE OBRAS + NUEVO BOTÓN FLOTANTE (FAB)
  return (
    <View style={styles.container}>
      <Text style={styles.tituloSeccion}>Selecciona una obra para gestionar:</Text>
      <TextInput style={styles.buscador} placeholder="🔍 Buscar proyecto..." placeholderTextColor="#9E9E9E" value={busqueda} onChangeText={setBusqueda} />
      
      <FlatList 
        data={proyectosFiltrados} 
        keyExtractor={(item) => item.id.toString()} 
        renderItem={renderItemProyecto} 
        contentContainerStyle={{ paddingBottom: 90 }} // Margen extra abajo para que el FAB no tape la última tarjeta
      />

      {/* 🆕 BOTÓN FLOTANTE (FAB) PARA CREACIÓN DE PROYECTO */}
      <TouchableOpacity 
        style={styles.fab} 
        activeOpacity={0.8}
        onPress={() => setModalNuevoProyectoVisible(true)}
      >
        <Text style={styles.fabTexto}>+</Text>
      </TouchableOpacity>

      {/* 🆕 MODAL D: CREACIÓN DE NUEVO PROYECTO DESDE LA APP */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalNuevoProyectoVisible}
        onRequestClose={() => setModalNuevoProyectoVisible(false)}
      >
        <View style={styles.capaFondoModal}>
          <View style={styles.contenidoModal}>
            <Text style={styles.modalTitulo}>Crear Nuevo Frente de Obra</Text>
            <Text style={[styles.modalSubtitulo, { color: '#87C442' }]}>Configuración de nuevo punto de control</Text>
            
            <Text style={styles.modalLabel}>Nombre Completo del Proyecto / Obra:</Text>
            <TextInput 
              style={styles.modalInputProyectoNombre} 
              placeholder="Ej: Edificio Av. El Dorado - Torre 2" 
              placeholderTextColor="#999"
              value={nuevoProyectoNombre}
              onChangeText={setNuevoProyectoNombre}
            />

            <View style={styles.modalBotonera}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnCancelar]} 
                onPress={() => { setModalNuevoProyectoVisible(false); setNuevoProyectoNombre(''); }}
                disabled={creandoProyecto}
              >
                <Text style={styles.btnTextoBlanco}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalBtn, styles.modalBtnGuardar]} 
                onPress={handleCrearProyecto}
                disabled={creandoProyecto}
              >
                <Text style={styles.btnTextoBlanco}>
                  {creandoProyecto ? "Creando..." : "Crear Proyecto"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  tabPrincipalActivo: { borderBottomColor: '#87C442' },
  tabPrincipalTexto: { fontSize: 14, fontWeight: '600', color: '#78909C' },
  tabPrincipalTextoActivo: { color: '#87C442', fontWeight: 'bold' },

  cardInformeGeneralUnificado: { backgroundColor: '#EFF6FF', padding: 16, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#BFDBFE', elevation: 2 },
  tituloSuperTarjeta: { fontSize: 15, fontWeight: 'bold', color: '#1E3A8A' },
  subtituloSuperTarjeta: { fontSize: 12, color: '#3B82F6', marginTop: 3, fontWeight: '500' },
  tagEtapaInformeGeneral: { fontSize: 11, fontWeight: 'bold', color: '#2563EB', backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginTop: 6, overflow: 'hidden' },

  headerArchivoEtapa: { backgroundColor: '#E0F2FE', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#BAE6FD' },
  subTituloArchivo: { fontSize: 11, fontWeight: 'bold', color: '#0369A1', textTransform: 'uppercase' },
  tituloArchivoEtapa: { fontSize: 16, fontWeight: 'bold', color: '#0369A1', marginTop: 2 },
  cardDiaHistorial: { backgroundColor: '#FFF', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  fechaDiaTexto: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  badgeProgresoDia: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1' },
  textoBadgeDia: { fontSize: 12, fontWeight: '700', color: '#475569' },
  resumenLaborDia: { fontSize: 13, color: '#64748B', marginTop: 8, fontStyle: 'italic' },
  linkVerMasModal: { fontSize: 12, color: '#0284c7', fontWeight: '600', marginTop: 8, textAlign: 'right' },

  subPasosContainer: { flexDirection: 'row', backgroundColor: '#ECEFF1', padding: 4, borderRadius: 10, marginBottom: 15 },
  subPasoBoton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  subPasoBotonActivo: { backgroundColor: '#FFF', elevation: 2 },
  subPasoTexto: { fontSize: 13, fontWeight: '600', color: '#78909C' },
  subPasoTextoActivo: { color: '#2196F3', fontWeight: 'bold' },

  filaEtapa: { flexDirection: 'row', backgroundColor: '#F8F9FA', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E1E5EB', alignItems: 'center' },
  barraColor: { width: 6, height: '100%', minHeight: 50, borderRadius: 3 },
  etapaNombre: { fontSize: 14, fontWeight: '600', color: '#2D2E31' },
  etapaProgreso: { fontSize: 12, color: '#7A7B80', marginTop: 2 },
  verBitacoraEnlace: { fontSize: 12, color: '#0284c7', fontWeight: '600', marginTop: 6 },
  btnEditar: { padding: 10, backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#CFD8DC', marginLeft: 10 },

  materialFila: { flexDirection: 'row', backgroundColor: '#FFF', padding: 14, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center', justifyContent: 'space-between' },
  materialNombre: { fontSize: 15, fontWeight: '600', color: '#2D2E31' },
  materialUnidad: { fontSize: 12, color: '#7A7B80', marginTop: 2 },
  badgeCantidad: { backgroundColor: '#87C442', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeTexto: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  capaFondoModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 20, paddingVertical: 30 },
  contenidoModal: { width: '100%', maxHeight: '90%', backgroundColor: '#FFF', borderRadius: 16, padding: 20, elevation: 5 },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: '#2D2E31', marginBottom: 5, textAlign: 'center' },
  modalSubtitulo: { fontSize: 14, fontWeight: '600', color: '#F39C12', marginBottom: 15, textAlign: 'center' },
  modalLabel: { fontSize: 13, fontWeight: '700', color: '#546E7A', marginBottom: 6, marginTop: 12 },
  modalInputCorto: { width: 80, backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#CFD8DC', borderRadius: 8, padding: 8, fontSize: 16, textAlign: 'center' },
  modalInputLargo: { width: '100%', backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#CFD8DC', borderRadius: 8, padding: 12, fontSize: 14, textAlignVertical: 'top' },
  
  // 🆕 Estilo específico para la caja del nombre de proyecto
  modalInputProyectoNombre: { width: '100%', backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: '#CFD8DC', borderRadius: 8, padding: 14, fontSize: 15, color: '#333' },

  camaraBotonera: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 10, marginTop: 4 },
  btnCamaraAccion: { backgroundColor: '#0284c7', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 8, flex: 0.48, alignItems: 'center' },
  btnCamaraTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  
  contenedorMiniatura: { marginRight: 10, position: 'relative' },
  fotoMiniaturaForm: { width: 70, height: 70, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  badgeQuitarFoto: { position: 'absolute', top: -4, right: -4, backgroundColor: '#EF4444', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },

  contenedorDetalleInfo: { width: '100%', marginTop: 5 },
  textoDestacadoProgreso: { fontSize: 18, fontWeight: 'bold', color: '#87C442', marginVertical: 6 },
  cajaNotasGuardadas: { width: '100%', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E1E5EB', marginBottom: 12 },
  textoNotasGuardadas: { fontSize: 14, color: '#333', lineHeight: 20 },
  sinFotoContenedor: { width: '100%', backgroundColor: '#F1F3F5', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#CFD8DC', borderStyle: 'dashed' },

  contenedorCarrusel: { width: '100%', height: 220, borderRadius: 10, marginTop: 5 },
  fotoEvidenciaCarrusel: { width: SCREEN_WIDTH - 80, height: 220, borderRadius: 10, resizeMode: 'contain', backgroundColor: '#000' },
  contenedorPuntos: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  puntoCarrusel: { height: 8, borderRadius: 4, marginHorizontal: 4 },
  puntoActivo: { width: 18, backgroundColor: '#0284c7' },
  puntoInactivo: { width: 8, backgroundColor: '#CBD5E1' },

  modalBotonera: { flexDirection: 'row', marginTop: 20, width: '100%', gap: 10, marginBottom: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancelar: { backgroundColor: '#90A4AE' },
  modalBtnGuardar: { backgroundColor: '#87C442' },
  btnTextoBlanco: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  textoVacio: { fontSize: 14, color: '#7A7B80', textAlign: 'center', marginTop: 20 },
  btnVolver: { backgroundColor: '#495057', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 20 },
  btnVolverTexto: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  // 🆕 ESTILOS DEL BOTÓN FLOTANTE (FAB)
  fab: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    backgroundColor: '#87C442',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabTexto: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '300',
    marginTop: -3 // Centrado óptico del símbolo +
  }
});