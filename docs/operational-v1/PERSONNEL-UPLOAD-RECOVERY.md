# Original personnel attachment recovery (unpublished)

The original personnel document API uploaded an encrypted object before committing document metadata and HR audit. A lost object response or a later database rollback could leave the encrypted object without a committed document. A new random object key on retry multiplied such files. This change preserves the original writer, document versions, scanner, permissions and review state.

For a provider supporting optional bounded lookup, the validated tenant, actual actor, owner, kind, parent, content hash and original request key determine stable document/version identifiers. Upload remains create-only. A lost response or create-only conflict reads only the exact retained path and validates the decrypted bytes before committing original metadata. Definite authorization or input refusal remains a failure. Only explicit HTTP 404 means missing; all other read failures stay errors. Encrypted recovery reads are bounded at 20 MiB. Successful uploads incur no extra read.

There is no overwrite, delete, automatic document approval or historical orphan cleanup. A changed validated parent/context is a different operation. Storage and PostgreSQL are not one distributed transaction; existing orphan inventory and a full bulk-document importer remain separate work. Legacy custom stores without optional lookup retain their existing behavior.

Evidence: `backend/tests/personnel-upload-recovery.test.ts`, `personnel-upload-recovery-native.test.ts` and `provider.test.ts`. The native linked personnel run passed 60 cases, including an isolated encrypted archive restore with local PostgreSQL tools. The final provider/recovery run passed 10 cases: lost reply, late HR-audit rollback, same-key replay, exact retained blob, conflicting bytes, definite provider refusal, bounded reads and no object deletion/overwrite. These are independent synthetic providers and disposable local databases; no hosted data was changed.

The original personnel-directory browser journey also passed in Arabic and English at 1440/768/390 widths, including lost API reply recovery, retained employee input, permanent PDF/image readback, sequential document history and original permission/company controls.

## Original read integrity

The same verified-byte helper now checks original personnel/library downloads against stored size and SHA256 before a successful-read audit or returning bytes. A different but validly encrypted object is refused with `fileIntegrityFailed`; the UI uses a localized message. The synthetic test restores only its in-memory fake object and proves the real original file opens again, with existing version metadata unchanged and no successful-read audit for the refused file.67 linked original personnel/reference/provider/recovery tests passed, including the original isolated encrypted archive restore. This does not modify any stored operating document.
