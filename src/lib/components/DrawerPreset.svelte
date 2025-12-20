<script context="module" lang="ts">
  export type DrawerPresetValue = 'custom' | 'ikea-metod-maximera';
  export type HasCornerProfile = 'yes' | 'no';
</script>

<script lang="ts">
  export let preset: DrawerPresetValue;

  // Dimensions in millimeters
  export let widthMm: number;
  export let depthMm: number;
  export let heightMm: number;

  // Internal side corner profile (Yes/No)
  export let hasCornerProfile: HasCornerProfile;
</script>

<div class="radius-m border-default bg-secondary-contrast padding-m w-full">
  <div class="grid gap-4">
    <!-- Large screens: one row, preset 1/3 and controls 2/3 -->
    <div class="hidden md:grid grid-cols-3 gap-4 items-end">
      <div class="flex flex-col gap-2">
        <label class="body-text" for="preset-md">Drawer preset</label>
        <select
          id="preset-md"
          class="radius-m border-default focus-ring bg-white px-3 py-2 w-full"
          bind:value={preset}
        >
          <option value="custom">Custom drawer</option>
          <option value="ikea-metod-maximera">IKEA METOD / MAXIMERA (example)</option>
        </select>
      </div>

      <div class="col-span-2 grid grid-cols-4 gap-3">
        <div class="flex flex-col gap-2">
          <label class="body-text" for="w-md">Width (mm)</label>
          <input id="w-md" class="dimension-input w-full" type="number" min="0" bind:value={widthMm} />
        </div>

        <div class="flex flex-col gap-2">
          <label class="body-text" for="d-md">Depth (mm)</label>
          <input id="d-md" class="dimension-input w-full" type="number" min="0" bind:value={depthMm} />
        </div>

        <div class="flex flex-col gap-2">
          <label class="body-text" for="h-md">Height (mm)</label>
          <input id="h-md" class="dimension-input w-full" type="number" min="0" bind:value={heightMm} />
        </div>

        <div class="flex flex-col gap-2">
          <span class="body-text">Internal profile</span>
          <div class="dimension-input w-full flex items-center justify-between">
            <label class="flex items-center gap-2">
              <input
                class="focus-ring"
                type="radio"
                name="corner-profile-md"
                value="no"
                bind:group={hasCornerProfile}
              />
              <span class="body-text">No</span>
            </label>

            <label class="flex items-center gap-2">
              <input
                class="focus-ring"
                type="radio"
                name="corner-profile-md"
                value="yes"
                bind:group={hasCornerProfile}
              />
              <span class="body-text">Yes</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- Small screens: two rows, preset full width then 4 equal boxes -->
    <div class="md:hidden grid gap-4">
      <div class="flex flex-col gap-2">
        <label class="body-text" for="preset-sm">Drawer preset</label>
        <select
          id="preset-sm"
          class="radius-m border-default focus-ring bg-white px-3 py-2 w-full"
          bind:value={preset}
        >
          <option value="custom">Custom drawer</option>
          <option value="ikea-metod-maximera">IKEA METOD / MAXIMERA (example)</option>
        </select>
      </div>

      <div class="grid grid-cols-4 gap-3">
        <div class="flex flex-col gap-2">
          <label class="body-text" for="w-sm">Width (mm)</label>
          <input id="w-sm" class="dimension-input w-full" type="number" min="0" bind:value={widthMm} />
        </div>

        <div class="flex flex-col gap-2">
          <label class="body-text" for="d-sm">Depth (mm)</label>
          <input id="d-sm" class="dimension-input w-full" type="number" min="0" bind:value={depthMm} />
        </div>

        <div class="flex flex-col gap-2">
          <label class="body-text" for="h-sm">Height (mm)</label>
          <input id="h-sm" class="dimension-input w-full" type="number" min="0" bind:value={heightMm} />
        </div>

        <div class="flex flex-col gap-2">
          <span class="body-text">Internal profile</span>
          <div class="dimension-input w-full flex items-center justify-between">
            <label class="flex items-center gap-2">
              <input
                class="focus-ring"
                type="radio"
                name="corner-profile-sm"
                value="no"
                bind:group={hasCornerProfile}
              />
              <span class="body-text">No</span>
            </label>

            <label class="flex items-center gap-2">
              <input
                class="focus-ring"
                type="radio"
                name="corner-profile-sm"
                value="yes"
                bind:group={hasCornerProfile}
              />
              <span class="body-text">Yes</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
