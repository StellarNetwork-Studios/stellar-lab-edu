import AsyncStorage from '@react-native-async-storage/async-storage';

export async function saveCache(key: string, data: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.log('Cache save error', error);
  }
}

export async function getCache(key: string) {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.log('Cache read error', error);
    return null;
  }
}