import { MaterialIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { searchPlaces } from '../services/geocoding';
import type { Favorite } from '../state/AppContext';
import { colors } from '../theme';
import type { LatLng, SearchResult } from '../types';

interface Props {
  near: LatLng | null;
  favorites: Favorite[];
  onSelect: (r: { name: string; location: LatLng }) => void;
  value: string;
  onChangeText: (t: string) => void;
}

export function SearchBar({ near, favorites, onSelect, value, onChangeText }: Props) {
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focused || value.trim().length < 3) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    // Nominatim kuralları: saniyede en fazla 1 istek → 600 ms debounce
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      searchPlaces(value, near ?? undefined, ctrl.signal)
        .then(setResults)
        .catch((e) => !ctrl.signal.aborted && setError(e.message))
        .finally(() => !ctrl.signal.aborted && setLoading(false));
    }, 600);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value, focused]);

  const showFavorites = focused && value.trim().length < 3 && favorites.length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <MaterialIcons name="search" size={22} color={colors.muted} />
        <TextInput
          style={styles.input}
          placeholder="Nereye gidiyoruz?"
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          returnKeyType="search"
        />
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {value.length > 0 && !loading ? (
          <Pressable onPress={() => onChangeText('')} hitSlop={10}>
            <MaterialIcons name="close" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {focused && (results.length > 0 || showFavorites || error) ? (
        <View style={styles.dropdown}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {showFavorites ? (
            favorites.map((f) => (
              <Pressable key={f.id} style={styles.row} onPress={() => onSelect(f)}>
                <MaterialIcons name="star" size={20} color={colors.primary} />
                <Text style={styles.title} numberOfLines={1}>{f.name}</Text>
              </Pressable>
            ))
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={results}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => onSelect({ name: item.title, location: item.location })}>
                  <MaterialIcons name="place" size={20} color={colors.muted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 12 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bg,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 50,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  input: { flex: 1, fontSize: 16, color: colors.text },
  dropdown: {
    marginTop: 6,
    backgroundColor: colors.bg,
    borderRadius: 14,
    maxHeight: 320,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  title: { fontSize: 15, color: colors.text, fontWeight: '600', flexShrink: 1 },
  subtitle: { fontSize: 12, color: colors.muted },
  error: { padding: 12, color: colors.jam },
});
