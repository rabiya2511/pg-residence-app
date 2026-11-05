import React, { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import Svg, { Rect, Line, Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { colors } from '../../constants/colors';
import { spacing, radius } from '../../constants/spacing';
import { typography } from '../../constants/typography';
import { ChartSpec, CHART_COLORS, fmtCompact, fmtFull, shortLabel } from '../../utils/chartSpec';

const H = 180;
const PAD_T = 22;
const PAD_B = 26;
const PAD_X = 8;

const colorOf = (spec: ChartSpec, i: number) => spec.data[i]?.color ?? CHART_COLORS[i % CHART_COLORS.length];

function BarChart({ spec, w }: { spec: ChartSpec; w: number }) {
  const n = spec.data.length;
  const max = Math.max(1, ...spec.data.map((d) => d.value));
  const plotH = H - PAD_T - PAD_B;
  const slot = (w - PAD_X * 2) / Math.max(1, n);
  const barW = Math.min(38, slot * 0.6);
  return (
    <Svg width={w} height={H}>
      <Line x1={PAD_X} x2={w - PAD_X} y1={H - PAD_B} y2={H - PAD_B} stroke={colors.border} strokeWidth={1} />
      {spec.data.map((d, i) => {
        const h = d.value > 0 ? Math.max(3, (d.value / max) * plotH) : 0;
        const x = PAD_X + slot * i + (slot - barW) / 2;
        const y = H - PAD_B - h;
        return (
          <G key={`${d.label}-${i}`}>
            <Rect x={x} y={y} width={barW} height={h} rx={4} fill={d.color ?? CHART_COLORS[0]} />
            <SvgText x={x + barW / 2} y={y - 5} fontSize={10} fill={colors.textMuted} textAnchor="middle">
              {fmtCompact(d.value, spec.money, spec.percent)}
            </SvgText>
            <SvgText x={x + barW / 2} y={H - 9} fontSize={10} fill={colors.textMuted} textAnchor="middle">
              {shortLabel(d.label, slot < 44 ? 5 : 9)}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function LineChart({ spec, w }: { spec: ChartSpec; w: number }) {
  const n = spec.data.length;
  const top = spec.percent ? 100 : Math.max(1, ...spec.data.map((d) => d.value)) * 1.15;
  const plotH = H - PAD_T - PAD_B;
  const slot = (w - PAD_X * 2) / Math.max(1, n);
  const pts = spec.data.map((d, i) => ({
    x: PAD_X + slot * i + slot / 2,
    y: PAD_T + plotH * (1 - Math.min(top, d.value) / top),
    d,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return (
    <Svg width={w} height={H}>
      {[0, 0.5, 1].map((f) => (
        <Line
          key={f}
          x1={PAD_X}
          x2={w - PAD_X}
          y1={PAD_T + plotH * f}
          y2={PAD_T + plotH * f}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray={f === 1 ? undefined : '4,4'}
        />
      ))}
      {pts.length > 1 && <Path d={path} stroke={CHART_COLORS[0]} strokeWidth={2.5} fill="none" />}
      {pts.map((p, i) => (
        <G key={`${p.d.label}-${i}`}>
          <Circle cx={p.x} cy={p.y} r={4} fill={CHART_COLORS[0]} />
          <SvgText x={p.x} y={p.y - 9} fontSize={10} fill={colors.textMuted} textAnchor="middle">
            {fmtCompact(p.d.value, spec.money, spec.percent)}
          </SvgText>
          <SvgText x={p.x} y={H - 9} fontSize={10} fill={colors.textMuted} textAnchor="middle">
            {shortLabel(p.d.label, slot < 44 ? 5 : 9)}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

function DonutChart({ spec, w }: { spec: ChartSpec; w: number }) {
  const total = spec.data.reduce((s, d) => s + Math.max(0, d.value), 0);
  const size = 140;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', width: w }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {total > 0 &&
            spec.data.map((d, i) => {
              const len = (Math.max(0, d.value) / total) * c;
              const seg = (
                <Circle
                  key={`${d.label}-${i}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={colorOf(spec, i)}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return seg;
            })}
        </G>
        <SvgText x={size / 2} y={size / 2 + 5} fontSize={16} fontWeight="bold" fill={colors.text} textAnchor="middle">
          {fmtCompact(total, spec.money)}
        </SvgText>
      </Svg>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        {spec.data.map((d, i) => (
          <View key={`${d.label}-${i}`} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: colorOf(spec, i) }]} />
            <Text style={[typography.caption, { color: colors.text, flex: 1 }]} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]}>
              {fmtFull(d.value, spec.money)}
              {total > 0 ? ` · ${Math.round((d.value / total) * 100)}%` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ChartCard({ spec, onPress }: { spec: ChartSpec; onPress?: () => void }) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(Math.floor(e.nativeEvent.layout.width));
  const empty = spec.data.length === 0 || spec.data.every((d) => !d.value);

  const body = (
    <View style={styles.card}>
      <Text style={[typography.bodyBold, { color: colors.text }]}>{spec.title}</Text>
      {!!spec.subtitle && <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>{spec.subtitle}</Text>}
      <View onLayout={onLayout} style={{ marginTop: spacing.sm }}>
        {empty ? (
          <Text style={[typography.caption, { color: colors.textMuted, paddingVertical: spacing.lg, textAlign: 'center' }]}>
            Nothing to chart yet.
          </Text>
        ) : w > 0 ? (
          spec.kind === 'bar' ? (
            <BarChart spec={spec} w={w} />
          ) : spec.kind === 'line' ? (
            <LineChart spec={spec} w={w} />
          ) : (
            <DonutChart spec={spec} w={w} />
          )
        ) : null}
      </View>
    </View>
  );
  return onPress ? (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress}>
      {body}
    </TouchableOpacity>
  ) : (
    body
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
});
