/** A parallel visual observer. Never disconnect or replace the existing speaker path. */
export function observeOutput<T extends { dispose(): unknown }>(
  output: { connect(node: T): unknown; disconnect(node: T): unknown },
  create: () => T,
) {
  const node = create();
  try { output.connect(node); } catch (error) { node.dispose(); throw error; }
  let disposed = false;
  return { node, dispose() {
    if (disposed) return;
    disposed = true;
    // The audio context may already have removed this branch during shutdown.
    try { output.disconnect(node); } catch { /* Only this observer is being removed. */ }
    node.dispose();
  } };
}
