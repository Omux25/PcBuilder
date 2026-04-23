# Spec Documents

The original project specification (Cahier des Charges) written for EMSI Orangers.

## Files

| File | Description |
|---|---|
| `cahier_de_charge_v2.tex` | LaTeX source — version 2 (latest) |
| `cahier_de_charge.tex` | LaTeX source — version 1 |
| `rendered/` | Compiled PDFs — gitignored, regenerate locally |

## Regenerating PDFs

Requires a LaTeX distribution (e.g. [MiKTeX](https://miktex.org/) on Windows or `texlive` on Ubuntu).

```bash
# In WSL2
pdflatex notes/spec/cahier_de_charge_v2.tex
# Output: cahier_de_charge_v2.pdf — move to notes/spec/rendered/
```

> The PDFs are in `rendered/` which is gitignored. The `.tex` source files are the committed source of truth.
