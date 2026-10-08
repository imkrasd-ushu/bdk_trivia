import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ParentGate from '../../components/ParentGate';
import Screen from '../../components/Screen';
import { Heading, Eyebrow } from '../../components/Heading';
import { BIBLE_LINK } from '../../config/constants';
import { C } from '../../theme';

export default function BibleScreen() {
  const router = useRouter();
  const [refs, setRefs] = useState([]);
  const [selected, setSelected] = useState('');
  useEffect(() => { AsyncStorage.getItem('bdk-last-refs').then(value => setRefs(value ? JSON.parse(value) : [])); }, []);

  async function openReference() {
    try { await Linking.openURL(BIBLE_LINK(selected)); }
    catch { Alert.alert('Unable to open passage', 'Check your internet connection and try again.'); }
    setSelected('');
  }

  return (
    <Screen>
      <Eyebrow>READ TOGETHER</Eyebrow>
      <Heading>Find it in the Bible</Heading>
      <Text style={styles.copy}>Choose a passage from your last round and read it with a grown-up.</Text>
      <Card>
        {refs.length ? [...new Map(refs.map(item => [item.ref, item])).values()].map(item => (
          <Pressable key={item.ref} accessibilityRole="button" onPress={() => setSelected(item.ref)} style={styles.reference}>
            <View style={styles.refCopy}><Text style={styles.character}>{item.character}</Text><Text style={styles.ref}>{item.ref}</Text></View>
            <Text style={styles.open}>↗</Text>
          </Pressable>
        )) : <Text style={styles.copy}>Finish a game to collect passages here.</Text>}
      </Card>
      <Button title="Play a round" variant="sun" onPress={() => router.push('/levels')} />
      <ParentGate visible={Boolean(selected)} onCancel={() => setSelected('')} onConfirm={openReference} />
    </Screen>
  );
}

const styles = StyleSheet.create({ copy: { color: C.mute, lineHeight: 22 }, reference: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomColor: C.line, borderBottomWidth: 1 }, refCopy: { flex: 1 }, character: { color: C.ink, fontWeight: '800' }, ref: { color: C.green, marginTop: 3 }, open: { color: C.green, fontSize: 20, paddingHorizontal: 8 } });