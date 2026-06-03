import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar, Platform, Image, LayoutAnimation, UIManager } from 'react-native';
import api from './api'; 

import LoginScreen from './screens/LoginScreen';
import AttendanceScreen from './screens/AttendanceScreen';
import AttendanceHistoryScreen from './screens/AttendanceHistoryScreen';
import MaterialInventoryScreen from './screens/MaterialInventoryScreen';
import MaterialMovementScreen from './screens/MaterialMovementScreen';
import ProjectListScreen from './screens/ProjectListScreen'; 

// Habilitamos animaciones para que los menús se abran de forma fluida en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  const [token, setToken] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('menu'); 

  // Nuevos estados para controlar la apertura de los dos menús agrupados
  const [asistenciasAbierto, setAsistenciasAbierto] = useState(false);
  const [inventarioAbierto, setInventarioAbierto] = useState(false);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  if (!token) {
    return (
      <LoginScreen 
        onLoginSuccess={(userToken) => {
          setToken(userToken);
          setCurrentScreen('menu'); 
        }} 
      />
    );
  }

  const getHeaderTitle = () => {
    if (currentScreen === 'attendance') return '📍 Registrar Asistencia';
    if (currentScreen === 'history') return '📋 Historial de Marcas';
    if (currentScreen === 'inventory') return '📦 Inventario de Bodega';
    if (currentScreen === 'movement') return '🔄 Registrar Movimiento'; 
    if (currentScreen === 'projects') return '🚧 Control de Proyectos';
    return '';
  };

  const handleBackPress = () => {
    if (currentScreen === 'movement') {
      setCurrentScreen('inventory');
    } else {
      setCurrentScreen('menu');
    }
  };

  // Funciones para alternar la visibilidad de los sub-botones con animación
  const toggleAsistencias = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAsistenciasAbierto(!asistenciasAbierto);
  };

  const toggleInventario = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInventarioAbierto(!inventarioAbierto);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {currentScreen !== 'menu' && (
        <View style={styles.headerBar}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBackPress}
          >
            <Text style={styles.backArrowText}>⬅️</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {getHeaderTitle()}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      <View style={styles.content}>
        {currentScreen === 'menu' && (
          <View style={styles.menuContainer}>
            
            <Image 
              source={require('./assets/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />

            <Text style={styles.welcomeText}>Panel de Supervisión - Campo</Text>
            
            {/* 🗓️ BOTÓN PRINCIPAL 1: ASISTENCIAS */}
            <TouchableOpacity 
              style={[styles.menuButton, { backgroundColor: '#87C442' }]} 
              onPress={toggleAsistencias}
            >
              <Text style={styles.menuButtonText}>
                {asistenciasAbierto ? '▼ Asistencias' : '▶ Asistencias'}
              </Text>
            </TouchableOpacity>

            {asistenciasAbierto && (
              <View style={styles.subBotonera}>
                <TouchableOpacity 
                  style={styles.subBoton} 
                  onPress={() => setCurrentScreen('attendance')}
                >
                  <Text style={styles.textoSubBoton}>📍 Marcar Asistencia</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.subBoton} 
                  onPress={() => setCurrentScreen('history')}
                >
                  <Text style={styles.textoSubBoton}>📋 Ver Mi Historial</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 📦 BOTÓN PRINCIPAL 2: INVENTARIO DE MATERIAL */}
            <TouchableOpacity 
              style={[styles.menuButton, { backgroundColor: '#2D2E31', marginTop: 10 }]} 
              onPress={toggleInventario}
            >
              <Text style={styles.menuButtonText}>
                {inventarioAbierto ? '▼ Inventario de Material' : '▶ Inventario de Material'}
              </Text>
            </TouchableOpacity>

            {inventarioAbierto && (
              <View style={styles.subBotonera}>
                <TouchableOpacity 
                  style={styles.subBoton} 
                  onPress={() => setCurrentScreen('inventory')}
                >
                  <Text style={styles.textoSubBoton}>📦 Inventario de Bodega</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.subBoton} 
                  onPress={() => setCurrentScreen('projects')}
                >
                  <Text style={styles.textoSubBoton}>🚧 Material por Proyecto</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* BOTÓN DE LOGOUT (Se mantiene intacto abajo) */}
            <TouchableOpacity 
              style={styles.logoutButton} 
              onPress={() => {
                setToken(null);
                api.defaults.headers.common['Authorization'] = '';
                // Reseteamos menús al cerrar sesión
                setAsistenciasAbierto(false);
                setInventarioAbierto(false);
              }}
            >
              <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentScreen === 'attendance' && <AttendanceScreen token={token} />}
        {currentScreen === 'history' && <AttendanceHistoryScreen token={token} />}
        
        {currentScreen === 'inventory' && (
          <MaterialInventoryScreen 
            token={token} 
            navigation={(pantalla) => setCurrentScreen(pantalla)} 
          />
        )}

        {currentScreen === 'movement' && (
          <MaterialMovementScreen 
            token={token} 
            onMovimientoExitoso={() => setCurrentScreen('inventory')} 
          />
        )}

        {currentScreen === 'projects' && (
          <ProjectListScreen token={token} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 60,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5EB',
    paddingHorizontal: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
  backButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  backArrowText: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D2E31',
  },
  content: {
    flex: 1,
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoImage: {
    width: 250, 
    height: 100,
    marginBottom: 10,
  },
  welcomeText: {
    fontSize: 15,
    color: '#7A7B80',
    fontWeight: '500',
    marginBottom: 30, 
    textAlign: 'center',
  },
  menuButton: {
    width: '85%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  menuButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // --- NUEVOS ESTILOS PARA LOS SUB-BOTONES ---
  subBotonera: {
    width: '85%',
    backgroundColor: '#EFEFEF',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 10,
    marginTop: -4, // Hace que se acople perfectamente abajo del botón principal
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  subBoton: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginTop: 8,
    elevation: 1,
  },
  textoSubBoton: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
  },
  // ------------------------------------------
  logoutButton: {
    marginTop: 30,
    padding: 10,
  },
  logoutButtonText: {
    color: '#DC3545',
    fontWeight: 'bold',
    fontSize: 15,
  },
});