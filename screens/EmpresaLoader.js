import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function EmpresaLoader() {
  const miAnimacionEscala = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Bucle infinito: se agranda a 1.2x su tamaño y vuelve a 1 en 1.4 segundos totales
    Animated.loop(
      Animated.sequence([
        Animated.timing(miAnimacionEscala, {
          toValue: 1.2,
          duration: 700,
          useNativeDriver: true, // Renderizado por hardware (súper fluido)
        }),
        Animated.timing(miAnimacionEscala, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [miAnimacionEscala]);

  return (
    <View style={styles.loaderContainer}>
      <Animated.Image
        source={require('../assets/icono-carga.png')} // Sube un nivel para buscar la carpeta assets
        style={[
          styles.logoLoader, 
          { transform: [{ scale: miAnimacionEscala }] }
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    width: '100%',
  },
  logoLoader: {
    width: 55,  // Tamaño óptimo para que resalte dentro del formulario
    height: 55,
  },
});