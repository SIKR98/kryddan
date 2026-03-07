<script lang="ts">
  export let scrollToBuilder: () => void;
</script>

<!-- HERO (100vh) -->
<section class="h-full w-full">
  <div class="grid h-full w-full grid-rows-[1fr_auto]">
    <!-- MAIN AREA -->
    <div class="grid w-full mt-[15vh] md:mt-[8vh] gap-l grid-rows-[auto_1fr] md:grid-cols-2 md:grid-rows-none">
      <!-- LEFT COLUMN -->
      <div class="grid w-full grid-rows-[auto_auto_auto] gap-10 md:content-center">
        <!-- Headline -->
        <div class="mx-auto">
          <h1 class="heading-1 text-left">
            A modular spice drawer.<br />
            Built to fit.
          </h1>
        </div>

        <!-- Description -->
        <div>
          <p class="body-text text-center md:text-left">
            Forward-angled inserts keep jars visible and easy to grab. Modules
            prevent rolling and rattling, and let you build a layout that matches
            your exact drawer.
          </p>
        </div>

        <!-- Trust strip -->
        <div class="grid grid-cols-2 gap-3">
          <div class="radius-m border-subtle bg-secondary padding-s text-center md:text-left">
            <div class="heading-3">Custom for every drawer</div>
            <div class="body-text">Easy virtual builder</div>
          </div>
          <div class="radius-m border-subtle bg-secondary padding-s text-center md:text-left">
            <div class="heading-3">IKEA-ready</div>
            <div class="body-text">Presets for ikea modules</div>
          </div>
        </div>
      </div>

    <!-- RIGHT COLUMN: Image -->
      <div class="grid h-full w-full place-items-center pb-m md:pb-0">
        <div class="inline-block">
          <img
            src="/images/spiceHolder2.png"
            alt="SpiceModules"
            class="max-h-[60vh] w-auto drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)]"
          />
        </div>
      </div>
    </div>

    <!-- BOTTOM BAR: CTA + arrow -->
    <div class="grid w-full place-items-center pb-6">
      <button
        type="button"
        class="radius-m focus-ring bg-secondary-contrast px-6 py-3 text-primary transition duration-200 ease-out hover:opacity-90"
        on:click={scrollToBuilder}
      >
        Build your drawer <span aria-hidden="true">↓</span>
      </button>
    </div>
  </div>
</section>

