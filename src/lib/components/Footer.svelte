<script lang="ts">
  // Footer content is static for now.
  // External links are placeholders and will be wired later.
</script>

<footer class="bg-primary-accent/80 backdrop-blur pt-m pb-l md:py-s">
  <div class="mx-auto px-s md:px-xl">
    <div class="flex flex-col items-center gap-xs md:gap-6 text-center md:flex-row md:justify-between md:text-left">
      <!-- Brand -->
      <div class="flex items-center gap-3">
        <!-- Icon -->
        <div class="flex h-10 w-10 items-center justify-center overflow-hidden">
            <img
            src="/icon/kryddIcon.png"
            alt="Kryddan icon"
            class="h-full w-full object-cover"
            />
        </div>
        <div class="text-center">
          <p class="body-text text-secondary/70">
            © {new Date().getFullYear()} Kryddan. All rights reserved.
          </p>
        </div>
      </div>

      <!-- Links (always row, smaller text) -->
      <nav
        class="flex flex-row items-center gap-4 md:gap-6"
        aria-label="Footer links"
      >
        <a
          href="#"
          class="small-text ui-hover"
          aria-disabled="true"
        >
          Instagram
        </a>

        <a
          href="#"
          class="small-text ui-hover"
          aria-disabled="true"
        >
          Sister company
        </a>

        <a
          href="#"
          class="small-text ui-hover"
          aria-disabled="true"
        >
          Terms & Conditions
        </a>
      </nav>
    </div>
  </div>
</footer>
