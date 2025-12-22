<script lang="ts">
  import BuilderCanvas from './BuilderCanvas.svelte';
  import BomDrawer from '$lib/components/BomDrawer.svelte';

  export let widthMm: number;
  export let depthMm: number;
  export let heightMm: number;
  export let hasCornerProfile: 'yes' | 'no';

  // Parent callback (not a Svelte event)
  export let onAddModule: () => void = () => {};

  // BOM UI lives here; state stays in parent (+page.svelte)
  export let isBomOpen: boolean;
  export let moduleCount: number;
  export let bumpKey: number;
  export let onToggleBom: () => void = () => {};
  export let onCloseBom: () => void = () => {};
</script>

<!-- IMPORTANT: relative so button can pin to this box; h-full so it fills the remaining builder area -->
<div class="relative h-full w-full border-default bg-secondary overflow-hidden">
  <!-- Pinned button in top-right of builder area (with badge + shake) -->
  <button
    type="button"
    class="absolute right-0 top-0 z-20 radius-m bg-primary-accent/80 backdrop-blur border border-primary/10 ui-hover"
    on:click={onToggleBom}
    aria-expanded={isBomOpen}
    aria-controls="bom-drawer"
  >
    <span class="relative inline-flex items-center gap-2">
      <span class="body-text">Your build</span>

      {#key bumpKey}
        <span
          class="badge"
          class:shake={moduleCount > 0}
          aria-live="polite"
        >
          {moduleCount}
        </span>
      {/key}
    </span>
  </button>

  <BuilderCanvas
    {widthMm}
    {depthMm}
    {heightMm}
    {hasCornerProfile}
    {onAddModule}
  />

  <BomDrawer
    isOpen={isBomOpen}
    {moduleCount}
    title="Your build"
    onClose={onCloseBom}
  />
</div>

<style>
  .badge {
    display: inline-grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--color-primary);
    color: var(--color-primary-contrast);
    font-size: 12px;
    line-height: 1;
  }

  .shake {
    animation: shake 220ms ease-out;
  }

  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    30% {
      transform: translateX(-2px);
    }
    60% {
      transform: translateX(2px);
    }
    100% {
      transform: translateX(0);
    }
  }
</style>
