import React, { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function AssistantScreen() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const API_BASE = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
  const router = useRouter();

  const send = async () => {
    if (!input.trim()) return;
    const savedUser = await AsyncStorage.getItem('travelUser');
    const user = savedUser ? JSON.parse(savedUser) : null;
    const user_context = user ? `Points: ${user.total_points}, Routes: ${user.routes_completed}` : '';

    const newMsgs = [...messages, { role: 'user', text: input }];
    setMessages(newMsgs);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/api/chat?message=${encodeURIComponent(input)}&user_context=${encodeURIComponent(user_context)}`, { method: 'POST' });
      const data = await resp.json();
      const reply = data.response || 'I\'m here to help with your travels!';
      setMessages([...newMsgs, { role: 'assistant', text: reply }]);
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', text: 'Sorry, I had trouble responding. Try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>AI Assistant</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.chat}>
          {messages.map((m, idx) => (
            <View key={idx} style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={m.role === 'user' ? styles.userText : styles.assistantText}>{m.text}</Text>
            </View>
          ))}
          {loading && (
            <View style={styles.loadingRow}><ActivityIndicator size="small" color="#007AFF" /></View>
          )}
        </ScrollView>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask for routes, ideas, tips..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send}>
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333', flex: 1, textAlign: 'center' },
  chat: { padding: 16 },
  bubble: { padding: 12, borderRadius: 12, marginBottom: 8, maxWidth: '80%' },
  userBubble: { backgroundColor: '#007AFF22', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: 'white', alignSelf: 'flex-start' },
  userText: { color: '#0A63C9' },
  assistantText: { color: '#333' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#EEE' },
  input: { flex: 1, borderWidth: 1, borderColor: '#DDD', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, backgroundColor: '#FAFAFA' },
  sendBtn: { backgroundColor: '#007AFF', padding: 10, borderRadius: 20 },
  loadingRow: { alignItems: 'center', marginVertical: 8 },
});