import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
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

const trails = [
  {
    name: 'Emerald Lake Trail',
    location: 'Rocky Mountain National Park',
    image:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=700&q=80',
    distance: '3.2 mi',
    duration: '2 hr 10 min',
    difficulty: 'Moderate',
    rating: '4.9',
  },
  {
    name: 'Bear Lake Loop',
    location: 'Estes Park, Colorado',
    image:
      'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=700&q=80',
    distance: '0.8 mi',
    duration: '30 min',
    difficulty: 'Easy',
    rating: '4.9',
  },
  {
    name: 'Sky Pond',
    location: 'Rocky Mountain National Park',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80',
    distance: '9.4 mi',
    duration: '6 hr',
    difficulty: 'Hard',
    rating: '4.8',
  },
  {
    name: 'Dream Lake',
    location: 'Estes Park, Colorado',
    image:
      'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=700&q=80',
    distance: '2.2 mi',
    duration: '1 hr 30 min',
    difficulty: 'Easy',
    rating: '4.8',
  },
];

const categories = ['All trails', 'Easy', 'Moderate', 'Hard'] as const;
type Category = (typeof categories)[number];

export default function ExploreScreen() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('All trails');
  const [savedTrails, setSavedTrails] = useState<string[]>([]);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);

  const filteredTrails = trails.filter((trail) => {
    const matchesQuery = `${trail.name} ${trail.location}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesCategory = category === 'All trails' || trail.difficulty === category;
    return matchesQuery && matchesCategory;
  });
  const visibleTrails = [...filteredTrails].sort((first, second) =>
    sortAlphabetically
      ? first.name.localeCompare(second.name)
      : Number(second.rating) - Number(first.rating)
  );

  function toggleSaved(name: string) {
    setSavedTrails((current) =>
      current.includes(name) ? current.filter((trailName) => trailName !== name) : [...current, name]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.eyebrowRow}>
          <TextLabel style={styles.eyebrow}>GET OUT THERE</TextLabel>
          <View style={styles.locationPill}>
            <SymbolView
              name={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }}
              size={13}
              tintColor={colors.green}
            />
            <TextLabel style={styles.locationText}>Estes Park</TextLabel>
          </View>
        </View>
        <TextLabel style={styles.title}>Explore trails</TextLabel>
        <TextLabel style={styles.subtitle}>Find your next favorite place to wander.</TextLabel>

        <View style={styles.searchBar}>
          <SymbolView
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={18}
            tintColor={colors.muted}
          />
          <TextInput
            accessibilityLabel="Search trails and places"
            value={query}
            onChangeText={setQuery}
            placeholder="Search trails or parks"
            placeholderTextColor="#9AA39B"
            style={styles.searchInput}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}>
          {categories.map((item) => {
            const selected = category === item;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(item)}
                style={[styles.categoryButton, selected && styles.categoryButtonSelected]}>
                <TextLabel style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                  {item}
                </TextLabel>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.resultsHeader}>
          <View>
            <TextLabel style={styles.resultsTitle}>Near you</TextLabel>
            <TextLabel style={styles.resultsSubtitle}>
              {visibleTrails.length} {visibleTrails.length === 1 ? 'trail' : 'trails'} to discover
            </TextLabel>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={sortAlphabetically ? 'Sort trails by rating' : 'Sort trails alphabetically'}
            onPress={() => setSortAlphabetically((value) => !value)}
            style={styles.sortButton}>
            <SymbolView
              name={{ ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' }}
              size={15}
              tintColor={colors.green}
            />
            <TextLabel style={styles.sortText}>{sortAlphabetically ? 'A - Z' : 'Top rated'}</TextLabel>
          </Pressable>
        </View>

        {visibleTrails.length > 0 ? (
          <View style={styles.trailList}>
            {visibleTrails.map((trail) => {
              const isSaved = savedTrails.includes(trail.name);
              return (
                <View key={trail.name} style={styles.trailCard}>
                  <Image source={{ uri: trail.image }} style={styles.trailImage} contentFit="cover" />
                  <View style={styles.trailInfo}>
                    <View style={styles.trailTopLine}>
                      <View style={styles.difficultyPill}>
                        <TextLabel style={styles.difficultyText}>{trail.difficulty}</TextLabel>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isSaved ? `Remove ${trail.name} from saved` : `Save ${trail.name}`}
                        onPress={() => toggleSaved(trail.name)}
                        hitSlop={8}
                        style={styles.saveButton}>
                        <SymbolView
                          name={{
                            ios: isSaved ? 'heart.fill' : 'heart',
                            android: isSaved ? 'favorite' : 'favorite_border',
                            web: isSaved ? 'favorite' : 'favorite_border',
                          }}
                          size={17}
                          tintColor={isSaved ? colors.orange : colors.muted}
                        />
                      </Pressable>
                    </View>
                    <TextLabel style={styles.trailName} numberOfLines={1}>
                      {trail.name}
                    </TextLabel>
                    <TextLabel style={styles.trailLocation} numberOfLines={1}>
                      {trail.location}
                    </TextLabel>
                    <View style={styles.trailMeta}>
                      <MetaItem icon="★" value={trail.rating} highlight />
                      <MetaItem icon="↔" value={trail.distance} />
                      <MetaItem icon="◷" value={trail.duration} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <TextLabel style={styles.emptyIcon}>⌕</TextLabel>
            <TextLabel style={styles.emptyTitle}>No trails found</TextLabel>
            <TextLabel style={styles.emptyMessage}>Try another search or choose a different difficulty.</TextLabel>
          </View>
        )}
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

function MetaItem({ icon, value, highlight = false }: { icon: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.metaItem}>
      <TextLabel style={[styles.metaIcon, highlight && styles.ratingIcon]}>{icon}</TextLabel>
      <TextLabel style={styles.metaText}>{value}</TextLabel>
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
    paddingTop: 16,
    paddingBottom: 30,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: colors.paleGreen,
  },
  locationText: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    marginTop: 13,
    color: colors.ink,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -0.9,
  },
  subtitle: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
  },
  searchBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 21,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    shadowColor: '#293B30',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    color: colors.ink,
    fontSize: 13,
  },
  categoryList: {
    gap: 8,
    paddingTop: 17,
    paddingBottom: 3,
  },
  categoryButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  categoryButtonSelected: {
    backgroundColor: colors.green,
  },
  categoryText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  categoryTextSelected: {
    color: colors.white,
  },
  resultsHeader: {
    marginTop: 22,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  resultsSubtitle: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 11,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E6E8E1',
    borderRadius: 12,
    backgroundColor: colors.white,
  },
  sortText: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '700',
  },
  trailList: {
    gap: 12,
  },
  trailCard: {
    minHeight: 134,
    flexDirection: 'row',
    padding: 9,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  trailImage: {
    width: 112,
    minHeight: 116,
    borderRadius: 13,
    backgroundColor: colors.paleGreen,
  },
  trailInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingLeft: 12,
    paddingRight: 4,
  },
  trailTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  difficultyPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: colors.paleGreen,
  },
  difficultyText: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '700',
  },
  saveButton: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailName: {
    marginTop: 6,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  trailLocation: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 10,
  },
  trailMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 9,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  ratingIcon: {
    color: colors.orange,
  },
  metaText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  emptyState: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    borderRadius: 18,
    backgroundColor: colors.white,
  },
  emptyIcon: {
    color: colors.green,
    fontSize: 35,
  },
  emptyTitle: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  emptyMessage: {
    marginTop: 5,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
});
