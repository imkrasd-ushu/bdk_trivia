import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

const hawiImage = require('../../assets/hawi.png');
const ammiImage = require('../../assets/ammi.png');

export default function Host({ who = 'hawi', text }) {
  const hawi = who === 'hawi';
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(bob, { toValue: -7, duration: 520, useNativeDriver: true }),
          Animated.spring(bob, { toValue: -7, friction: 4, tension: 120, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(bob, { toValue: 3, duration: 420, useNativeDriver: true }),
          Animated.spring(bob, { toValue: 3, friction: 4, tension: 80, useNativeDriver: true }),
        ]),
        Animated.timing(bob, { toValue: 0, duration: 420, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [bob]);

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.avatarWrap, { transform: [{ translateY: bob }, { scale: 1.04 }] }]}>
        <Image source={hawi ? hawiImage : ammiImage} style={styles.avatarImage} resizeMode="cover" />
      </Animated.View>
      <View style={styles.speech}>
        <Text style={styles.name}>{hawi ? 'Hawi' : 'Ammi'}: </Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#F5D86D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  avatarImage: { width: 46, height: 46, borderRadius: 23 },
  speech: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#F9F6FF',
    borderColor: '#DCCAFD',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  name: { color: C.ink, fontWeight: '800' },
  text: { flexShrink: 1, color: C.ink, lineHeight: 20 },
});