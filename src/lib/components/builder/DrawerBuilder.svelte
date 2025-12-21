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
<div class="h-full w-full border-default bg-secondary overflow-hidden">
  <BuilderCanvas
    {widthMm}
    {depthMm}
    {heightMm}
    {hasCornerProfile}
    {onAddModule}
  />
</div>
