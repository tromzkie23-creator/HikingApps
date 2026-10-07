import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { C } from '../../lib/theme';

export default function Friends() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 28, paddingTop: 70 }}>
      <Text style={{ color: C.mute, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>YOUR HIKING CIRCLE</Text>
      <Text style={{ color: C.spruce, fontSize: 30, fontWeight: '900', marginTop: 5 }}>Friends</Text>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 70 }}>
        <View style={{ width: 94, height: 94, borderRadius: 47, backgroundColor: '#E3EBDD', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="people-outline" size={43} color={C.spruce} />
        </View>
        <Text style={{ color: C.ink, fontSize: 20, fontWeight: '800', marginTop: 22 }}>Good hikes are better shared</Text>
        <Text style={{ color: C.mute, textAlign: 'center', lineHeight: 22, marginTop: 9 }}>
          Friends and shared trail plans are coming soon. For now, keep exploring at your own pace.
        </Text>
      </View>
    </View>
  );
}
