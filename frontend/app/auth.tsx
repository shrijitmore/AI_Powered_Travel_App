import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isLogin && !name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
      }
      router.replace('/');
    } catch (error: any) {
      console.error('Auth error:', error);
      Alert.alert(
        'Authentication Error',
        error.message || 'An error occurred during authentication'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = () => {
    setEmail('admin@travelquest.com');
    setPassword('admin123');
    setIsLogin(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="map" size={60} color="#007AFF" />
            <Text style={styles.title}>Travel Quest</Text>
            <Text style={styles.subtitle}>Your Adventure Awaits</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>
              {isLogin ? 'Welcome Back!' : 'Join the Adventure'}
            </Text>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#666" />
                <TextInput
                  style={styles.input}
                  placeholder="Your Name"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchButtonText}>
                {isLogin
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </Text>
            </TouchableOpacity>

            {/* Admin Login Shortcut */}
            <TouchableOpacity
              style={styles.adminButton}
              onPress={handleAdminLogin}
            >
              <Ionicons name="shield-outline" size={16} color="#FF6B6B" />
              <Text style={styles.adminButtonText}>Admin Login</Text>
            </TouchableOpacity>
          </View>

          {/* Features */}
          <View style={styles.features}>
            <View style={styles.feature}>
              <Ionicons name="map-outline" size={24} color="#4ECDC4" />
              <Text style={styles.featureText}>Interactive Maps</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="trophy-outline" size={24} color="#FFD93D" />
              <Text style={styles.featureText}>Earn Rewards</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="people-outline" size={24} color="#FF6B6B" />
              <Text style={styles.featureText}>Challenge Friends</Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  form: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 30,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: '#F8F9FA',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    gap: 6,
  },
  adminButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '500',
  },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  feature: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});