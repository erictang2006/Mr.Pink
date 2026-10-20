export const dropLayerIds = ["lead", "bass", "chords", "bonkChords", "drums"] as const;
export type DropLayer = typeof dropLayerIds[number];
export type DropRow = { enabled: boolean; muted: boolean; solo: boolean; volume: number };
export const defaultDropVolumes: Record<DropLayer, number> = { lead: .65, bass: .55, chords: .32, bonkChords: .32, drums: .65 };
export const newDropRows = (): Record<DropLayer, DropRow> => Object.fromEntries(dropLayerIds.map(id => [id, {
  enabled: true, muted: false, solo: false, volume: defaultDropVolumes[id],
}])) as Record<DropLayer, DropRow>;
export function audibleDropLayer(rows: Record<DropLayer, DropRow>, id: DropLayer): boolean {
  return rows[id].enabled && !rows[id].muted && (!dropLayerIds.some(key => rows[key].enabled && rows[key].solo) || rows[id].solo);
}
