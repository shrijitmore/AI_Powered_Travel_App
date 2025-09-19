import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface LocationData { latitude: number; longitude: number; name: string }
interface PathItem {
  id: string;
  name: string;
  start_point: LocationData;
  end_point: LocationData;
  difficulty: string;
  ai_suggested: boolean;
}

export default function PathsListScreen() {
  const [loading, setLoading] = useState(true);
  const [paths, setPaths] = useState<PathItem[]>([]);
  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
  const router = useRouter();

  useEffect(() => {
    (async () => {
      await loadPaths();
      setLoading(false);
    })();
  }, []);

  const seedIfEmpty = async () => {
    try {
      await fetch(`${API_BASE}/api/seed`, { method: 'POST' });
    } catch {}
  };

  const loadPaths = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/paths`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length === 0) {
          await seedIfEmpty();
          const resp2 = await fetch(`${API_BASE}/api/paths`);
          if (resp2.ok) {
            const data2 = await resp2.json();
            setPaths(data2);
          }
        } else {
          setPaths(data);
        }
      }
    } catch (e) {
      console.error('loadPaths error', e);
      Alert.alert('Error', 'Failed to load paths');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Paths...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Select a Path</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {paths.map((p) => (
          <TouchableOpacity key={p.id} style={styles.card} onPress={() => router.push(`/paths/${p.id}`)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{p.name}</Text>
              {p.ai_suggested && <View style={styles.tag}><Text style={styles.tagText}>AI Suggested</Text></View>}
            </View>
            <Text style={styles.cardText}>Difficulty: {p.difficulty}</Text>
            <Text style={styles.cardSub}>{p.start_point?.name} → {p.end_point?.name}</Text>
          </TouchableOpacity>
        ))}
        {paths.length === 0 && (
          <View style={styles.center}><Text style={styles.cardText}>No paths yet.</Text></View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#666' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center' },
  list: { padding: 16 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontWeight: '700', color: '#333', fontSize: 16 },
  cardText: { color: '#555' },
  cardSub: { color: '#777', marginTop: 4 },
  tag: { backgroundColor: '#E3F2FD', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  tagText: { color: '#0A63C9', fontSize: 12, fontWeight: '600' },
});