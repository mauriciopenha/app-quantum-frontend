import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../api';
import EmpresaLoader from './EmpresaLoader';

export default function MaterialMovementScreen({ token, onMovimientoExitoso }) {
  const [enviando, setEnviando] = useState(false);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);

  // --- CONTROL DE PANTALLAS (PASO A PASO REAL) ---
  const [pasoActual, setPasoActual] = useState(1); // 1, 2 o 3

  // Catálogos maestros de Django
  const [listaMateriales, setListaMateriales] = useState([]);
  const [listaProyectos, setListaProyectos] = useState([]);

  // Buscadores principales
  const [sugerenciasMateriales, setSugerenciasMateriales] = useState([]);
  const [sugerenciasProyectos, setSugerenciasProyectos] = useState([]);
  const [busquedaMaterial, setBusquedaMaterial] = useState('');
  const [busquedaProyecto, setBusquedaProyecto] = useState('');

  // Datos del formulario de movimiento
  const [tipoMovimiento, setTipoMovimiento] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [notas, setNotas] = useState('');
  const [proveedor, setProveedor] = useState('');

  // Carrito multi-ítem
  const [carrito, setCarrito] = useState([]);
  const [nombreMaterialSeleccionado, setNombreMaterialSeleccionado] = useState('');
  const [unidadSeleccionada, setUnidadSeleccionada] = useState('');
  
  // MODAL 1: Crear Material Nuevo
  const [modalMaterialVisible, setModalMaterialVisible] = useState(false);
  const [nuevoNombreMaterial, setNuevoNombreMaterial] = useState('');
  const [nuevaUnidadMaterial, setNuevaUnidadMaterial] = useState('UND');
  const [guardandoNuevoMaterial, setGuardandoNuevoMaterial] = useState(false);
  const [sugerenciasDuplicadosModal, setSugerenciasDuplicadosModal] = useState([]);

  // MODAL 2: Crear Proyecto Nuevo
  const [modalProyectoVisible, setModalProyectoVisible] = useState(false);
  const [nuevoNombreProyecto, setNuevoNombreProyecto] = useState('');
  const [guardandoNuevoProyecto, setGuardandoNuevoProyecto] = useState(false);

  const cargarDatos = async () => {
    if (!token) return;
    try {
      setCargandoCatalogos(true);
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      
      const [resMateriales, resProyectos] = await Promise.all([
        api.get('inventario/materiales/', config),
        api.get('inventario/proyectos/', config)
      ]);
      setListaMateriales(resMateriales.data);
      setListaProyectos(resProyectos.data);
    } catch (error) {
      console.error("Error cargando catálogos:", error.response?.data || error.message);
      Alert.alert("Error de conexión", "No se pudieron mapear los catálogos del servidor.");
    } finally {
      setCargandoCatalogos(false);
    }
  };

  useEffect(() => { 
    cargarDatos(); 
  }, [token]);

  const seleccionarTipoOperacion = (tipo) => {
    setTipoMovimiento(tipo);
    setCarrito([]);
    setBusquedaProyecto('');
    setProyectoId('');
    setProveedor('');
    setBusquedaMaterial('');
    setMaterialId('');
    setUnidadSeleccionada('');
    setPasoActual(2);
  };

  const filtrarMateriales = (texto) => {
    setBusquedaMaterial(texto);
    setMaterialId('');
    setNombreMaterialSeleccionado('');
    setUnidadSeleccionada('');
    
    if (texto.trim() === '') { 
      setSugerenciasMateriales([]); 
    } else {
      const filtrados = listaMateriales.filter(item => item.nombre.toLowerCase().includes(texto.toLowerCase()));
      
      if (filtrados.length === 0) {
        setSugerenciasMateriales([{
          id: `temp_${Date.now()}`,
          nombre: texto.trim(),
          unidad_medida: 'UND',
          isTemporal: true
        }]);
      } else {
        setSugerenciasMateriales(filtrados.slice(0, 4));
      }
    }
  };

  const filtrarProyectos = (texto) => {
    setBusquedaProyecto(texto);
    setProyectoId('');
    if (texto.trim() === '') { setSugerenciasProyectos([]); } 
    else {
      const filtrados = listaProyectos.filter(item => item.nombre.toLowerCase().includes(texto.toLowerCase()));
      setSugerenciasProyectos(filtrados.slice(0, 4));
    }
  };

  const filtrarMaterialesDuplicadosModal = (texto) => {
    setNuevoNombreMaterial(texto);
    if (texto.trim() === '') { setSugerenciasDuplicadosModal([]); } 
    else {
      const filtrados = listaMateriales.filter(item => item.nombre.toLowerCase().includes(texto.toLowerCase()));
      setSugerenciasDuplicadosModal(filtrados.slice(0, 3));
    }
  };

  const agregarAlCarrito = () => {
    if (!materialId || !cantidad || parseInt(cantidad, 10) <= 0) {
      Alert.alert("Campos incompletos", "Selecciona un material válido e ingresa una cantidad mayor a cero.");
      return;
    }

    const esTemporal = typeof materialId === 'string' && materialId.includes('temp');

    // BLINDAJE: Si es temporal y NO es compra directa, lo frena como antes
    if (esTemporal && tipoMovimiento !== 'COMPRA_DIRECTA') {
      Alert.alert(
        "Material Temporal",
        "Este material no existe en la base de datos. Por favor, usa el botón 'Crear Material Nuevo' para registrarlo formalmente antes de agregarlo al remito.",
        [{ text: "Entendido" }]
      );
      return;
    }

    // Evitamos duplicados comparando por nombre
    if (carrito.some(item => item.nombre === nombreMaterialSeleccionado)) {
      Alert.alert("Ya agregado", "Este material ya está en el listado inferior.");
      return;
    }

    setCarrito([...carrito, {
      material: esTemporal ? null : parseInt(materialId, 10), 
      nombre: nombreMaterialSeleccionado,
      cantidad: parseInt(cantidad, 10),
      textUnidad: unidadSeleccionada,
      isTemporal: esTemporal // Guardamos esta bandera para el envío final
    }]);

    setBusquedaMaterial('');
    setMaterialId('');
    setNombreMaterialSeleccionado('');
    setUnidadSeleccionada('');
    setCantidad('');
  };

  const handleCrearProyectoBackend = async () => {
    if (!nuevoNombreProyecto.trim()) {
      Alert.alert("Requerido", "Escribe el nombre de la obra.");
      return;
    }
    try {
      setGuardandoNuevoProyecto(true);
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const res = await api.post('inventario/proyectos/crear/', { nombre: nuevoNombreProyecto.trim() }, config);
      Alert.alert("¡Éxito!", res.data.mensaje);
      
      const resProyectos = await api.get('inventario/proyectos/', config);
      setListaProyectos(resProyectos.data);

      setProyectoId(res.data.id);
      setBusquedaProyecto(`🚧 ${nuevoNombreProyecto.trim()}`);
      setNuevoNombreProyecto('');
      setModalProyectoVisible(false);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "No se pudo registrar la obra.");
    } finally { 
      setGuardandoNuevoProyecto(false); }
  };

  const handleCrearMaterialCatalogo = async () => {
    if (!nuevoNombreMaterial.trim()) return;
    if (sugerenciasDuplicadosModal.length > 0) {
      Alert.alert(
        "¿Ya existe?",
        "Hay nombres similares en catálogo. Si estás seguro de que es un insumo totalmente diferente, dale registrar.",
        [
          { text: "Revisar", style: "cancel" },
          { text: "Registrar", onPress: () => enviarMaterialBackend() }
        ]
      );
      return;
    }
    enviarMaterialBackend();
  };

  const enviarMaterialBackend = async () => {
    try {
      setGuardandoNuevoMaterial(true);
      const config = { headers: { 'Authorization': `Bearer ${token}` } };
      const res = await api.post('inventario/materiales/crear/', { nombre: nuevoNombreMaterial.trim(), unidad_medida: nuevaUnidadMaterial }, config);
      Alert.alert("¡Éxito!", res.data.mensaje);

      const resMateriales = await api.get('inventario/materiales/', config);
      setListaMateriales(resMateriales.data);

      setMaterialId(res.data.id);
      setBusquedaMaterial(nuevoNombreMaterial.trim());
      setNombreMaterialSeleccionado(nuevoNombreMaterial.trim());
      setUnidadSeleccionada(nuevaUnidadMaterial.toUpperCase());
      
      setNuevoNombreMaterial('');
      setSugerenciasDuplicadosModal([]);
      setModalMaterialVisible(false);
    } catch (error) {
      Alert.alert("Error", error.response?.data?.error || "Error al crear material.");
    } finally { setGuardandoNuevoMaterial(false); }
  };


  const handleAsentarMovimientoGeneral = async () => {
    try {
      setEnviando(true);
      const config = { headers: { 'Authorization': `Bearer ${token}` } };

      console.log("CONTENIDO DEL CARRITO ORIGINAL:", carrito);
      
      const payload = {
        proyecto_id: tipoMovimiento === 'ENTRADA_BODEGA' ? null : parseInt(proyectoId, 10),
        tipo_movimiento: tipoMovimiento,
        proveedor: (tipoMovimiento === 'COMPRA_DIRECTA' || tipoMovimiento === 'ENTRADA_BODEGA') ? proveedor : '',
        notas_novedad: notas,
        // Enviamos el ID del material o el nombre escrito a mano si es temporal
        items: carrito.map(item => ({ 
          material: item.material, 
          cantidad: item.cantidad,
          nombre_temporal: item.isTemporal ? item.nombre : '' 
        }))
      };

      await api.post('inventario/materiales/', payload, config);
      Alert.alert("¡Asentado!", "La operación se registró de forma exitosa.");
      
      setCarrito([]);
      setBusquedaProyecto('');
      setProyectoId('');
      setProveedor('');
      setNotas('');
      setTipoMovimiento('');
      setPasoActual(1);

      const resMateriales = await api.get('inventario/materiales/', config);
      setListaMateriales(resMateriales.data);
      if (onMovimientoExitoso) onMovimientoExitoso();
    } catch (error) {
      console.error("Error en POST de movimiento:", error.response?.data || error.message);
      Alert.alert("Error de validación", error.response?.data?.error || "No se pudo procesar la carga.");
    } finally { setEnviando(false); }
  };

  const verificarAvancePaso2 = () => {
    if (tipoMovimiento !== 'ENTRADA_BODEGA' && !proyectoId) {
      Alert.alert("Campo Requerido", "Por favor selecciona un proyecto de la lista antes de continuar.");
      return;
    }
    setPasoActual(3);
  };

  if (cargandoCatalogos) {
    return (
      <View style={styles.pantallaCarga}>
        <EmpresaLoader /> {/* 🔌 Cambiado el ActivityIndicator por el tuyo */}
        <Text style={styles.textoCarga}>Sincronizando base de datos...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#FFF' }}>
      
      {/* INDICADOR DE PASOS SUPERIOR CON TEXTOS PROTEGIDOS */}
      <View style={styles.barraProgresoContainer}>
        <View style={[styles.nodoProgreso, pasoActual >= 1 ? styles.nodoActivo : null]}>
          <Text style={styles.nodoTexto}>1</Text>
        </View>
        <View style={[styles.lineaProgreso, pasoActual >= 2 ? styles.lineaActiva : null]} />
        <View style={[styles.nodoProgreso, pasoActual >= 2 ? styles.nodoActivo : null]}>
          <Text style={styles.nodoTexto}>2</Text>
        </View>
        <View style={[styles.lineaProgreso, pasoActual >= 3 ? styles.lineaActiva : null]} />
        <View style={[styles.nodoProgreso, pasoActual >= 3 ? styles.nodoActivo : null]}>
          <Text style={styles.nodoTexto}>3</Text>
        </View>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        
        {/* ==================== PASO 1 ==================== */}
        {pasoActual === 1 && (
          <View>
            <Text style={styles.seccionTitulo}>¿Qué operación vas a realizar?</Text>
            <Text style={styles.seccionSubtitulo}>Selecciona un botón para iniciar la guía de carga.</Text>
            <View style={styles.tipoMallaVertical}>
              <TouchableOpacity style={[styles.tipoBotonGrande, tipoMovimiento === 'SALIDA_PROYECTO' && styles.tipoActivoSalida]} onPress={() => seleccionarTipoOperacion('SALIDA_PROYECTO')}>
                <Text style={styles.tipoTextoGrande}>Salida a Obra 👷‍♂️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tipoBotonGrande, tipoMovimiento === 'COMPRA_DIRECTA' && styles.tipoActivoCompraDir]} onPress={() => seleccionarTipoOperacion('COMPRA_DIRECTA')}>
                <Text style={styles.tipoTextoGrande}>Compra Directa 🚚</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tipoBotonGrande, tipoMovimiento === 'DEVOLUCION_PROYECTO' && styles.tipoActivoDev]} onPress={() => seleccionarTipoOperacion('DEVOLUCION_PROYECTO')}>
                <Text style={styles.tipoTextoGrande}>Devolución de Obra 🔄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tipoBotonGrande, tipoMovimiento === 'ENTRADA_BODEGA' && styles.tipoActivoEntrada]} onPress={() => seleccionarTipoOperacion('ENTRADA_BODEGA')}>
                <Text style={styles.tipoTextoGrande}>Ingreso a Bodega 📥</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ==================== PASO 2 ==================== */}
        {pasoActual === 2 && (
          <View style={styles.bloquePasoAnimado}>
            <Text style={styles.seccionTitulo}>Ubicación y Origen</Text>
            
            {tipoMovimiento !== 'ENTRADA_BODEGA' ? (
              <View style={{ marginBottom: 15 }}>
                <View style={styles.filaLabelBoton}>
                  <Text style={styles.label}>Asignar Proyecto u Obra</Text>
                  <TouchableOpacity onPress={() => setModalProyectoVisible(true)}>
                    <Text style={styles.btnTextoAccesoRapido}>➕ Crear Obra Nueva</Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="🔍 Escribe el nombre para buscar..."
                  placeholderTextColor="#9E9E9E"
                  value={busquedaProyecto}
                  onChangeText={filtrarProyectos}
                />
                {sugerenciasProyectos.length > 0 && (
                  <View style={styles.sugerenciasContainer}>
                    {sugerenciasProyectos.map(item => (
                      <TouchableOpacity key={item.id.toString()} style={styles.sugerenciaItem} onPress={() => {
                        setProyectoId(item.id);
                        setBusquedaProyecto(`🚧 ${item.nombre}`);
                        setSugerenciasProyectos([]);
                      }}>
                        <Text style={styles.sugerenciaTexto}>🚧 {item.nombre}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.tarjetaInformativa}>
                <Text style={styles.tarjetaInformativaTexto}>📥 Modo: Ingreso a Bodega central. No requiere asignar un frente de obra.</Text>
              </View>
            )}

            {(tipoMovimiento === 'COMPRA_DIRECTA' || tipoMovimiento === 'ENTRADA_BODEGA') && (
              <View style={{ marginBottom: 15 }}>
                <Text style={styles.label}>Proveedor / Fabricante (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Jinko Solar, Suministros Eléctricos"
                  placeholderTextColor="#9E9E9E"
                  value={proveedor}
                  onChangeText={setProveedor}
                />
              </View>
            )}

            {/* BOTONES DE NAVEGACIÓN PASO 2 */}
            <View style={styles.mallaBotonesNavegacion}>
              <TouchableOpacity style={styles.btnNavegacionAtras} onPress={() => setPasoActual(1)}>
                <Text style={styles.btnNavegacionAtrasTexto}>⬅️ Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnNavegacionSiguiente} onPress={verificarAvancePaso2}>
                <Text style={styles.btnNavegacionSiguienteTexto}>Siguiente ➡️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ==================== PASO 3 ==================== */}
        {pasoActual === 3 && (
          <View style={styles.bloquePasoAnimado}>
            <Text style={styles.seccionTitulo}>Carga de Materiales</Text>
            
            <View style={styles.filaLabelBoton}>
              <Text style={styles.label}>Buscar Material en Catálogo</Text>
              <TouchableOpacity onPress={() => setModalMaterialVisible(true)}>
                <Text style={styles.btnTextoAccesoRapido}>➕ Crear Material Nuevo</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="🔍 Escribe para buscar insumo..."
              placeholderTextColor="#9E9E9E"
              value={busquedaMaterial}
              onChangeText={filtrarMateriales}
            />
            {sugerenciasMateriales.length > 0 && (
              <View style={styles.sugerenciasContainer}>
                {sugerenciasMateriales.map(item => (
                  <TouchableOpacity 
                    key={item.id.toString()} 
                    style={[styles.sugerenciaItem, item.isTemporal && { backgroundColor: '#FFF9C4', borderColor: '#FBC02D', borderWidth: 1 }]} 
                    onPress={() => {
                      setMaterialId(item.id);
                      setBusquedaMaterial(item.nombre);
                      setNombreMaterialSeleccionado(item.nombre);
                      setUnidadSeleccionada(item.isTemporal ? 'UND' : item.unidad_medida.toUpperCase());
                      setSugerenciasMateriales([]);
                    }}
                  >
                    {item.isTemporal ? (
                      <Text style={[styles.sugerenciaTexto, { fontWeight: 'bold', color: '#F57F17' }]}>✨ Usar como artículo temporal: "{item.nombre}"</Text>
                    ) : (
                      <Text style={styles.sugerenciaTexto}>📦 {item.nombre} ({item.stock_bodega} {item.unidad_medida.toUpperCase()})</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Cantidad a agregar {unidadSeleccionada ? `(${unidadSeleccionada})` : ''}</Text>
            <View style={styles.cajaCantidadUnidad}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0, borderWidth: 0 }]}
                placeholder="Ej: 100"
                keyboardType="numeric"
                value={cantidad}
                onChangeText={setCantidad}
              />
              {unidadSeleccionada ? (
                <View style={styles.badgeUnidadFija}><Text style={styles.badgeUnidadFijaTexto}>{unidadSeleccionada}</Text></View>
              ) : null}
            </View>

            <TouchableOpacity style={styles.btnAgregarLista} onPress={agregarAlCarrito}>
              <Text style={styles.btnAgregarListaTexto}>+ Vincular a la Lista</Text>
            </TouchableOpacity>

            {/* CARRITO INTEGRADO CON SECCIÓN DE NOTAS */}
            {carrito.length > 0 ? (
              <View style={styles.carritoCaja}>
                <Text style={styles.carritoTitulo}>Lista de Materiales Cargados ({carrito.length}):</Text>
                {carrito.map((item, index) => (
                  // BLINDAJE: Si material es null, usamos el nombre + el index como llave única
                  <View key={item.material ? item.material.toString() : `temp-${item.nombre}-${index}`} style={styles.carritoFila}>
                    <Text style={styles.carritoFilaTexto}>🔹 {item.nombre} <Text style={{fontWeight: 'bold', color: '#2196F3'}}>(x{item.cantidad} {item.textUnidad})</Text></Text>
                    
                    {/* BLINDAJE: Filtramos por nombre para evitar borrar múltiples temporales a la vez */}
                    <TouchableOpacity onPress={() => setCarrito(carrito.filter(c => c.nombre !== item.nombre))}>
                      <Text style={styles.btnEliminarTexto}>Quitar</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={[styles.label, { marginTop: 12 }]}>Observaciones del Remito (Opcional)</Text>
                <TextInput
                  style={[styles.input, { height: 50, textAlignVertical: 'top' }]}
                  placeholder="Escribe alguna novedad..."
                  multiline
                  value={notas}
                  onChangeText={setNotas}
                />

                {enviando ? (
                  <View style={{ justifyContent: 'center', alignItems: 'center', paddingVertical: 10, marginTop: 10 }}>
                    <EmpresaLoader />
                    <Text style={{ fontSize: 12, color: '#7A7B80', marginTop: 5, fontWeight: '500' }}>Asentando en base de datos...</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.btnGuardar} onPress={handleAsentarMovimientoGeneral}>
                    <Text style={styles.btnTexto}>Asentar Movimiento General</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* BOTÓN VOLVER PASO 3 */}
            <TouchableOpacity style={[styles.btnNavegacionAtras, { marginTop: 15, width: '100%' }]} onPress={() => setPasoActual(2)}>
              <Text style={styles.btnNavegacionAtrasTexto}>⬅️ Volver a Paso 2</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ==================== MODALS ==================== */}
      {/* MODAL CREAR MATERIAL */}
      <Modal animationType="slide" transparent visible={modalMaterialVisible}>
        <View style={styles.modalCentrada}>
          <View style={styles.modalCuerpo}>
            <Text style={styles.modalTitulo}>Nuevo Material en Catálogo</Text>
            <TextInput style={styles.inputModal} placeholder="Nombre del artículo..." value={nuevoNombreMaterial} onChangeText={filtrarMaterialesDuplicadosModal} />
            
            {sugerenciasDuplicadosModal.length > 0 && (
              <View style={styles.sugerenciasDuplicadosModalContainer}>
                <Text style={styles.sugerenciasDuplicadosTituloModal}>⚠️ Ya existen similares:</Text>
                {sugerenciasDuplicadosModal.map(item => <Text key={item.id.toString()} style={styles.sugerenciaDuplicadaTextoModal}>• {item.nombre}</Text>)}
              </View>
            )}

            <View style={styles.selectorUnidadesMalla}>
              {['UND', 'METROS', 'KG', 'JUEGOS'].map(u => (
                <TouchableOpacity key={u} style={[styles.btnUnidadSelector, nuevaUnidadMaterial === u && styles.btnUnidadSelectorActivo]} onPress={() => setNuevaUnidadMaterial(u)}>
                  <Text style={[styles.textoUnidadSelector, nuevaUnidadMaterial === u && styles.textoUnidadSelectorActivo]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalMallaBotones}>
              <TouchableOpacity style={styles.btnModalCancelar} onPress={() => { setModalMaterialVisible(false); setNuevoNombreMaterial(''); setSugerenciasDuplicadosModal([]); }}>
                <Text style={{color: '#495057'}}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnModalGuardar} onPress={handleCrearMaterialCatalogo}>
                <Text style={{color: '#FFF', fontWeight: 'bold'}}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CREAR PROYECTO */}
      <Modal animationType="slide" transparent visible={modalProyectoVisible}>
        <View style={styles.modalCentrada}>
          <View style={styles.modalCuerpo}>
            <Text style={styles.modalTitulo}>Registrar Frente de Obra Nuevo</Text>
            <Text style={{fontSize: 12, color: '#7A7B80', marginBottom: 10}}>Ingresa el nombre del proyecto o cliente para darlo de alta en el sistema.</Text>
            <TextInput style={styles.inputModal} placeholder="Ej: Proyecto Solar Parcela San José" value={nuevoNombreProyecto} onChangeText={setNuevoNombreProyecto} />
            <View style={styles.modalMallaBotones}>
              <TouchableOpacity style={styles.btnModalCancelar} onPress={() => { setModalProyectoVisible(false); setNuevoNombreProyecto(''); }}>
                <Text style={{color: '#495057'}}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnModalGuardar, { backgroundColor: '#2196F3' }]} onPress={handleCrearProyectoBackend}>
                <Text style={{color: '#FFF', fontWeight: 'bold'}}>Registrar Obra</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 5 },
  pantallaCarga: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  textoCarga: { marginTop: 10, color: '#7A7B80' },
  
  // BARRA DE PROGRESO SUPERIOR
  barraProgresoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12, paddingHorizontal: 40 },
  nodoProgreso: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E1E5EB', alignItems: 'center', justifyContent: 'center' },
  nodoActivo: { backgroundColor: '#87C442' },
  nodoTexto: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  lineaProgreso: { flex: 1, height: 3, backgroundColor: '#E1E5EB', marginHorizontal: 4 },
  lineaActiva: { backgroundColor: '#87C442' },

  seccionTitulo: { fontSize: 16, fontWeight: 'bold', color: '#1A1B1F', marginBottom: 2 },
  seccionSubtitulo: { fontSize: 12, color: '#7A7B80', marginBottom: 15 },
  label: { fontSize: 12, fontWeight: '600', color: '#495057', marginBottom: 4 },
  filaLabelBoton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5, marginBottom: 4 },
  btnTextoAccesoRapido: { fontSize: 12, color: '#0066CC', fontWeight: 'bold' },
  input: { backgroundColor: '#F1F3F5', padding: 11, borderRadius: 8, fontSize: 15, marginBottom: 4, color: '#333', borderWidth: 1, borderColor: '#EAEAEA' },
  lineaDivisoria: { height: 1, backgroundColor: '#E1E5EB', marginVertical: 10 },
  tarjetaInformativa: { backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginVertical: 10 },
  tarjetaInformativaTexto: { color: '#2E7D32', fontSize: 13, fontWeight: '500' },

  // PASO 1: DISEÑO BOTONES GRANDES
  tipoMallaVertical: { flexDirection: 'column', marginTop: 5 },
  tipoBotonGrande: { width: '100%', paddingVertical: 15, borderRadius: 10, backgroundColor: '#F8F9FA', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#E1E5EB', elevation: 1 },
  tipoTextoGrande: { fontSize: 14, color: '#333', fontWeight: 'bold' },
  tipoActivoSalida: { backgroundColor: '#E3F2FD', borderColor: '#2196F3' },
  tipoActivoCompraDir: { backgroundColor: '#E0F7FA', borderColor: '#00BCD4' },
  tipoActivoDev: { backgroundColor: '#FFF3E0', borderColor: '#FF9800' },
  tipoActivoEntrada: { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' },

  // BOTONES NAVEGACIÓN PASO 2
  mallaBotonesNavegacion: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
  btnNavegacionAtras: { flex: 1, paddingVertical: 12, backgroundColor: '#F1F3F5', borderRadius: 8, alignItems: 'center', marginRight: 5 },
  btnNavegacionAtrasTexto: { color: '#495057', fontWeight: '600' },
  btnNavegacionSiguiente: { flex: 1, paddingVertical: 12, backgroundColor: '#87C442', borderRadius: 8, alignItems: 'center', marginLeft: 5 },
  btnNavegacionSiguienteTexto: { color: '#FFF', fontWeight: 'bold' },

  sugerenciasContainer: { backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#E1E5EB', marginBottom: 8, elevation: 2 },
  sugerenciaItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#F1F3F5' },
  sugerenciaTexto: { fontSize: 13, color: '#333' },
  
  cajaCantidadUnidad: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F3F5', borderRadius: 8, borderWidth: 1, borderColor: '#EAEAEA', overflow: 'hidden', height: 44 },
  badgeUnidadFija: { backgroundColor: '#E1E5EB', height: '100%', paddingHorizontal: 12, justifyContent: 'center' },
  badgeUnidadFijaTexto: { fontSize: 11, fontWeight: 'bold', color: '#495057' },

  btnAgregarLista: { backgroundColor: '#2196F3', padding: 11, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  btnAgregarListaTexto: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  
  carritoCaja: { backgroundColor: '#F8F9FA', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E1E5EB', marginTop: 15 },
  carritoTitulo: { fontSize: 12, fontWeight: 'bold', color: '#495057', marginBottom: 6 },
  carritoFila: { flexDirection: 'row', backgroundColor: '#FFF', padding: 8, borderRadius: 6, marginBottom: 5, borderWidth: 1, borderColor: '#EAEAEA', alignItems: 'center', justifyContent: 'space-between' },
  carritoFilaTexto: { fontSize: 13, color: '#333', flex: 1 },
  btnEliminarTexto: { color: '#D32F2F', fontWeight: 'bold', fontSize: 12 },
  
  btnGuardar: { backgroundColor: '#87C442', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 15, marginBottom: 15 },
  btnTexto: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },

  sugerenciasDuplicadosModalContainer: { backgroundColor: '#FFF3E0', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#FFB74D', marginBottom: 8 },
  sugerenciasDuplicadosTituloModal: { fontSize: 11, color: '#E65100', fontWeight: 'bold' },
  sugerenciaDuplicadaTextoModal: { fontSize: 12, color: '#E65100', fontStyle: 'italic' },

  modalCentrada: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
  modalCuerpo: { width: '100%', backgroundColor: '#FFF', borderRadius: 12, padding: 16, elevation: 4 },
  modalTitulo: { fontSize: 15, fontWeight: 'bold', color: '#2D2E31', marginBottom: 8 },
  inputModal: { backgroundColor: '#F8F9FA', padding: 10, borderRadius: 6, fontSize: 14, color: '#333', borderWidth: 1, borderColor: '#E1E5EB', marginBottom: 8 },
  selectorUnidadesMalla: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 6 },
  btnUnidadSelector: { flex: 1, paddingVertical: 8, marginHorizontal: 2, backgroundColor: '#F1F3F5', borderRadius: 6, alignItems: 'center' },
  btnUnidadSelectorActivo: { backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: '#4CAF50' },
  textoUnidadSelector: { fontSize: 11, color: '#495057' },
  textoUnidadSelectorActivo: { color: '#4CAF50', fontWeight: 'bold' },
  modalMallaBotones: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btnModalCancelar: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F1F3F5', borderRadius: 6, marginRight: 5 },
  btnModalGuardar: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#4CAF50', borderRadius: 6, marginLeft: 5 }
});