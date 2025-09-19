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
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  type: string;
  title: string;
  description: string;
  location: LocationData;
  points: number;
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

// Simple Map Component for Web Compatibility
const SimpleMapView = ({ children, style, onMapReady }: any) => {
  useEffect(() => {
    if (onMapReady) onMapReady();
  }, []);

  return (
    <View style={[styles.mapContainer, style]}>
      <View style={styles.mapPlaceholder}>
        <Ionicons name="map" size={48} color="#007AFF" />
        <Text style={styles.mapPlaceholderText}>Interactive Map</Text>
        <Text style={styles.mapPlaceholderSubtext}>
          {Platform.OS === 'web' ? 'Map optimized for mobile view' : 'Loading map...'}
        </Text>
      </View>
      {children}
    </View>
  );
};

export default function MapScreen() {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeOptionsVisible, setRouteOptionsVisible] = useState(false);
  const [destinationModalVisible, setDestinationModalVisible] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<LocationData | null>(null);

  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    initializeMap();
  }, []);

  const initializeMap = async () => {
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for the map.');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);

      // Load nearby POIs and challenges
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
      // Load points of interest
      const poisResponse = await fetch(
        `${API_BASE}/api/map/points-of-interest?lat=${lat}&lon=${lon}&radius=0.1`
      );
      if (poisResponse.ok) {
        const poisData = await poisResponse.json();
        setPois(poisData.points_of_interest);
      }

      // Load nearby challenges
      const challengesResponse = await fetch(
        `${API_BASE}/api/map/challenges/nearby?lat=${lat}&lon=${lon}&radius=0.1`
      );
      if (challengesResponse.ok) {
        const challengesData = await challengesResponse.json();
        setChallenges(challengesData.challenges);
      }
    } catch (error) {
      console.error('Error loading nearby data:', error);
    }
  };

  const selectDestination = (destination: LocationData) => {
    setSelectedDestination(destination);
    setDestinationModalVisible(false);
    planRouteToDestination(destination);
  };

  const planRouteToDestination = async (destination: LocationData) => {
    if (!currentLocation) return;

    try {
      setLoading(true);
      const routeRequest = {
        start: {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          name: 'Current Location',
        },
        end: destination,
        preferences: {
          type: 'scenic',
        },
      };

      const response = await fetch(`${API_BASE}/api/routes/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(routeRequest),
      });

      if (response.ok) {
        const routeData = await response.json();
        setRoutes(routeData.routes);
        setRouteOptionsVisible(true);
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
    setRouteOptionsVisible(false);
    Alert.alert('Route Selected', `${route.type.toUpperCase()} route selected! Distance: ${route.distance}km`);
  };

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'restaurant': return 'restaurant';
      case 'landmark': return 'flag';
      case 'viewpoint': return 'camera';
      case 'gas_station': return 'car';
      case 'hotel': return 'bed';
      case 'photo': return 'camera-outline';
      case 'food': return 'restaurant-outline';
      case 'location': return 'location-outline';
      case 'hidden_gem': return 'diamond-outline';
      default: return 'location';
    }
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'restaurant': return '#FF6B6B';
      case 'landmark': return '#4ECDC4';
      case 'viewpoint': return '#45B7D1';
      case 'gas_station': return '#96CEB4';
      case 'hotel': return '#FFEAA7';
      default: return '#6C5CE7';
    }
  };

  const renderRouteOptions = () => (
    <Modal
      visible={routeOptionsVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setRouteOptionsVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.routeOptionsModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Your Route</Text>
            <TouchableOpacity
              onPress={() => setRouteOptionsVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.routesList}>
            {routes.map((route, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.routeOption, { borderLeftColor: route.color }]}
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
                    <Text style={styles.challengesTitle}>
                      🎯 {route.challenges.length} Challenge{route.challenges.length > 1 ? 's' : ''}
                    </Text>
                    {route.challenges.map((challenge, idx) => (
                      <Text key={idx} style={styles.challengeItem}>
                        • {challenge.title} (+{challenge.points} pts)
                      </Text>
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

  const renderDestinationModal = () => (
    <Modal
      visible={destinationModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setDestinationModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.destinationModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Destination</Text>
            <TouchableOpacity
              onPress={() => setDestinationModalVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.destinationsList}>
            {pois.map((poi) => (
              <TouchableOpacity
                key={poi.id}
                style={styles.destinationOption}
                onPress={() => selectDestination(poi.location)}
              >
                <View style={styles.destinationHeader}>
                  <Ionicons
                    name={getMarkerIcon(poi.type) as any}
                    size={24}
                    color={getMarkerColor(poi.type)}
                  />
                  <View style={styles.destinationInfo}>
                    <Text style={styles.destinationName}>{poi.name}</Text>
                    <Text style={styles.destinationType}>{poi.type.replace('_', ' ')}</Text>
                  </View>
                  {poi.challenge_available && (
                    <View style={styles.challengeBadge}>
                      <Text style={styles.challengeBadgeText}>🎯</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.destinationDescription}>{poi.description}</Text>
                <Text style={styles.destinationRating}>⭐ {poi.rating.toFixed(1)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Map...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentLocation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={48} color="#666" />
          <Text style={styles.errorText}>Location access required</Text>
          <TouchableOpacity style={styles.retryButton} onPress={initializeMap}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SimpleMapView
        style={styles.map}
        onMapReady={() => console.log('Map ready')}
      >
        {/* Map Overlays */}
        <View style={styles.mapOverlays}>
          {/* POI List */}
          <View style={styles.poiList}>
            <Text style={styles.poiListTitle}>📍 Nearby Places</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {pois.slice(0, 3).map((poi) => (
                <TouchableOpacity
                  key={poi.id}
                  style={styles.poiCard}
                  onPress={() => selectDestination(poi.location)}
                >
                  <Ionicons
                    name={getMarkerIcon(poi.type) as any}
                    size={20}
                    color={getMarkerColor(poi.type)}
                  />
                  <Text style={styles.poiCardName}>{poi.name}</Text>
                  <Text style={styles.poiCardRating}>⭐ {poi.rating.toFixed(1)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Challenges List */}
          <View style={styles.challengesList}>
            <Text style={styles.challengesListTitle}>🎯 Active Challenges</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {challenges.slice(0, 3).map((challenge, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.challengeCard}
                >
                  <Text style={styles.challengeCardTitle}>{challenge.title}</Text>
                  <Text style={styles.challengeCardPoints}>+{challenge.points} pts</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </SimpleMapView>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setDestinationModalVisible(true)}
        >
          <Ionicons name="search" size={24} color="white" />
          <Text style={styles.controlButtonText}>Find Destination</Text>
        </TouchableOpacity>
        
        {selectedRoute && (
          <TouchableOpacity
            style={[styles.controlButton, styles.routeInfoButton]}
            onPress={() => setRouteOptionsVisible(true)}
          >
            <Ionicons name="information-circle" size={24} color="white" />
            <Text style={styles.controlButtonText}>Route Info</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Route Information Bar */}
      {selectedRoute && (
        <View style={styles.routeInfoBar}>
          <View style={styles.routeInfoContent}>
            <Text style={styles.routeInfoTitle}>{selectedRoute.type.toUpperCase()} ROUTE</Text>
            <Text style={styles.routeInfoStats}>
              {selectedRoute.distance} km • {selectedRoute.duration} min • {selectedRoute.challenges.length} challenges
            </Text>
          </View>
          <TouchableOpacity
            style={styles.startRouteButton}
            onPress={() => Alert.alert('Start Route', 'Route navigation started!')}
          >
            <Text style={styles.startRouteButtonText}>START</Text>
          </TouchableOpacity>
        </View>
      )}

      {renderRouteOptions()}
      {renderDestinationModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  map: {
    flex: 1,
  },
  customMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  challengeMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFD93D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  challengeMarkerText: {
    fontSize: 12,
  },
  mapControls: {
    position: 'absolute',
    top: 50,
    right: 16,
    gap: 8,
  },
  controlButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  routeInfoButton: {
    backgroundColor: '#4ECDC4',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
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
  startRouteButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  startRouteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  routeOptionsModal: {
    backgroundColor: 'white',
    maxHeight: height * 0.7,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  destinationModal: {
    backgroundColor: 'white',
    height: height * 0.7,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  routesList: {
    flex: 1,
  },
  routeOption: {
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  routeStats: {
    flexDirection: 'row',
    gap: 12,
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
    marginBottom: 8,
  },
  challengesPreview: {
    backgroundColor: '#F8F9FA',
    padding: 8,
    borderRadius: 6,
  },
  challengesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  challengeItem: {
    fontSize: 11,
    color: '#666',
  },
  destinationsList: {
    flex: 1,
  },
  destinationOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  destinationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  destinationType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  challengeBadge: {
    backgroundColor: '#FFD93D',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  challengeBadgeText: {
    fontSize: 12,
  },
  destinationDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  destinationRating: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
});