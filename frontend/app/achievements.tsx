import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface Achievement {
  id: string;
  title: string;
  condition_type: string;
  condition_value: number;
  reward_points: number;
  unlocked?: boolean;
}

interface User {
  id?: string;
  name: string;
  email: string;
  total_points: number;
  level: number;
  badges: string[];
  routes_completed: number;
  achievements?: string[];
}

export default function AchievementsScreen() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const savedUser = await AsyncStorage.getItem('travelUser');
      if (savedUser) setUser(JSON.parse(savedUser));
      await loadAchievements(JSON.parse(savedUser || 'null'));
      setLoading(false);
    })();
  }, []);

  const loadAchievements = async (u: User | null) => {
    try {
      if (!u?.id) return;
      const resp = await fetch(`${API_BASE}/api/achievements/status?user_id=${u.id}`);
      if (resp.ok) {
        const data = await resp.json();
        setAchievements(data);
      }
    } catch (e) {
      console.error('loadAchievements error', e);
    }
  };

  const checkAchievements = async () => {
    try {
      if (!user?.id) return;
      const resp = await fetch(`${API_BASE}/api/achievements/check?user_id=${user.id}`, { method: 'POST' });
      if (resp.ok) {
        const data = await resp.json();
        const unlocked = data.unlocked || [];
        if (unlocked.length > 0) {
          Alert.alert('Achievements Unlocked!', `${unlocked.join(', ')} (+${data.awarded_points} pts)`);
        } else {
          Alert.alert('No new achievements', 'Keep going!');
        }
        // refresh user and achievements
        const u = await (await fetch(`${API_BASE}/api/users/${user.id}`)).json();
        setUser(u);
        await AsyncStorage.setItem('travelUser', JSON.stringify(u));
        await loadAchievements(u);
      }
    } catch (e) {
      console.error('checkAchievements error', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Achievements...</Text>
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
        <Text style={styles.title}>Achievements</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.pointsBar}>
        <Ionicons name="star" size={20} color="#FFD700" />
        <Text style={styles.pointsText}>{user?.total_points ?? 0} pts</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.primaryBtn} onPress={checkAchievements}>
          <Text style={styles.primaryBtnText}>Check</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {achievements.map((a) => (
          <View key={a.id} style={[styles.card, a.unlocked ? styles.unlocked : styles.locked]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{a.title}</Text>
              {a.unlocked ? (
                <Ionicons name="ribbon" size={20} color="#4CAF50" />
              ) : (
                <Ionicons name="lock-closed" size={18} color="#999" />
              )}
            </View>
            <Text style={styles.cardText}>
              Condition: {a.condition_type === 'points' ? `Earn ${a.condition_value} points` : `Complete ${a.condition_value} routes`}
            </Text>
            <Text style={styles.cardSub}>Reward: +{a.reward_points} pts</Text>
          </View>
        ))}
        {achievements.length === 0 && (
          <View style={styles.center}>
            <Text style={styles.cardText}>No achievements configured.</Text>
          </View>
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
  pointsBar: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'white' },
  pointsText: { marginLeft: 6, fontWeight: '600', color: '#333' },
  primaryBtn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  primaryBtnText: { color: 'white', fontWeight: '600' },
  list: { padding: 16 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  unlocked: { borderColor: '#4CAF50' },
  locked: { borderColor: '#EEE' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontWeight: '700', color: '#333', fontSize: 16 },
  cardText: { color: '#555' },
  cardSub: { color: '#777', marginTop: 4 },
});