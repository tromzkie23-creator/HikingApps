import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { ApiError, login } from '../lib/api';
import { Btn, Field } from '../lib/ui';
import { C } from '../lib/theme';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (loading) return;
    if (!email.includes('@') || password.length < 6) {
      setError('Enter a valid email and a password of at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)' as Href);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not log in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: 90 }}>
      <Text style={{ fontSize: 34, fontWeight: '800', color: C.spruce }}>Trailhead</Text>
      <Text style={{ color: C.mute, marginBottom: 36, marginTop: 6, fontSize: 16 }}>
        Find a trail, hike offline, log every step.
      </Text>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="you@email.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        placeholder="At least 6 characters"
      />
      {!!error && <Text accessibilityRole="alert" style={{ color: C.ember, marginBottom: 12 }}>{error}</Text>}
      <View style={{ gap: 12, marginTop: 8 }}>
        <Btn t={loading ? 'Logging in…' : 'Log in'} onPress={() => void submit()} />
        {loading && <ActivityIndicator color={C.spruce} />}
        <Btn alt t="Create an account" onPress={() => router.push('/register' as Href)} />
        <Btn
          alt
          t="Continue as guest"
          onPress={() => router.replace('/(tabs)' as Href)}
        />
      </View>
    </ScrollView>
  );
}
