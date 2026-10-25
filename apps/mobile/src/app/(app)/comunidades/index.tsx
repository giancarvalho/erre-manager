import { Button, Card, Screen, ScreenHeader, space, Text } from '@erre/ui';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ROLE_LABEL, useCommunity } from '@/lib/community';

export default function ChooseCommunity() {
  const { communities, current, select } = useCommunity();
  return (
    <Screen>
      <Button label="← Início" variant="ghost" onPress={() => router.back()} />
      <ScreenHeader overline="Comunidades" title="Trocar de comunidade" description="Escolha qual comunidade abrir." />
      <View accessibilityRole="radiogroup" style={styles.list}>
        {communities.map((c) => (
          <Card
            key={c.id}
            selected={c.id === current?.id}
            accessibilityLabel={`${c.name}, seu papel: ${ROLE_LABEL[c.role]}`}
            onPress={() => {
              select(c.id);
              router.back();
            }}
          >
            <Text variant="label">{c.name}</Text>
            <Text variant="caption" tone="muted">{`Seu papel: ${ROLE_LABEL[c.role]}`}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: space[3] } });
