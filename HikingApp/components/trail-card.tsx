import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { C, type Trail } from '../lib/theme';
import { formatDuration, getTrailEstimatedMinutes, getTrailPresentation } from '../lib/trail-presentation';

type TrailCardProps = {
  trail: Trail;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  compact?: boolean;
};

export function TrailCard({ trail, favorite, onPress, onToggleFavorite, compact = false }: TrailCardProps) {
  const presentation = getTrailPresentation(trail);
  const ratingLabel =
    typeof trail.ratingAverage === 'number' && trail.ratingCount
      ? trail.ratingAverage.toFixed(1)
      : 'New';
  const ratingCount = trail.ratingCount ?? 0;
  const hard = trail.level.toLowerCase() === 'hard';
  const moderate = trail.level.toLowerCase() === 'moderate';
  const badgeColor = hard ? C.ember : moderate ? '#B77828' : C.moss;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trail.name}, ${trail.km} kilometers, ${trail.level}, ${ratingCount ? `${ratingLabel} stars from ${ratingCount} reviews` : 'no reviews yet'}`}
      onPress={onPress}
      style={{
        backgroundColor: C.white,
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: C.line,
      }}>
      <View
        style={{
          height: compact ? 112 : 150,
          backgroundColor: trail.level === 'Hard' ? '#D8CFC0' : '#DCE7D4',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Ionicons
          name={trail.level === 'Hard' ? 'trail-sign-outline' : 'leaf-outline'}
          size={compact ? 42 : 54}
          color={C.spruce}
        />
        <View
          style={{
            position: 'absolute',
            left: 14,
            top: 14,
            backgroundColor: C.white,
            borderRadius: 20,
            paddingHorizontal: 11,
            paddingVertical: 6,
          }}>
          <Text style={{ color: badgeColor, fontSize: 11, fontWeight: '800' }}>{trail.level.toUpperCase()}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={favorite ? `Remove ${trail.name} from saved trails` : `Save ${trail.name}`}
          accessibilityState={{ selected: favorite }}
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onToggleFavorite();
          }}
          style={{
            position: 'absolute',
            right: 14,
            top: 12,
            width: 38,
            height: 38,
            borderRadius: 20,
            backgroundColor: C.white,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={favorite ? C.ember : C.spruce} />
        </Pressable>
      </View>
      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: C.ink, fontSize: 18, fontWeight: '800' }}>
            {trail.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star" size={15} color="#D99D35" />
            <Text style={{ color: C.ink, fontWeight: '700' }}>{ratingLabel}</Text>
          </View>
        </View>
        <Text style={{ color: C.mute, fontSize: 11, marginTop: 2 }}>
          {ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}
        </Text>
        <Text numberOfLines={1} style={{ color: C.mute, marginTop: 4 }}>{presentation.park}</Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 12 }}>
          <Text style={{ color: C.ink, fontWeight: '700' }}>{trail.km} km</Text>
          <Text style={{ color: C.mute }}>{formatDuration(getTrailEstimatedMinutes(trail))}</Text>
          <Text style={{ color: C.mute }}>+{trail.gain} m</Text>
        </View>
      </View>
    </Pressable>
  );
}
