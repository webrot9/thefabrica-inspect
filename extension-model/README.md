# The extension boundary

A commercial foundation has one structural problem to solve: you will
change it after the buyer starts building on it, and they still have to
be able to take those changes.

The Fabrica's answer is a reserved-path convention rather than a plugin
system. It is deliberately boring, and the boringness is the feature.

## Where buyer code goes

Product code the buyer writes lives in reserved `_domain/`
directories that exist throughout the tree — under models, routers,
schemas, repositories, services, workers, prompts, scrapers, seed data,
and their frontend equivalents. Factory code lives outside those paths.

The property the shipped code actually gives you:

> Buyer-created product files live in reserved `_domain/` paths.
> Upstream ships only a `README.md` and a `.gitkeep` inside those
> directories, so a buyer file — which will have some other name —
> has no upstream counterpart to be overwritten by.

That is deliberately narrower than "the factory never touches
`_domain/`", which is not true and should not be claimed: those
directories *do* contain factory-authored `README.md` files documenting
the local convention, and upstream may revise them. The guarantee is
about your files, not about the directory.

What this buys you is a smaller collision surface on upgrade, not a
magic one. Pulling a factory update touches factory paths; your product
files sit in paths upstream does not write to. It reduces the number of
places a merge can conflict — it does not make upgrades unconditionally
conflict-free, and anything that edits a factory file still merges like
any other change.

## Buyer code is ordinary code

There is no plugin runtime, no registry, no lifecycle hooks, no
manifest format. A buyer model is a SQLAlchemy model. A buyer router is
a FastAPI router. A buyer component is a React component.

The practical consequence is that buyer code is not second-class. It is
type-checked by the same `mypy --strict`, linted by the same
`ruff` and `eslint --max-warnings 0` (both at zero-warning settings),
and run by the same test suite as factory code. There is no separate,
laxer bar for "extension" code, because the tooling cannot tell the
difference — and nothing has to be re-implemented inside a plugin API
that the framework already does.

## Wiring is explicit

Adding a model or a router means adding an import. Models are listed in
the models package; routers are mounted on the application. There is no
auto-discovery of `_domain/` modules in the shipped code — no dynamic
import machinery exists in the backend at all.

This is a real trade-off and worth stating plainly. Explicit wiring
costs the buyer one line per resource. In exchange, imports are
statically analysable, `mypy` can see the whole graph, a missing model
fails at import rather than at migration time, and there is no
load-order magic to debug. For a codebase intended to be read and
extended by both a small team and a coding agent, that trade favours
the explicit side.

## How to check this claim

The property above is structural, so you can verify it without running
anything, given access to the private repository: list the contents of
any `_domain/` directory and confirm upstream ships only `README.md`
and `.gitkeep`; then grep the backend for dynamic import machinery
(`importlib`, `pkgutil`, `iter_modules`) and confirm there is none.

If either check fails, the claim on this page is wrong and should be
challenged.
