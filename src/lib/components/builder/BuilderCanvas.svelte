<script lang="ts">
  export let widthMm: number;
  export let depthMm: number;
  export let heightMm: number;
  export let hasCornerProfile: 'yes' | 'no';

  export let onAddModule: () => void = () => {};

  function simulateAdd() {
    onAddModule();
  }
</script>

<div class="h-full w-full grid place-items-center">
  <div class="text-center padding-m">
    <h3 class="heading-3">3D Builder Canvas</h3>

    <p class="body-text margin-y-s">
      Drawer: {widthMm} × {depthMm} × {heightMm} mm<br />
      Corner profile: {hasCornerProfile}
    </p>

    <button
      type="button"
      class="radius-m focus-ring bg-primary px-4 py-2 text-primary-contrast transition duration-200 ease-out hover:opacity-90"
      on:click={simulateAdd}
    >
      Simulate adding a module
    </button>
  </div>
</div>
