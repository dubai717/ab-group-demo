# Local isolated test infrastructure

The full local f78d6c2 run ended789 tests/784 pass/5 fail; it is not recorded as a fully passing local suite. Failed HR/vehicle/investor restore groups stopped at `OCI runtime exec failed: write /tmp/runc-process…: no space left on device`. A harmless local pg_isready Docker exec reproduced that host scratch allocation failure.

No unknown DB, backup or cache was deleted. No daemon configuration, original data, Supabase connection or protection changed. For diagnosis only, the existing synthetic container's PostgreSQL17.11 binaries/libraries were copied read-only into RAM. An ignored temporary adapter forced localhost5442, allowed dumps only from random ab_backup fixtures, and restricted restore/drop to this parent process's newly created ab_restore targets. No --clean, hosted connection or assertion change. All61 cases in the three affected original test files passed on59cc6df, including HR/vehicle restore and investor v2/v3 complete flows. These overlapping retries are not added to784 to fabricate a full run.

CI28 independently completed successfully with the ordinary canonical path onf78d6c2: https://github.com/dubai717/ab-group-demo/actions/runs/45241304807 . CI29 on59cc6df is separate. Local temporary logs/adapter were lost when that environment session ended; their SHA256 values are not invented here. The PR116 description preserves the reported scope. Current follow-up code was reconstructed, checkpointed to a separate non-PR branch before retesting, and its new acceptance evidence is recorded independently.

All source checkpoints are code only, not backups of an operating database. The original finance PR115 remains unchanged and unmerged.
