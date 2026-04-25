# Model Files

This folder stores the local Hugging Face model used by the API.

Repository source:

- https://huggingface.co/RaCas/judi-online

## Required Files

After download/clone, this folder should contain at least:

- config.json
- model.safetensors
- tokenizer.json
- tokenizer_config.json

## Download Model (Recommended)

From project root:

```bash
hf download RaCas/judi-online --local-dir model
```

Or from inside this folder:

```bash
hf download RaCas/judi-online --local-dir .
```

## Clone Model Repo (Git LFS)

Use this if you prefer full Git clone of the model repo.

```bash
git lfs install
```

Then, inside this folder (`model/`) and only if it is empty:

```bash
git clone https://huggingface.co/RaCas/judi-online .
```

## Update Existing Local Model

```bash
hf download RaCas/judi-online --local-dir model --revision main
```

## Verify

If model files are present, the API can preload model successfully on startup.
