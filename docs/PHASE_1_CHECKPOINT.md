# Phase 1 Checkpoint

The `feature/seed-bari-unified-integration` branch is the non-production integration branch for the SEED BARI merge.

Current checkpoint:
- Preserve the existing India + Bangladesh country model.
- Preserve the current product, cart, checkout and order foundation.
- Add the SEED BARI system/module registry.
- Use the current Supabase schema as the database target.
- Do not run the ZIP migrations blindly.
- Do not copy the ZIP UI or legacy referral implementation.
- Add a protected admin system-health checkpoint.
- Keep production `main` unchanged until CI/build validation and functional testing pass.
