import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';

const colors = {
  background: '#F7F6F0',
  ink: '#1E3027',
  muted: '#79847C',
  green: '#315B45',
  paleGreen: '#E6EDE5',
  orange: '#E68B53',
  white: '#FFFFFF',
};

const featuredTrail = {
  name: 'Emerald Lake Trail',
  location: 'Rocky Mountain National Park',
  image:
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=85',
  distance: '3.2 mi',
  duration: '2 hr 10 min',
  difficulty: 'Moderate',
};

const nearbyTrails = [
  {
    name: 'Bear Lake Loop',
    location: 'Estes Park, Colorado',
    image:
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=600&q=80',
    distance: '0.8 mi',
    difficulty: 'Easy',
    rating: '4.9',
  },
  {
    name: 'Sky Pond',
    location: 'Rocky Mountain National Park',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
    distance: '9.4 mi',
    difficulty: 'Hard',
    rating: '4.8',
  },
];

export default function HomeScreen() {
  const [saved, setSaved] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View>
            <View style={styles.locationRow}>
              <SymbolView
                name={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }}
                size={14}
                tintColor={colors.green}
              />
              <TextLabel style={styles.locationText}>CURRENT LOCATION</TextLabel>
            </View>
            <TextLabel style={styles.locationName}>Estes Park, CO</TextLabel>
          </View>
          <View style={styles.avatarButton}>
            <TextLabel style={styles.avatarText}>J</TextLabel>
          </View>
        </View>

        <View style={styles.headingBlock}>
          <TextLabel style={styles.eyebrow}>FIND YOUR OUTSIDE</TextLabel>
          <TextLabel style={styles.heading}>
            The trail is{'\n'}calling<Text style={styles.headingPeriod}>.</Text>
          </TextLabel>
          <TextLabel style={styles.subheading}>Fresh air, good views, better days.</TextLabel>
        </View>

        <Link href="/explore" asChild>
          <Pressable accessibilityRole="button" style={styles.searchBar}>
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={19}
              tintColor={colors.muted}
            />
            <TextLabel style={styles.searchPlaceholder}>Find a trail, park, or place</TextLabel>
            <View style={styles.filterButton}>
              <SymbolView
                name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                size={17}
                tintColor={colors.white}
              />
            </View>
          </Pressable>
        </Link>

        <View style={styles.sectionHeading}>
          <View>
            <TextLabel style={styles.sectionTitle}>Trail of the day</TextLabel>
            <TextLabel style={styles.sectionCaption}>A little inspiration for your next day out</TextLabel>
          </View>
          <TextLabel style={styles.sunIcon}>✳</TextLabel>
        </View>

        <View style={styles.featureCard}>
          <Image source={{ uri: featuredTrail.image }} style={styles.featureImage} contentFit="cover" />
          <View style={styles.imageShade} />
          <View style={styles.featureTopRow}>
            <View style={styles.featureBadge}>
              <TextLabel style={styles.featureBadgeText}>✦  EDITOR&apos;S PICK</TextLabel>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Remove trail from saved' : 'Save trail'}
              onPress={() => setSaved((value) => !value)}
              style={styles.saveButton}>
              <SymbolView
                name={{
                  ios: saved ? 'heart.fill' : 'heart',
                  android: saved ? 'favorite' : 'favorite_border',
                  web: saved ? 'favorite' : 'favorite_border',
                }}
                size={19}
                tintColor={saved ? colors.orange : colors.ink}
              />
            </Pressable>
          </View>
          <View style={styles.featureDetails}>
            <TextLabel style={styles.featureLocation}>{featuredTrail.location}</TextLabel>
            <TextLabel style={styles.featureTitle}>{featuredTrail.name}</TextLabel>
            <View style={styles.featureMeta}>
              <MetaItem icon="↔" value={featuredTrail.distance} />
              <MetaItem icon="◷" value={featuredTrail.duration} />
              <View style={styles.difficultyPill}>
                <TextLabel style={styles.difficultyText}>{featuredTrail.difficulty}</TextLabel>
              </View>
            </View>
          </View>
        </View>

        <View style={[styles.sectionHeading, styles.nearbyHeading]}>
          <View>
            <TextLabel style={styles.sectionTitle}>Worth the steps</TextLabel>
            <TextLabel style={styles.sectionCaption}>Loved by hikers near you</TextLabel>
          </View>
          <Link href="/explore" style={styles.seeAll}>
            See all
          </Link>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyList}>
          {nearbyTrails.map((trail) => (
            <View key={trail.name} style={styles.nearbyCard}>
              <Image source={{ uri: trail.image }} style={styles.nearbyImage} contentFit="cover" />
              <View style={styles.nearbyInfo}>
                <View style={styles.ratingRow}>
                  <TextLabel style={styles.ratingStar}>★</TextLabel>
                  <TextLabel style={styles.rating}>{trail.rating}</TextLabel>
                  <TextLabel style={styles.nearbyDistance}>{trail.distance}</TextLabel>
                </View>
                <TextLabel style={styles.nearbyName} numberOfLines={1}>
                  {trail.name}
                </TextLabel>
                <TextLabel style={styles.nearbyLocation} numberOfLines={1}>
                  {trail.location}
                </TextLabel>
              </View>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </SafeAreaView>
  );
}

function TextLabel({
  children,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={style}>
      {children}
    </Text>
  );
}

function MetaItem({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <TextLabel style={styles.metaIcon}>{icon}</TextLabel>
      <TextLabel style={styles.metaValue}>{value}</TextLabel>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 30,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  locationName: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  avatarButton: {
    height: 42,
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#DFE7DC',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarText: {
    color: colors.green,
    fontWeight: '800',
    fontSize: 16,
  },
  headingBlock: {
    marginTop: 30,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '800',
  },
  heading: {
    marginTop: 7,
    color: colors.ink,
    fontSize: 43,
    lineHeight: 46,
    letterSpacing: -1.7,
    fontWeight: '800',
  },
  headingPeriod: {
    color: colors.orange,
  },
  subheading: {
    marginTop: 7,
    color: colors.muted,
    fontSize: 14,
  },
  searchBar: {
    minHeight: 54,
    marginTop: 22,
    paddingLeft: 15,
    paddingRight: 7,
    borderRadius: 17,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    shadowColor: '#293B30',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  searchPlaceholder: {
    flex: 1,
    color: '#9AA39B',
    fontSize: 13,
  },
  filterButton: {
    height: 40,
    width: 42,
    borderRadius: 13,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    marginTop: 27,
    marginBottom: 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionCaption: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
  },
  sunIcon: {
    color: colors.orange,
    fontSize: 23,
  },
  featureCard: {
    height: 270,
    overflow: 'hidden',
    borderRadius: 23,
    backgroundColor: '#718B78',
  },
  featureImage: {
    ...StyleSheet.absoluteFill,
  },
  imageShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 34, 24, 0.25)',
  },
  featureTopRow: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featureBadge: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  featureBadgeText: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  saveButton: {
    width: 37,
    height: 37,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  featureDetails: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 17,
    paddingBottom: 17,
    paddingTop: 42,
    backgroundColor: 'rgba(21, 39, 29, 0.48)',
  },
  featureLocation: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  featureTitle: {
    marginTop: 3,
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  featureMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginTop: 11,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  metaValue: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  difficultyPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  difficultyText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
  },
  nearbyHeading: {
    marginTop: 26,
    marginBottom: 12,
  },
  seeAll: {
    color: colors.green,
    fontSize: 12,
    fontWeight: '700',
  },
  nearbyList: {
    gap: 12,
    paddingRight: 2,
  },
  nearbyCard: {
    width: 220,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  nearbyImage: {
    width: '100%',
    height: 108,
    backgroundColor: colors.paleGreen,
  },
  nearbyInfo: {
    padding: 12,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStar: {
    color: colors.orange,
    fontSize: 11,
  },
  rating: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  nearbyDistance: {
    marginLeft: 'auto',
    color: colors.muted,
    fontSize: 10,
  },
  nearbyName: {
    marginTop: 5,
    color: colors.ink,
    fontWeight: '800',
    fontSize: 14,
  },
  nearbyLocation: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
  },
});
