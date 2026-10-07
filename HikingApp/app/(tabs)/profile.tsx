import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';

import { ApiError, clearToken, getSavedUser, getToken, getTrailStats, type SessionUser, type TrailStats } from '../../lib/api';
import { C } from '../../lib/theme';

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StatTile({ icon, label, value, unit }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; value: string; unit: string }) {
  return (
    <View style={{ flex: 1, minWidth: '46%', backgroundColor: C.white, borderRadius: 17, padding: 15, borderWidth: 1, borderColor: C.line }}>
      <Ionicons name={icon} size={19} color={C.moss} />
      <Text style={{ color: C.ink, fontSize: 23, fontWeight: '900', marginTop: 12 }}>{value}</Text>
      <Text style={{ color: C.mute, fontSize: 11, marginTop: 2 }}>{unit} {label}</Text>
    </View>
  );
}

function formatMovingTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [stats, setStats] = useState<TrailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [savedUser, token, loadedStats] = await Promise.all([getSavedUser(), getToken(), getTrailStats()]);
      setUser(token ? savedUser : null);
      setStats(loadedStats);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load your hiking stats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadStats();
  }, [loadStats]));

  async function logout() {
    await clearToken();
    router.replace('/');
  }

  const monthlyValues = useMemo(() => stats?.monthlyDistance ?? [], [stats]);
  const maxMonthKm = Math.max(1, ...monthlyValues.map((month) => month.distanceKm));
  const peakMonthIndex = monthlyValues.reduce(
    (best, month, index, all) => month.distanceKm > (all[best]?.distanceKm ?? 0) ? index : best,
    -1
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 58, paddingBottom: 35 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>YOUR TRAIL STORY</Text>
          <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Profile</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={user ? 'Log out' : 'Return to welcome'} onPress={() => void logout()} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={user ? 'log-out-outline' : 'person-outline'} size={21} color={C.spruce} />
        </Pressable>
      </View>
      <Text style={{ color: C.mute, marginTop: 5, marginBottom: 19 }}>{user?.name ?? 'Hiking as a guest'}</Text>

      {loading ? (
        <View style={{ padding: 35, alignItems: 'center', gap: 12 }}>
          <ActivityIndicator color={C.spruce} />
          <Text style={{ color: C.mute }}>Gathering your trail stats…</Text>
        </View>
      ) : error || !stats ? (
        <View style={{ backgroundColor: C.white, borderRadius: 16, padding: 18, gap: 12 }}>
          <Text accessibilityRole="alert" style={{ color: C.ember }}>{error || 'Stats are unavailable.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => void loadStats()}>
            <Text style={{ color: C.spruce, fontWeight: '800' }}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <StatTile icon="footsteps-outline" label="hikes" value={`${stats.lifetime.hikes}`} unit="" />
            <StatTile icon="navigate-outline" label="distance" value={stats.lifetime.distanceKm.toFixed(1)} unit="km" />
            <StatTile icon="time-outline" label="moving time" value={formatMovingTime(stats.lifetime.movingTimeSecs)} unit="" />
            <StatTile icon="flame-outline" label="calories · est." value={`${stats.lifetime.caloriesEstimate}`} unit="kcal" />
          </View>

          <View style={{ backgroundColor: C.white, borderRadius: 19, borderWidth: 1, borderColor: C.line, padding: 17, marginTop: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: C.ink, fontSize: 17, fontWeight: '800' }}>This year</Text>
              <Text style={{ color: C.mute, fontSize: 12 }}>{stats.year} · km</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 145, marginTop: 20, gap: 5 }}>
              {monthlyValues.map((month, index) => {
                const peak = month.distanceKm > 0 && index === peakMonthIndex;
                return (
                  <View key={month.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 7 }}>
                    <View style={{ width: '72%', height: Math.max(5, month.distanceKm ? (month.distanceKm / maxMonthKm) * 105 : 5), borderRadius: 6, backgroundColor: peak ? C.ember : month.distanceKm ? C.moss : '#E8ECE4' }} />
                    <Text style={{ color: peak ? C.ember : C.mute, fontSize: 9, fontWeight: peak ? '800' : '500' }}>{monthLabels[month.month - 1]}</Text>
                  </View>
                );
              })}
            </View>
            {peakMonthIndex >= 0 && (
              <Text style={{ color: C.mute, fontSize: 12, marginTop: 10 }}>
                Peak month: <Text style={{ color: C.spruce, fontWeight: '800' }}>{monthLabels[monthlyValues[peakMonthIndex].month - 1]}</Text> · {monthlyValues[peakMonthIndex].distanceKm.toFixed(1)} km
              </Text>
            )}
          </View>

          <Text style={{ color: C.ink, fontSize: 18, fontWeight: '800', marginTop: 23, marginBottom: 12 }}>Personal bests</Text>
          {[
            { icon: 'trail-sign-outline' as const, label: 'Longest hike', value: stats.personalBests.longestHike ? `${stats.personalBests.longestHike.distanceKm.toFixed(1)} km` : '—', detail: stats.personalBests.longestHike?.trail ?? 'Complete a hike to set a best' },
            { icon: 'trending-up-outline' as const, label: 'Most climb · est.', value: stats.personalBests.mostClimb ? `${stats.personalBests.mostClimb.estimatedGainM} m` : '—', detail: stats.personalBests.mostClimb?.trail ?? 'Trail elevation when available' },
            { icon: 'time-outline' as const, label: 'Longest time', value: stats.personalBests.longestTime ? formatMovingTime(stats.personalBests.longestTime.durationSecs) : '—', detail: stats.personalBests.longestTime?.trail ?? 'Complete a hike to set a best' },
            { icon: 'flame-outline' as const, label: 'Calories · est.', value: stats.personalBests.calories ? `${stats.personalBests.calories.caloriesEstimate} kcal` : '—', detail: stats.personalBests.calories?.trail ?? 'Estimated at 55 kcal per km' },
          ].map((best) => (
            <View key={best.label} style={{ backgroundColor: C.white, borderRadius: 15, borderWidth: 1, borderColor: C.line, padding: 15, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 13 }}>
              <Ionicons name={best.icon} size={20} color={C.moss} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.mute, fontSize: 11 }}>{best.label}</Text>
                <Text style={{ color: C.ink, fontWeight: '700', marginTop: 3 }}>{best.detail}</Text>
              </View>
              <Text style={{ color: C.spruce, fontSize: 16, fontWeight: '900' }}>{best.value}</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}
