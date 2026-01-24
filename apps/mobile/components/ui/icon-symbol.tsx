import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { OpaqueColorValue, StyleProp, ViewStyle } from 'react-native';

// Add your desired icons here
const MAPPING = {
  // See MaterialIcons here: https://icons.expo.fyi
  // The value is the name of the icon in MaterialIcons
  'wallet.pass.fill': 'account-balance-wallet',
  'clock.fill': 'history',
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'logout': 'logout',
  'refresh': 'refresh',
  'add': 'add',
  'remove': 'remove',
  'payments': 'payments',
  'account.circle': 'account-circle',
  'qr.code': 'qr-code-scanner',
  'bus': 'directions-bus',
  'coffee': 'local-cafe',
  'book': 'menu-book',
  'checkmark.circle.fill': 'check-circle',
  'exclamationmark.circle.fill': 'error',
  'info.circle.fill': 'info',
  'close': 'close',
  'assignment': 'assignment',
  'pencil': 'edit',
  'trash': 'delete',
  'checkmark.circle': 'check-circle',
  'exclamationmark.circle': 'error',
  'questionmark.circle': 'help',
  'info.circle': 'info',
} as const;

export type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SFSymbols on iOS, and MaterialIcons on Android and web. This ensures a consistent look across platforms, and optimal resource usage.
 *
 * Icon `name`s are based on SFSymbols and mapped to MaterialIcons on other platforms.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<ViewStyle>;
}) {
  return <MaterialIcons color={color} name={MAPPING[name]} size={size} style={style} />;
}
