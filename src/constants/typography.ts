import { TextStyle } from 'react-native';
import { colors } from './colors';

export const typography: Record<string, TextStyle> = {
  heading1: { fontSize: 28, fontWeight: '700', color: colors.text },
  heading2: { fontSize: 22, fontWeight: '700', color: colors.text },
  heading3: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, fontWeight: '400', color: colors.text },
  bodyBold: { fontSize: 15, fontWeight: '600', color: colors.text },
  caption: { fontSize: 13, fontWeight: '400', color: colors.textMuted },
  button: { fontSize: 16, fontWeight: '600', color: colors.text },
};