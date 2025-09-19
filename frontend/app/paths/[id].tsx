import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LocationData { latitude: number; longitude: number; name: string }
interface PathItem {
  id: string;
  name: string;
  start_point: LocationData;
  end_point: LocationData;
  difficulty: string;
  ai_suggested: boolean;
}
interface TaskItem {
  id: string;
  path_id: string;
  task_description: string;
  reward_points: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
}
interface User { id?: string; name: string; email: string; total_points: number; level: number; badges: string[]; routes_completed: number }

export default function PathDetailScreen() {
  const [loading, setLoading] = useState(true);
  const [path, setPath] = useState<PathItem | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('travelUser');
      if (saved) setUser(JSON.parse(saved));
      await loadData();
      setLoading(false);
    })();
  }, [id]);

  const loadData = async () => {
    try {
      const [pResp, tResp] = await Promise.all([
        fetch(`${API_BASE}/api/paths/${id}`),
        fetch(`${API_BASE}/api/paths/${id}/tasks`),
      ]);
      if (pResp.ok) setPath(await pResp.json());
      if (tResp.ok) setTasks(await tResp.json());
    } catch (e) {
      console.error('loadData error', e);
      Alert.alert('Error', 'Failed to load path');
    }
  };

  const setStatus = async (taskId: string, status: 'Not Started' | 'In Progress' | 'Completed') => {
    try {
      const url = `${API_BASE}/api/tasks/${taskId}/status?status=${encodeURIComponent(status)}${user?.id ? `&user_id=${user.id}` : ''}`;
      const resp = await fetch(url, { method: 'PATCH' });
      if (resp.ok) {
        const data = await resp.json();
        const updated = tasks.map(t => (t.id === taskId ? { ...t, status: data.task.status } : t));
        setTasks(updated);
        if (status === 'Completed') {
          const points = data.points_awarded || 0;
          const motivation = data.motivation || 'Nice!';
          Alert.alert('Task Completed', `${motivation} +${points} pts`);
          if (user && (points || (data.achievement?.awarded_points ?? 0))) {
            const refreshed = await (await fetch(`${API_BASE}/api/users/${user.id}`)).json();
            await AsyncStorage.setItem('travelUser', JSON.stringify(refreshed));
            setUser(refreshed);
          }
        }
      }
    } catch (e) {
      console.error('setStatus error', e);
      Alert.alert('Error', 'Unable to update task');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Path...</Text>
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
        <Text style={styles.title}>{path?.name || 'Path'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoText}>Difficulty: {path?.difficulty}</Text>
        <Text style={styles.infoSub}>{path?.start_point?.name} → {path?.end_point?.name}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {tasks.map((t) => (
          <View key={t.id} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <Text style={styles.taskTitle}>{t.task_description}</Text>
              <Text style={styles.points}>+{t.reward_points} pts</Text>
            </View>
            <Text style={styles.status}>Status: {t.status}</Text>
            <View style={styles.row}>
              {t.status === 'Not Started' && (
                <TouchableOpacity style={styles.btn} onPress={() => setStatus(t.id, 'In Progress')}>
                  <Text style={styles.btnText}>Start</Text>
                </TouchableOpacity>
              )}
              {t.status !== 'Completed' && (
                <TouchableOpacity style={[styles.btn, styles.completeBtn]} onPress={() => setStatus(t.id, 'Completed')}>
                  <Text style={styles.btnText}>Complete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {tasks.length === 0 && (
          <View style={styles.center}><Text style={styles.infoText}>No tasks for this path.</Text></View>
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
  infoCard: { margin: 16, padding: 16, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#EEE' },
  infoText: { color: '#333', fontWeight: '600' },
  infoSub: { color: '#666', marginTop: 6 },
  list: { padding: 16 },
  taskCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
  taskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  taskTitle: { fontWeight: '700', color: '#333', fontSize: 16 },
  points: { color: '#4CAF50', fontWeight: '700' },
  status: { color: '#777', marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  completeBtn: { backgroundColor: '#4CAF50' },
  btnText: { color: 'white', fontWeight: '600' },
});