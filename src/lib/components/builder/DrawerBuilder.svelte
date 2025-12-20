<script lang="ts">
  import BuilderCanvas from './BuilderCanvas.svelte';

  export let widthMm: number;
  export let depthMm: number;
  export let heightMm: number;
  export let hasCornerProfile: 'yes' | 'no';

  // Parent callback (not a Svelte event)
  export let onAddModule: () => void = () => {};
</script>

<!-- IMPORTANT: h-full so it fills the remaining builder area -->
<div class="h-full w-full radius-l border-default bg-secondary-contrast overflow-hidden">
  <BuilderCanvas
    {widthMm}
    {depthMm}
    {heightMm}
    {hasCornerProfile}
    {onAddModule}
  />
</div>
