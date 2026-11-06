import { TextStyle } from 'react-native';
import { colors } from './colors';

// Sizes are about 15% larger than before (28/22/18/15/15/13/16).
export const typography: Record<string, TextStyle> = {
  heading1: { fontSize: 32, fontWeight: '700', color: colors.text },
  heading2: { fontSize: 22, fontWeight: '700', color: colors.text },
  heading3: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 17, fontWeight: '400', color: colors.text },
  bodyBold: { fontSize: 17, fontWeight: '600', color: colors.text },
  caption: { fontSize: 15, fontWeight: '400', color: colors.textMuted },
  button: { fontSize: 18, fontWeight: '600', color: colors.text },
};