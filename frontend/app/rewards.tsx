import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

interface RewardItem {
  id: string;
  item_name: string;
  cost: number;
  category: string;
}

interface User {
  id?: string;
  name: string;
  email: string;
  total_points: number;
  level: number;
  badges: string[];
  routes_completed: number;
  rewards_owned?: string[];
}

export default function RewardsScreen() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<RewardItem[]>([]);
  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const savedUser = await AsyncStorage.getItem('travelUser');
      if (savedUser) setUser(JSON.parse(savedUser));
      await loadItems();
      setLoading(false);
    })();
  }, []);

  const loadItems = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/rewards/items`);
      if (resp.ok) {
        const data = await resp.json();
        setItems(data);
      }
    } catch (e) {
      console.error('loadItems error', e);
    }
  };

  const claim = async (itemId: string) => {
    try {
      if (!user?.id) return;
      const resp = await fetch(`${API_BASE}/api/rewards/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, item_id: itemId }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const updatedUser = data.user;
        await AsyncStorage.setItem('travelUser', JSON.stringify(updatedUser));
        setUser(updatedUser);
        Alert.alert('Reward Claimed', `You bought ${data.item.item_name}`);
      } else {
        const err = await resp.json();
        Alert.alert('Cannot claim', err.detail || 'Insufficient points');
      }
    } catch (e) {
      console.error('claim error', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Rewards...</Text>
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
        <Text style={styles.title}>Rewards Store</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.pointsBar}>
        <Ionicons name="star" size={20} color="#FFD700" />
        <Text style={styles.pointsText}>{user?.total_points ?? 0} pts</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {items.map((it) => (
          <View key={it.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{it.item_name}</Text>
              <View style={styles.tag}><Text style={styles.tagText}>{it.category}</Text></View>
            </View>
            <Text style={styles.cardText}>Cost: {it.cost} pts</Text>
            <TouchableOpacity style={styles.buyBtn} onPress={() => claim(it.id)}>
              <Text style={styles.buyBtnText}>Claim</Text>
            </TouchableOpacity>
          </View>
        ))}
        {items.length === 0 && (
          <View style={styles.center}><Text style={styles.cardText}>No items yet.</Text></View>
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
  list: { padding: 16 },
  card: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#EEE' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  cardTitle: { fontWeight: '700', color: '#333', fontSize: 16 },
  cardText: { color: '#555' },
  tag: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  tagText: { color: '#2E7D32', fontSize: 12, fontWeight: '600' },
  buyBtn: { backgroundColor: '#007AFF', marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  buyBtnText: { color: 'white', fontWeight: '600' },
});