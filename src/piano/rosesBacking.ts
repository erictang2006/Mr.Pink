export type BackingMode = "roses" | "hwm-build" | "hwm-drop" | "hybrid";
export const defaultBackingMode: BackingMode = "hwm-drop";
export type BackingGroup = "chords" | "bass" | "drums" | "fx";
export const backingGroups: BackingGroup[] = ["chords", "bass", "drums", "fx"];
export const backingChoices: {value: BackingMode;label: string}[] = [
  {value:"roses",label:"Original Roses Buildup"},
  {value:"hwm-build",label:"Here With Me — Buildup"},
  {value:"hwm-drop",label:"Here With Me — Drop Backing"},
  {value:"hybrid",label:"Hybrid — Here With Me + Roses Drum Build"},
];
export const backingStemUrl = (mode: Exclude<BackingMode,"roses">, group: BackingGroup) => mode === "hybrid" ? `/roses/hybrid/${group}.wav` : `/roses/hwm-backing/${mode === "hwm-build" ? "build" : "drop"}-${group}.wav`;
