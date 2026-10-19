// Native group gestures keep their real pointer and original result assertions.
export async function dragRuntimeGroup(source, destination) {
  await source.scrollIntoViewIfNeeded();
  await destination.scrollIntoViewIfNeeded();
  // Scrolling after mouse-down can cancel Chromium's native drag before
  // dragstart. An endpoint still outside the viewport must fail, never replay.
  await source.dragTo(destination, {scroll: 'none'});
}
