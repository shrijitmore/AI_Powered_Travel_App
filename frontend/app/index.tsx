import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import PokemonGoMap from '../components/PokemonGoMap';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

// Types
interface User {
  id?: string;
  name: string;
  email: string;
  total_points: number;
  level: number;
  badges: string[];
  routes_completed: number;
}

// Main App Component
export default function App() {
  const { user, appUser, loading: authLoading, logout, refreshAppUser } = useAuth();
  const [currentView, setCurrentView] = useState<'home' | 'route' | 'map' | 'profile' | 'leaderboard'>('home');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);

  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
  const router = useRouter();

  useEffect(() => {
    if (user && appUser) {
      requestLocationPermission();
    }
  }, [user, appUser]);

  // Redirect to auth if not authenticated
  if (!user) {
    router.replace('/auth');
    return null;
  }

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const completeRoute = async () => {
    if (!appUser?.id) return;
    
    try {
      setLoading(true);
      const sampleRoute = {
        user_id: appUser.id,
        start: { latitude: location?.coords.latitude || 0, longitude: location?.coords.longitude || 0, name: 'Start Location' },
        end: { latitude: (location?.coords.latitude || 0) + 0.1, longitude: (location?.coords.longitude || 0) + 0.1, name: 'End Location' },
        route_type: 'scenic', waypoints: [],
      };
      
      const routeResponse = await fetch(`${API_BASE}/api/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleRoute)
      });
      
      if (routeResponse.ok) {
        const createdRoute = await routeResponse.json();
        const completeResponse = await fetch(`${API_BASE}/api/routes/${createdRoute.id}/complete?user_id=${appUser.id}`, { method: 'PATCH' });
        
        if (completeResponse.ok) {
          const result = await completeResponse.json();
          await refreshAppUser(); // Refresh user data
          Alert.alert('🎉 Route Completed!', `${result.motivation || 'Great job!'} You earned ${result.points_awarded} points!`);
        }
      }
    } catch (error) {
      console.error('Error completing route:', error);
      Alert.alert('Error', 'Failed to complete route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Travel Quest...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderHomeView = () => (
    <ScrollView style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome, {currentUser?.name}!</Text>
        <View style={styles.pointsContainer}><Ionicons name="star" size={20} color="#FFD700" /><Text style={styles.pointsText}>{currentUser?.total_points || 0} Points</Text></View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}><Ionicons name="location" size={24} color="#007AFF" /><Text style={styles.statNumber}>{currentUser?.routes_completed || 0}</Text><Text style={styles.statLabel}>Routes Completed</Text></View>
        <View style={styles.statCard}><Ionicons name="trophy" size={24} color="#FF6B6B" /><Text style={styles.statNumber}>Level {currentUser?.level || 1}</Text><Text style={styles.statLabel}>Explorer Level</Text></View>
        <View style={styles.statCard}><Ionicons name="ribbon" size={24} color="#4ECDC4" /><Text style={styles.statNumber}>{currentUser?.badges?.length || 0}</Text><Text style={styles.statLabel}>Badges Earned</Text></View>
      </View>

      <View style={styles.actionSection}>
        <Text style={styles.sectionTitle}>Ready for Adventure?</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={() => setCurrentView('map')}>
          <Ionicons name="navigate" size={20} color="white" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Explore Map</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/paths')}>
          <Ionicons name="map" size={20} color="#007AFF" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>Select Destination | Paths</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={planRoute}>
          <Ionicons name="map-outline" size={20} color="#007AFF" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>Plan New Route</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={completeRoute}>
          <Ionicons name="checkmark-circle" size={20} color="#007AFF" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>Complete Demo Route</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/rewards')}>
          <Ionicons name="pricetags" size={20} color="#007AFF" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>View Rewards</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/achievements')}>
          <Ionicons name="ribbon" size={20} color="#007AFF" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>My Achievements</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push('/assistant')}>
          <Ionicons name="chatbubble" size={20} color="#007AFF" style={styles.buttonIcon} />
          <Text style={styles.secondaryButtonText}>Ask AI Assistant</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>App Features</Text>
        <View style={styles.featureItem}><Ionicons name="map" size={20} color="#007AFF" /><Text style={styles.featureText}>Interactive map with POIs</Text></View>
        <View style={styles.featureItem}><Ionicons name="game-controller" size={20} color="#FF6B6B" /><Text style={styles.featureText}>Gamified challenges and rewards</Text></View>
        <View style={styles.featureItem}><Ionicons name="people" size={20} color="#4ECDC4" /><Text style={styles.featureText}>Leaderboards and achievements</Text></View>
        <View style={styles.featureItem}><Ionicons name="chatbubble" size={20} color="#FFD700" /><Text style={styles.featureText}>AI travel assistant</Text></View>
      </View>
    </ScrollView>
  );

  const renderProfileView = () => (
    <ScrollView style={styles.content}>
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}><Ionicons name="person" size={40} color="white" /></View>
        <Text style={styles.profileName}>{currentUser?.name}</Text>
        <Text style={styles.profileEmail}>{currentUser?.email}</Text>
      </View>
      <View style={styles.profileStats}>
        <View style={styles.profileStatItem}><Text style={styles.profileStatNumber}>{currentUser?.total_points || 0}</Text><Text style={styles.profileStatLabel}>Total Points</Text></View>
        <View style={styles.profileStatItem}><Text style={styles.profileStatNumber}>{currentUser?.routes_completed || 0}</Text><Text style={styles.profileStatLabel}>Routes</Text></View>
        <View style={styles.profileStatItem}><Text style={styles.profileStatNumber}>Level {currentUser?.level || 1}</Text><Text style={styles.profileStatLabel}>Explorer Level</Text></View>
      </View>
      <View style={styles.badgesSection}>
        <Text style={styles.sectionTitle}>Your Badges</Text>
        {currentUser?.badges && currentUser.badges.length > 0 ? (
          currentUser.badges.map((badge, index) => (
            <View key={index} style={styles.badgeItem}><Ionicons name="ribbon" size={20} color="#FFD700" /><Text style={styles.badgeText}>{badge}</Text></View>
          ))
        ) : (
          <Text style={styles.noBadgesText}>Complete routes to earn badges!</Text>
        )}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, currentView === 'home' && styles.activeTab]} onPress={() => setCurrentView('home')}>
          <Ionicons name="home" size={20} color={currentView === 'home' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, currentView === 'home' && styles.activeTabText]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, currentView === 'route' && styles.activeTab]} onPress={() => setCurrentView('route')}>
          <Ionicons name="map" size={20} color={currentView === 'route' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, currentView === 'route' && styles.activeTabText]}>Routes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, currentView === 'map' && styles.activeTab]} onPress={() => setCurrentView('map')}>
          <Ionicons name="navigate" size={20} color={currentView === 'map' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, currentView === 'map' && styles.activeTabText]}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, currentView === 'profile' && styles.activeTab]} onPress={() => setCurrentView('profile')}>
          <Ionicons name="person" size={20} color={currentView === 'profile' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, currentView === 'profile' && styles.activeTabText]}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, currentView === 'leaderboard' && styles.activeTab]} onPress={() => setCurrentView('leaderboard')}>
          <Ionicons name="trophy" size={20} color={currentView === 'leaderboard' ? '#007AFF' : '#666'} />
          <Text style={[styles.tabText, currentView === 'leaderboard' && styles.activeTabText]}>Leaderboard</Text>
        </TouchableOpacity>
      </View>

      {currentView === 'home' && renderHomeView()}
      {currentView === 'map' && <MapScreen />}
      {currentView === 'profile' && renderProfileView()}
      {(currentView === 'route' || currentView === 'leaderboard') && (
        <View style={styles.content}>
          <View style={styles.comingSoonContainer}>
            <Ionicons name="construct" size={48} color="#666" />
            <Text style={styles.comingSoonText}>Coming Soon!</Text>
            <Text style={styles.comingSoonSubtext}>
              {currentView === 'route' ? 'Advanced route mapping and tracking' : 'Social leaderboards and competitions'}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', paddingTop: Platform.OS === 'android' ? 25 : 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#E0E0E0', paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  activeTab: { borderTopWidth: 2, borderTopColor: '#007AFF' },
  tabText: { fontSize: 12, color: '#666', marginTop: 4 },
  activeTabText: { color: '#007AFF', fontWeight: '600' },
  content: { flex: 1 },
  header: { padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  welcomeText: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  pointsContainer: { flexDirection: 'row', alignItems: 'center' },
  pointsText: { fontSize: 16, fontWeight: '600', color: '#FFD700', marginLeft: 4 },
  statsContainer: { flexDirection: 'row', padding: 20, gap: 12 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  statNumber: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4 },
  actionSection: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  primaryButton: { backgroundColor: '#007AFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8, marginBottom: 12 },
  secondaryButton: { backgroundColor: 'white', borderWidth: 1, borderColor: '#007AFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8, marginTop: 10 },
  buttonIcon: { marginRight: 8 },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  secondaryButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  featuresSection: { padding: 20, backgroundColor: 'white', margin: 20, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  featureItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  featureText: { fontSize: 14, color: '#666', marginLeft: 12, flex: 1 },
  profileHeader: { alignItems: 'center', padding: 20, backgroundColor: 'white' },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  profileEmail: { fontSize: 14, color: '#666' },
  profileStats: { flexDirection: 'row', padding: 20, backgroundColor: 'white', marginTop: 1 },
  profileStatItem: { flex: 1, alignItems: 'center' },
  profileStatNumber: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  profileStatLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  badgesSection: { padding: 20, backgroundColor: 'white', margin: 20, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  badgeItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badgeText: { fontSize: 14, color: '#333', marginLeft: 8 },
  noBadgesText: { fontSize: 14, color: '#666', textAlign: 'center', fontStyle: 'italic' },
  comingSoonContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  comingSoonText: { fontSize: 24, fontWeight: 'bold', color: '#333', marginTop: 16 },
  comingSoonSubtext: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },
});