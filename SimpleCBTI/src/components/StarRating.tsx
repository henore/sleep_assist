import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, FontSize } from '../constants/theme';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readonly?: boolean;
}

export function StarRating({ value, onChange, size = 28, readonly = false }: StarRatingProps) {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <TouchableOpacity
          key={i}
          onPress={() => !readonly && onChange?.(i)}
          disabled={readonly}
          activeOpacity={readonly ? 1 : 0.6}
        >
          <Text style={[styles.star, { fontSize: size }, i <= value && styles.starFilled]}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
  star: {
    color: Colors.starEmpty,
  },
  starFilled: {
    color: Colors.star,
  },
});
