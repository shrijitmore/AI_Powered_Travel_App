import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

interface Path {
  id: string;
  name: string;
  start_point: {
    latitude: number;
    longitude: number;
    name: string;
  };
  end_point: {
    latitude: number;
    longitude: number;
    name: string;
  };
  difficulty: string;
  ai_suggested: boolean;
}

interface Task {
  id: string;
  path_id: string;
  task_description: string;
  reward_points: number;
  status: string;
}

export default function PathsScreen() {
  const [paths, setPaths] = useState<Path[]>([]);
  const [selectedPath, setSelectedPath] = useState<Path | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

  useEffect(() => {
    loadPaths();
  }, []);

  const loadPaths = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/paths`);
      if (response.ok) {
        const pathsData = await response.json();
        setPaths(pathsData);
      } else {
        Alert.alert('Error', 'Failed to load paths');
      }
    } catch (error) {
      console.error('Error loading paths:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async (pathId: string) => {
    setLoadingTasks(true);
    try {
      const response = await fetch(`${API_BASE}/api/paths/${pathId}/tasks`);
      if (response.ok) {
        const tasksData = await response.json();
        setTasks(tasksData);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const selectPath = (path: Path) => {
    setSelectedPath(path);
    loadTasks(path.id);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'hard': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return '#4CAF50';
      case 'in progress': return '#FF9800';
      default: return '#666';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading Adventure Paths...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Adventure Paths</Text>
        <Text style={styles.subtitle}>Choose your journey</Text>
      </View>

      {!selectedPath ? (
        <ScrollView style={styles.content}>
          {paths.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={48} color="#666" />
              <Text style={styles.emptyText}>No paths available</Text>
              <Text style={styles.emptySubtext}>Check back later for new adventures!</Text>
            </View>
          ) : (
            paths.map((path) => (
              <TouchableOpacity
                key={path.id}
                style={styles.pathCard}
                onPress={() => selectPath(path)}
              >
                <View style={styles.pathHeader}>
                  <View style={styles.pathInfo}>
                    <Text style={styles.pathName}>{path.name}</Text>
                    <Text style={styles.pathRoute}>
                      {path.start_point.name} → {path.end_point.name}
                    </Text>
                  </View>
                  <View style={styles.pathMeta}>
                    <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(path.difficulty) }]}>
                      <Text style={styles.difficultyText}>{path.difficulty}</Text>
                    </View>
                    {path.ai_suggested && (
                      <View style={styles.aiBadge}>
                        <Ionicons name="sparkles" size={12} color="#FFD700" />
                        <Text style={styles.aiText}>AI</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.pathActions}>
                  <Ionicons name="chevron-forward" size={20} color="#007AFF" />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <View style={styles.content}>
          <View style={styles.pathDetails}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setSelectedPath(null)}
            >
              <Ionicons name="arrow-back" size={20} color="#007AFF" />
              <Text style={styles.backButtonText}>Back to Paths</Text>
            </TouchableOpacity>

            <Text style={styles.selectedPathName}>{selectedPath.name}</Text>
            <Text style={styles.selectedPathRoute}>
              {selectedPath.start_point.name} → {selectedPath.end_point.name}
            </Text>

            <View style={styles.tasksSection}>
              <Text style={styles.tasksTitle}>Path Tasks</Text>
              
              {loadingTasks ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : tasks.length === 0 ? (
                <Text style={styles.noTasksText}>No tasks available for this path</Text>
              ) : (
                <ScrollView>
                  {tasks.map((task) => (
                    <View key={task.id} style={styles.taskCard}>
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskDescription}>{task.task_description}</Text>
                        <Text style={styles.taskPoints}>+{task.reward_points} pts</Text>
                      </View>
                      <View style={styles.taskStatus}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                          <Text style={styles.statusText}>{task.status}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 20,
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  pathCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathHeader: {
    flex: 1,
  },
  pathInfo: {
    marginBottom: 8,
  },
  pathName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  pathRoute: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  pathMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  aiText: {
    color: '#856404',
    fontSize: 10,
    fontWeight: '600',
  },
  pathActions: {
    marginLeft: 12,
  },
  pathDetails: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
  },
  selectedPathName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  selectedPathRoute: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  tasksSection: {
    flex: 1,
  },
  tasksTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  noTasksText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  },
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskInfo: {
    flex: 1,
  },
  taskDescription: {
    fontSize: 16,
    color: '#333',
  },
  taskPoints: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
  },
  taskStatus: {
    marginLeft: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});