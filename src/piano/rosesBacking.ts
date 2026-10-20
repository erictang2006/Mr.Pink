export type BackingMode = "roses" | "hwm-build" | "hwm-drop";
export type BackingGroup = "chords" | "bass" | "drums" | "fx";
export const backingGroups: BackingGroup[] = ["chords", "bass", "drums", "fx"];
export const backingChoices: {value: BackingMode;label: string}[] = [
  {value:"roses",label:"Original Roses Buildup"},
  {value:"hwm-build",label:"Here With Me — Buildup"},
  {value:"hwm-drop",label:"Here With Me — Drop Backing"},
];
export const backingStemUrl = (mode: Exclude<BackingMode,"roses">, group: BackingGroup) => `/roses/hwm-backing/${mode === "hwm-build" ? "build" : "drop"}-${group}.wav`;
