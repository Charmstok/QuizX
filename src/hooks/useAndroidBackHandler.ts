import { useEffect, type DependencyList } from 'react';
import { BackHandler, Platform } from 'react-native';

export function useAndroidBackHandler(
  onBackPress: () => boolean,
  dependencies: DependencyList,
) {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      subscription.remove();
    };
  }, dependencies);
}
