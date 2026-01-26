import React from 'react';
import { Text, View, ViewStyle } from 'react-native';

interface UTPSymbolProps {
  size?: number;
  color?: string;
  containerStyle?: ViewStyle;
  showBackground?: boolean;
}

export const UTPSymbol: React.FC<UTPSymbolProps> = ({ 
  size = 24, 
  color = "white",
  containerStyle,
  showBackground = false
}) => {
  const finalColor = showBackground ? "white" : color;

  return (
    <View style={[
      { 
        width: size, 
        height: size, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: showBackground ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
        borderRadius: size / 2,
      }, 
      containerStyle
    ]}>
      <Text style={{ 
        color: finalColor, 
        fontSize: size * 0.85, 
        fontWeight: '900',
        includeFontPadding: false,
        textAlignVertical: 'center'
      }}>$</Text>
    </View>
  );
};