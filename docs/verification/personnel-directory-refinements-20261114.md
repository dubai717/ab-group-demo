# Administrative directory and employee/login separation

Repository: dubai717/ab-group-demo only. Base: published staging 8cfd369. PRs 83/84/86/87 were already merged; their employee-first documents, durable uploads, original-account read-through, supervisor cycle/link locks and security checks are reused. Financial PR 89 and unapproved SQL 028/029 are not included.

## Changes

- Personnel > Administrative units > Approved administrative unit types exposes the existing seven definitions and tenant additions. Owner-only creation is available from this register and inline in a new-unit window; a new type immediately populates the open parent unit's approved code/names without losing an unsaved employee. One definition is reused across legal companies.
- Real units retain company/group scope and existing IDs. Responsible staff are registered HR employees, with primary/additional-unit members ordered first. A company-unit responsible employee may be legally employed elsewhere if explicit descriptive work coverage includes that company; group units accept any authorized active employee. Missing staff are explained and responsibility remains optional. Previous inactive responsibility can be retained.
- Changing HR responsibility never writes a linked account's security manager, roles, grants or memberships. Existing legacy department manager references remain intact; new unit responsibility is stored as the HR employee reference.
- Positions get unique stable POS-000001-style server codes under the existing tenant catalog lock. Existing position codes and historical department metadata are retained. The department field is removed from position forms and no longer restricts the position's use across units. Reusing a position never creates role grants.
- HR work-company checklists show legal registration/ID disambiguation and search, select/clear and selected counts. Existing primary/additional unit selections, including historical inactive units, survive reopening. The search controls keep original checkbox/select names and FormData; filtering never clears hidden selected values.
- Security companies/units are explicitly labelled permitted data access, independently of HR work coverage. Search/bulk controls/counts use the existing membership validation/save path. Security reporting manager is optional under Advanced settings because existing explicit reports-scope delegation uses it. HR direct supervisor is not copied into a new login's security reporting manager.
- Existing international phone entry/country selection is reused globally. Ambiguous +1 numbers no longer guess US versus Canada. Unconfirmed legacy values and separate WhatsApp intent remain unchanged.

## Verification

Isolated server tests cover: per-company reuse of one unit type; group unit; unique concurrent automatic position codes; same position across units/companies; retaining historical position links/codes; cross-company supervisor; cross-company work-covered responsible employee with a linked account; no user/role/grant changes; explicit login guard and cycles; phone and original document preservation.

Actual browser flows cover: catalog type creation and company unit; nested type creation inside a group-unit form while an unsaved employee remains; automatic position code with no unit field; three work companies/search/filtered bulk actions; multiple units; real staff supervisor and responsible employee; initial photo/PDF/image previews and durable retry; creating a real login through the employee UI and explicitly confirming its link; old account passport read-through and version preservation; narrower login security scope with search/bulk/count controls; no copied security manager; no personal upload fields in linked login editor; no WhatsApp inference; ambiguous country retention; Arabic/English desktop/tablet/phone; both presence/absence of the optional personnel schema.

No migrations, mass transfers, old record rewrites, permission backfills, balance changes, secret changes or Production actions are included. Native exact-head CI and the existing human GitHub staging deployment gate remain required.
