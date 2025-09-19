import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

const { width, height } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  name: string;
}

interface RouteData {
  type: string;
  distance: number;
  duration: number;
  description: string;
  waypoints: LocationData[];
  color: string;
  challenges: Challenge[];
}

interface Challenge {
  id?: string;
  type: string;
  title: string;
  description: string;
  location: LocationData;
  points: number;
  difficulty?: string;
  completed?: boolean;
}

interface POI {
  id: string;
  type: string;
  name: string;
  location: LocationData;
  description: string;
  rating: number;
  challenge_available: boolean;
}

interface PokemonGoMapProps {
  onLocationUpdate?: (location: Location.LocationObject) => void;
}

export default function PokemonGoMap({ onLocationUpdate }: PokemonGoMapProps) {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<LocationData | null>(null);
  
  // Animation values for Pokemon Go style effects
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView>(null);

  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    initializeMap();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const initializeMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for the map.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setCurrentLocation(location);
      onLocationUpdate?.(location);
      
      await loadNearbyData(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      console.error('Error initializing map:', error);
      Alert.alert('Error', 'Failed to initialize map. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyData = async (lat: number, lon: number) => {
    try {
      // Load POIs
      const poisResponse = await fetch(`${API_BASE}/api/map/points-of-interest?lat=${lat}&lon=${lon}&radius=0.1`);
      if (poisResponse.ok) {
        const poisData = await poisResponse.json();
        setPois(poisData.points_of_interest);
      }

      // Load Challenges
      const challengesResponse = await fetch(`${API_BASE}/api/map/challenges/nearby?lat=${lat}&lon=${lon}&radius=0.1`);
      if (challengesResponse.ok) {
        const challengesData = await challengesResponse.json();
        setChallenges(challengesData.challenges);
      }
    } catch (error) {
      console.error('Error loading nearby data:', error);
    }
  };

  const planRouteToDestination = async (destination: LocationData) => {
    if (!currentLocation) return;
    
    try {
      setLoading(true);
      const routeRequest = {
        start: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          name: 'Current Location'
        },
        end: destination,
        preferences: { type: 'scenic' }
      };

      const response = await fetch(`${API_BASE}/api/routes/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routeRequest)
      });

      if (response.ok) {
        const routeData = await response.json();
        setRoutes(routeData.routes);
        setShowRouteModal(true);
      }
    } catch (error) {
      console.error('Error planning route:', error);
      Alert.alert('Error', 'Failed to plan route. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectRoute = (route: RouteData) => {
    setSelectedRoute(route);
    setShowRouteModal(false);
    
    // Fit map to show the route
    if (mapRef.current && currentLocation) {
      const coordinates = [
        {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        },
        ...route.waypoints.map(wp => ({ latitude: wp.latitude, longitude: wp.longitude }))
      ];
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
    
    Alert.alert('Route Selected', `${route.type.toUpperCase()} route selected! Ready for adventure!`);
  };

  const onMarkerPress = (poi: POI) => {
    setSelectedDestination(poi.location);
    Alert.alert(
      poi.name,
      `${poi.description}\n\nRating: ${poi.rating.toFixed(1)} ⭐\n${poi.challenge_available ? '🎯 Challenge Available!' : ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Plan Route', onPress: () => planRouteToDestination(poi.location) }
      ]
    );
  };

  const onChallengePress = (challenge: Challenge) => {
    Alert.alert(
      challenge.title,
      `${challenge.description}\n\nReward: ${challenge.points} points\nDifficulty: ${challenge.difficulty || 'Unknown'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept Challenge', onPress: () => Alert.alert('Challenge Accepted!', 'Head to the location to complete this challenge!') }
      ]
    );
  };

  const getMarkerIcon = (type: string) => {
    const icons = {
      restaurant: 'restaurant',
      landmark: 'flag',
      viewpoint: 'camera',
      gas_station: 'car',
      hotel: 'bed',
      photo: 'camera-outline',
      food: 'restaurant-outline',
      location: 'location-outline',
      hidden_gem: 'diamond-outline',
    };
    return icons[type] || 'location';
  };

  const getMarkerColor = (type: string) => {
    const colors = {
      restaurant: '#FF6B6B',
      landmark: '#4ECDC4',
      viewpoint: '#45B7D1',
      gas_station: '#96CEB4',
      hotel: '#FFEAA7',
      photo: '#FF6B6B',
      food: '#FFD93D',
      location: '#4ECDC4',
      hidden_gem: '#9B59B6',
    };
    return colors[type] || '#6C5CE7';
  };

  const renderCustomMarker = (poi: POI) => (
    <View style={[styles.customMarker, { backgroundColor: getMarkerColor(poi.type) }]}>
      <Ionicons name={getMarkerIcon(poi.type) as any} size={20} color="white" />
      {poi.challenge_available && (
        <View style={styles.challengeBadge}>
          <Text style={styles.challengeBadgeText}>!</Text>
        </View>
      )}
    </View>
  );

  const renderChallengeMarker = (challenge: Challenge) => (
    <Animated.View style={[
      styles.challengeMarker,
      {
        backgroundColor: challenge.completed ? '#4CAF50' : '#FFD93D',
        transform: [{ scale: pulseAnim }]
      }
    ]}>
      <Ionicons 
        name={challenge.completed ? 'checkmark' : 'diamond'} 
        size={16} 
        color={challenge.completed ? 'white' : '#333'} 
      />
    </Animated.View>
  );

  const renderRouteModal = () => (
    <Modal visible={showRouteModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.routeModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Adventure</Text>
            <TouchableOpacity onPress={() => setShowRouteModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView>
            {routes.map((route, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.routeCard, { borderLeftColor: route.color }]}
                onPress={() => selectRoute(route)}
              >
                <View style={styles.routeHeader}>
                  <Text style={styles.routeType}>{route.type.toUpperCase()}</Text>
                  <View style={styles.routeStats}>
                    <Text style={styles.routeDistance}>{route.distance} km</Text>
                    <Text style={styles.routeDuration}>{route.duration} min</Text>
                  </View>
                </View>
                <Text style={styles.routeDescription}>{route.description}</Text>
                {route.challenges.length > 0 && (
                  <View style={styles.challengesPreview}>
                    <Text style={styles.challengesTitle}>⚡ {route.challenges.length} Challenge{route.challenges.length > 1 ? 's' : ''}</Text>
                    {route.challenges.map((c, idx) => (
                      <Text key={idx} style={styles.challengeItem}>• {c.title} (+{c.points} pts)</Text>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading Adventure Map...</Text>
      </View>
    );
  }

  if (!currentLocation) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={48} color="#666" />
        <Text style={styles.errorText}>Location access required</Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeMap}>
          <Text style={styles.retryButtonText}>Enable Location</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        mapType={mapType}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {/* POI Markets */}
        {pois.map((poi) => (
          <Marker
            key={poi.id}
            coordinate={{ latitude: poi.location.latitude, longitude: poi.location.longitude }}
            onPress={() => onMarkerPress(poi)}
          >
            {renderCustomMarker(poi)}
          </Marker>
        ))}

        {/* Challenge Markers */}
        {challenges.map((challenge, index) => (
          <Marker
            key={`challenge_${index}`}
            coordinate={{ latitude: challenge.location.latitude, longitude: challenge.location.longitude }}
            onPress={() => onChallengePress(challenge)}
          >
            {renderChallengeMarker(challenge)}
          </Marker>
        ))}

        {/* Selected Route */}
        {selectedRoute && currentLocation && (
          <Polyline
            coordinates={[
              {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
              },
              ...selectedRoute.waypoints.map(wp => ({
                latitude: wp.latitude,
                longitude: wp.longitude,
              }))
            ]}
            strokeColor={selectedRoute.color}
            strokeWidth={4}
            strokePattern={[10, 5]}
          />
        )}
      </MapView>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setMapType(mapType === 'standard' ? 'satellite' : 'standard')}
        >
          <Ionicons name="layers" size={20} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            if (mapRef.current && currentLocation) {
              mapRef.current.animateToRegion({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              });
            }
          }}
        >
          <Ionicons name="locate" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* Route Info Bar */}
      {selectedRoute && (
        <View style={styles.routeInfoBar}>
          <View style={styles.routeInfoContent}>
            <Text style={styles.routeInfoTitle}>{selectedRoute.type.toUpperCase()} ADVENTURE</Text>
            <Text style={styles.routeInfoStats}>
              {selectedRoute.distance} km • {selectedRoute.duration} min • {selectedRoute.challenges.length} challenges
            </Text>
          </View>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => Alert.alert('Adventure Started!', '🚀 Your quest has begun! Follow the route and complete challenges to earn rewards.')}
          >
            <Text style={styles.startButtonText}>START</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Overlays */}
      <View style={styles.statsOverlay}>
        <View style={styles.statCard}>
          <Ionicons name="diamond" size={16} color="#FFD93D" />
          <Text style={styles.statText}>{challenges.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="location" size={16} color="#4ECDC4" />
          <Text style={styles.statText}>{pois.length}</Text>
        </View>
      </View>

      {renderRouteModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  customMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  challengeBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  challengeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  mapControls: {
    position: 'absolute',
    top: 50,
    right: 16,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  routeInfoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  routeInfoContent: {
    flex: 1,
  },
  routeInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  routeInfoStats: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statsOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 6,
  },
  statText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  routeModal: {
    backgroundColor: 'white',
    maxHeight: height * 0.7,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  routeCard: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    borderLeftWidth: 4,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  routeStats: {
    flexDirection: 'row',
    gap: 16,
  },
  routeDistance: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  routeDuration: {
    fontSize: 14,
    color: '#666',
  },
  routeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  challengesPreview: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
  },
  challengesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  challengeItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});