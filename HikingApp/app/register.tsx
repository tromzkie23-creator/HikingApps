import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { ApiError, register } from '../lib/api';
import { Btn, Field } from '../lib/ui';
import { C } from '../lib/theme';

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmation: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (loading) return;
    if (!form.name.trim() || !form.email.includes('@')) {
      setError('Enter your name and a valid email.');
      return;
    }
    if (form.password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }
    if (form.password !== form.confirmation) {
      setError('Passwords do not match. Re-enter the same password in both fields.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      router.replace('/(tabs)' as Href);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: 70 }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: C.spruce, marginBottom: 24 }}>
        Create your account
      </Text>
      <Field label="Full name" value={form.name} onChangeText={update('name')} autoCapitalize="words" />
      <Field
        label="Email"
        value={form.email}
        onChangeText={update('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <Field label="Password" value={form.password} onChangeText={update('password')} secureTextEntry />
      <Field label="Confirm password" value={form.confirmation} onChangeText={update('confirmation')} secureTextEntry />
      {!!error && <Text accessibilityRole="alert" style={{ color: C.ember, marginBottom: 12 }}>{error}</Text>}
      <View style={{ gap: 12, marginTop: 8 }}>
        <Btn t={loading ? 'Creating account…' : 'Sign up'} onPress={() => void submit()} />
        {loading && <ActivityIndicator color={C.spruce} />}
        <Btn alt t="Back to log in" onPress={() => router.back()} />
        <Btn
          alt
          t="Continue as guest"
          onPress={() => router.replace('/(tabs)' as Href)}
        />
      </View>
    </ScrollView>
  );
}
