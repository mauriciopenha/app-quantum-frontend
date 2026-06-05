import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export default function ProjectDetailScreen({ token, proyectoId, proyectoNombre }) {
  // Estado para controlar en qué pestaña estamos: 'checklist' o 'materiales'
  const [pestanaActiva, setPestanaActiva] = useState('checklist');

  return (
    <View style={styles.container}>
      {/* Información del Proyecto */}
      <View style={styles.bannerProyecto}>
        <Text style={styles.nombreProyecto}>🏗️ {proyectoNombre}</Text>
        <Text style={styles.idProyecto}>ID de Obra: #{proyectoId}</Text>
      </View>

      {/* 🎛️ BOTONERA DE PESTAÑAS (TABS) */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabButton, pestanaActiva === 'checklist' && styles.tabButtonActivo]}
          onPress={() => setPestanaActiva('checklist')}
        >
          <Text style={[styles.tabTexto, pestanaActiva === 'checklist' && styles.tabTextoActivo]}>
            📋 Checklist de Obra
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tabButton, pestanaActiva === 'materiales' && styles.tabButtonActivo]}
          onPress={() => setPestanaActiva('materiales')}
        >
          <Text style={[styles.tabTexto, pestanaActiva === 'materiales' && styles.tabTextoActivo]}>
            📦 Materiales en Obra
          </Text>
        </TouchableOpacity>
      </View>

      {/* 📑 CONTENIDO DINÁMICO SEGÚN LA PESTAÑA */}
      <View style={styles.contenidoSaturado}>
        {pestanaActiva === 'checklist' ? (
          <View style={styles.vistaPrueba}>
            <Text style={styles.textoPrueba}>Aquí cargaremos las 6 etapas solares desde Django ☀️</Text>
          </View>
        ) : (
          <View style={styles.vistaPrueba}>
            <Text style={styles.textoPrueba}>Aquí listaremos el inventario de bodega y compras directas 🛒</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  bannerProyecto: { backgroundColor: '#FFF', padding: 15, borderBottomWidth: 1, borderBottomColor: '#E1E5EB' },
  nombreProyecto: { fontSize: 18, fontWeight: 'bold', color: '#2D2E31' },
  idProyecto: { fontSize: 12, color: '#7A7B80', marginTop: 4, fontWeight: '500' },
  
  // Estilos de las pestañas
  tabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E1E5EB' },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabButtonActivo: { borderBottomColor: '#87C442' },
  tabTexto: { fontSize: 14, color: '#7A7B80', fontWeight: '600' },
  tabTextoActivo: { color: '#87C442', fontWeight: 'bold' },
  
  contenidoSaturado: { flex: 1, padding: 15 },
  vistaPrueba: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#E1E5EB' },
  textoPrueba: { color: '#7A7B80', fontSize: 14, textAlign: 'center', fontWeight: '500' }
});