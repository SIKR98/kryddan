<script lang="ts">
  // Footer content is static for now.
  // External links are placeholders and will be wired later.
</script>

<footer class="bg-primary-accent/80 backdrop-blur py-m">
    <div class="mx-auto px-xl">
        <div class="flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
        <!-- Brand -->
        <div class="flex items-center gap-3">
            <div class="radius-m border-default flex h-10 w-10 items-center justify-center bg-white">
            <span class="heading-3">SK</span>
            </div>
                <div class="text-center">
                    <p class="body-text text-secondary/70">
                        © {new Date().getFullYear()} Kryddan. All rights reserved.
                    </p>
                </div>
        </div>

        <!-- Links -->
        <nav class="flex flex-col gap-2 md:flex-row md:gap-6" aria-label="Footer links">
            <a
            href="#"
            class="body-text ui-hover"
            aria-disabled="true"
            >
            Instagram
            </a>

            <a
            href="#"
            class="body-text ui-hover"
            aria-disabled="true"
            >
            Sister company
            </a>

            <a
            href="#"
            class="body-text ui-hover"
            aria-disabled="true"
            >
            Terms & Conditions
            </a>
        </nav>
        </div>
    </div>
</footer>
